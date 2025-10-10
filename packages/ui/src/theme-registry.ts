export type ThemeVars = Record<string, string>;
export interface ThemeDef {
  name: string;
  light: ThemeVars;
  dark?: ThemeVars;
  meta?: { author?: string; version?: string; updatedAt?: string; source?: string; description?: string };
}

const styleId = "juanie-ui-themes";
const registry = new Map<string, ThemeDef>();

function ensureStyleEl() {
  let el = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = styleId;
    document.head.appendChild(el);
  }
  return el;
}

function buildCss(def: ThemeDef) {
  const lightVars = Object.entries(def.light)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
  const darkVars = def.dark
    ? Object.entries(def.dark)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ")
    : "";
  const selector = `:root[data-theme="${def.name}"]`;
  const darkSelector = `:root.dark[data-theme="${def.name}"]`;
  return `${selector}{${lightVars}}${darkVars ? `${darkSelector}{${darkVars}}` : ""}`;
}

export function registerTheme(def: ThemeDef) {
  registry.set(def.name, def);
  const el = ensureStyleEl();
  el.appendChild(document.createTextNode(buildCss(def)));
}

export function removeTheme(name: string) {
  registry.delete(name);
  const el = document.getElementById(styleId);
  if (el) el.textContent = "";
  // 重新注入剩余主题
  const reEl = ensureStyleEl();
  for (const t of registry.values()) {
    reEl.appendChild(document.createTextNode(buildCss(t)));
  }
}

export function exportTheme(name: string): ThemeDef | null {
  return registry.get(name) ?? null;
}

export function listThemes(): string[] {
  return Array.from(registry.keys());
}

export function applyTheme(name: string) {
  document.documentElement.dataset.theme = name;
}

export function setDark(enabled: boolean) {
  const el = document.documentElement;
  if (enabled) el.classList.add("dark");
  else el.classList.remove("dark");
}

// JSON 导入/导出与复制
export interface ThemeJson { name: string; light: ThemeVars; dark?: ThemeVars; meta?: ThemeDef["meta"] }

export function exportThemeJSON(name: string): string | null {
  const def = registry.get(name);
  return def ? JSON.stringify(def, null, 2) : null;
}

function validateThemeJson(obj: any): obj is ThemeJson {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.name !== 'string') return false;
  const hasVars = (o:any)=> o && typeof o === 'object' && Object.keys(o).every((k)=> typeof k === 'string' && k.startsWith('--') && typeof o[k] === 'string');
  if (!hasVars(obj.light)) return false;
  if (obj.dark && !hasVars(obj.dark)) return false;
  return true;
}

export function importThemeJSON(json: string): ThemeDef {
  const obj = JSON.parse(json);
  if (!validateThemeJson(obj)) throw new Error('Invalid theme JSON');
  const def: ThemeDef = {
    name: obj.name,
    light: obj.light,
    ...(obj.dark ? { dark: obj.dark } : {}),
    ...(obj.meta ? { meta: obj.meta } : {}),
  };
  registerTheme(def);
  return def;
}

export async function copyThemeJSON(name: string): Promise<boolean> {
  const payload = exportThemeJSON(name);
  if (!payload) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      return true;
    }
    return false;
  } catch { return false; }
}