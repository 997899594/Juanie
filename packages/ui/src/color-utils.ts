// 统一使用 OKLCH 颜色空间，移除 HSL 冗余代码
export interface OklchColor {
  l: number // 亮度 0-1
  c: number // 色度 0-0.4
  h: number // 色相 0-360
}

export interface RgbColor {
  r: number // 0-255
  g: number // 0-255  
  b: number // 0-255
}

// Hex 转 RGB
function hexToRgb(hex: string): RgbColor {
  const cleanHex = hex.replace('#', '')
  const fullHex = cleanHex.length === 3 
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex
    
  const num = parseInt(fullHex, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

// sRGB 转线性 RGB
function srgbToLinear(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045 
    ? normalized / 12.92 
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

// RGB 转 OKLCH
export function hexToOklch(hex: string): OklchColor {
  const { r, g, b } = hexToRgb(hex)
  
  // 转换为线性 RGB
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  
  // RGB 转 OKLab
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B
  
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  
  // OKLab 转 OKLCH
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  
  const C = Math.sqrt(a * a + b2 * b2)
  let H = (Math.atan2(b2, a) * 180) / Math.PI
  if (H < 0) H += 360
  
  return { l: L, c: C, h: H }
}

// OKLCH 转 CSS 字符串
export function oklchToString({ l, c, h }: OklchColor): string {
  const lightness = Math.max(0, Math.min(100, l * 100))
  const chroma = Math.max(0, c)
  const hue = Math.round(h) % 360
  
  return `oklch(${lightness.toFixed(1)}% ${chroma.toFixed(4)} ${hue})`
}

// 从主色生成协调色板
export function generateColorPalette(primary: OklchColor) {
  const { l, c, h } = primary
  
  // 确保主色可读性
  const primaryForeground = l > 0.6 
    ? { l: 0.15, c: 0, h: 0 } // 深色文字
    : { l: 0.98, c: 0, h: 0 } // 浅色文字
  
  // 生成辅助色（色相偏移）
  const secondary = {
    l: Math.min(l + 0.1, 0.95),
    c: Math.max(c * 0.3, 0.02),
    h: (h + 180) % 360
  }
  
  // 生成强调色（饱和度增强）
  const accent = {
    l: l,
    c: Math.min(c * 1.2, 0.35),
    h: (h + 30) % 360
  }
  
  return {
    primary: oklchToString(primary),
    primaryForeground: oklchToString(primaryForeground),
    secondary: oklchToString(secondary),
    secondaryForeground: oklchToString({ l: 0.2, c: 0, h: 0 }),
    accent: oklchToString(accent),
    accentForeground: oklchToString(primaryForeground),
    
    // 语义色（固定，确保一致性）
    success: 'oklch(74% 0.12 145)',
    successForeground: 'oklch(15% 0.02 145)',
    warning: 'oklch(84% 0.16 84)',
    warningForeground: 'oklch(28% 0.07 46)',
    destructive: 'oklch(58% 0.25 27)',
    destructiveForeground: 'oklch(98% 0 0)',
    info: 'oklch(79% 0.14 230)',
    infoForeground: 'oklch(20% 0.02 230)'
  }
}

// 颜色对比度计算（WCAG 标准）
export function getContrastRatio(color1: OklchColor, color2: OklchColor): number {
  const l1 = Math.max(color1.l, color2.l)
  const l2 = Math.min(color1.l, color2.l)
  return (l1 + 0.05) / (l2 + 0.05)
}

// 检查颜色可访问性
export function isAccessible(foreground: OklchColor, background: OklchColor): boolean {
  return getContrastRatio(foreground, background) >= 4.5
}
