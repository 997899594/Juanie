import ts from 'typescript';

interface StaticDrizzleConfig {
  dialect: unknown;
  schema: unknown;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function collectTopLevelConstants(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
  const constants = new Map<string, ts.Expression>();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        constants.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  return constants;
}

function resolveExpression(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
  resolving = new Set<string>()
): ts.Expression {
  const unwrapped = unwrapExpression(expression);
  if (!ts.isIdentifier(unwrapped)) {
    return unwrapped;
  }

  const initializer = constants.get(unwrapped.text);
  if (!initializer || resolving.has(unwrapped.text)) {
    return unwrapped;
  }

  const nextResolving = new Set(resolving).add(unwrapped.text);
  return resolveExpression(initializer, constants, nextResolving);
}

function readStaticString(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>
): string {
  const resolved = resolveExpression(expression, constants);
  if (ts.isStringLiteral(resolved) || ts.isNoSubstitutionTemplateLiteral(resolved)) {
    return resolved.text;
  }
  throw new Error('Drizzle config dialect/schema must use static string literals');
}

function readStaticSchema(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>
): string | string[] {
  const resolved = resolveExpression(expression, constants);
  if (ts.isArrayLiteralExpression(resolved)) {
    return resolved.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        throw new Error('Drizzle config schema arrays cannot contain spreads');
      }
      return readStaticString(element, constants);
    });
  }
  return readStaticString(resolved, constants);
}

function resolveConfigObject(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>
): ts.ObjectLiteralExpression {
  const resolved = resolveExpression(expression, constants);
  if (ts.isCallExpression(resolved)) {
    const callee = resolveExpression(resolved.expression, constants);
    if (
      !ts.isIdentifier(callee) ||
      callee.text !== 'defineConfig' ||
      resolved.arguments.length !== 1
    ) {
      throw new Error('Drizzle config default export must be an object or defineConfig(object)');
    }
    return resolveConfigObject(resolved.arguments[0]!, constants);
  }
  if (!ts.isObjectLiteralExpression(resolved)) {
    throw new Error('Drizzle config default export must resolve to a static object');
  }
  if (resolved.properties.some((property) => ts.isSpreadAssignment(property))) {
    throw new Error('Drizzle config default export cannot contain object spreads');
  }
  return resolved;
}

export function parseStaticDrizzleConfig(source: string, fileName: string): StaticDrizzleConfig {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const constants = collectTopLevelConstants(sourceFile);
  const defaultExport = sourceFile.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals
  );
  if (!defaultExport) {
    throw new Error('Drizzle config must have a default export');
  }

  const config = resolveConfigObject(defaultExport.expression, constants);
  let dialect: string | undefined;
  let schema: string | string[] | undefined;

  for (const property of config.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      if (property.name.text === 'dialect') {
        dialect = readStaticString(property.name, constants);
      } else if (property.name.text === 'schema') {
        schema = readStaticSchema(property.name, constants);
      }
      continue;
    }
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const name = propertyNameText(property.name);
    if (name === 'dialect') {
      dialect = readStaticString(property.initializer, constants);
    } else if (name === 'schema') {
      schema = readStaticSchema(property.initializer, constants);
    }
  }

  return { dialect, schema };
}
