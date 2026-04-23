import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

export interface MarkdownAsset<TFrontmatter> {
  path: string;
  frontmatter: TFrontmatter;
  body: string;
  raw: string;
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  if (!raw.startsWith('---\n')) {
    throw new Error('Markdown asset is missing frontmatter');
  }

  const closingIndex = raw.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    throw new Error('Markdown asset frontmatter is not closed');
  }

  return {
    frontmatter: raw.slice(4, closingIndex),
    body: raw.slice(closingIndex + 5).trim(),
  };
}

export function loadMarkdownAsset<TFrontmatter>(relativePath: string): MarkdownAsset<TFrontmatter> {
  const absolutePath = resolve(process.cwd(), relativePath);
  const raw = readFileSync(absolutePath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);

  return {
    path: absolutePath,
    frontmatter: YAML.parse(frontmatter) as TFrontmatter,
    body,
    raw,
  };
}
