export interface ApplyThemeOptions {
  transition?: boolean
  duration?: string
}

/**
 * 应用主题到 DOM
 */
export function applyThemeToDOM(
  variables: Record<string, string>,
  mode: 'light' | 'dark',
  presetName?: string,
): void {
  const root = document.documentElement

  // 应用 CSS 变量
  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value)
  }

  // 设置主题模式类名
  root.classList.remove('light', 'dark')
  root.classList.add(mode)

  // 设置主题预设属性
  if (presetName) {
    root.setAttribute('data-theme', presetName)
  }
}
