export interface HSL {
  h: number
  s: number
  l: number
}

export function hexToHsl(hex: string): HSL {
  const h = hex.replace('#', '')
  const bigint = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  const r1 = r / 255,
    g1 = g / 255,
    b1 = b / 255
  const max = Math.max(r1, g1, b1),
    min = Math.min(r1, g1, b1)
  let hDeg = 0,
    sPct = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    sPct = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r1:
        hDeg = (g1 - b1) / d + (g1 < b1 ? 6 : 0)
        break
      case g1:
        hDeg = (b1 - r1) / d + 2
        break
      case b1:
        hDeg = (r1 - g1) / d + 4
        break
    }
    hDeg *= 60
  }
  return { h: Math.round(hDeg), s: Math.round(sPct * 100), l: Math.round(l * 100) }
}

export function hslToString(hsl: HSL): string {
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n))
  return `hsl(${Math.round(hsl.h)} ${clamp(hsl.s)}% ${clamp(hsl.l)}%)`
}

export function makePaletteFromPrimary(primary: HSL) {
  const base = hslToString(primary)
  const primaryFg = primary.l > 55 ? 'hsl(0 0% 10%)' : 'hsl(0 0% 98%)'
  const accent = hslToString({
    h: (primary.h + 15) % 360,
    s: Math.min(primary.s + 10, 100),
    l: primary.l,
  })
  const secondary = hslToString({
    h: (primary.h + 200) % 360,
    s: Math.max(primary.s - 30, 10),
    l: Math.min(primary.l + 10, 90),
  })
  // 固定 hue 的状态色（更可预测）
  const success = 'hsl(145 50% 45%)'
  const warning = 'hsl(50 90% 50%)'
  const info = 'hsl(230 70% 55%)'
  const destructive = 'hsl(0 70% 50%)'
  return {
    light: {
      '--primary': base,
      '--primary-foreground': primaryFg,
      '--accent': accent,
      '--accent-foreground': primaryFg,
      '--secondary': secondary,
      '--secondary-foreground': 'hsl(0 0% 10%)',
      '--success': success,
      '--success-foreground': 'hsl(0 0% 98%)',
      '--warning': warning,
      '--warning-foreground': 'hsl(0 0% 10%)',
      '--info': info,
      '--info-foreground': 'hsl(0 0% 10%)',
      '--destructive': destructive,
      '--destructive-foreground': 'hsl(0 0% 98%)',
    },
    dark: {
      '--primary': base,
      '--primary-foreground': 'hsl(0 0% 98%)',
      '--accent': accent,
      '--accent-foreground': 'hsl(0 0% 98%)',
      '--secondary': 'hsl(0 0% 20%)',
      '--secondary-foreground': 'hsl(0 0% 98%)',
      '--success': 'hsl(145 40% 60%)',
      '--success-foreground': 'hsl(0 0% 10%)',
      '--warning': 'hsl(46 80% 45%)',
      '--warning-foreground': 'hsl(0 0% 98%)',
      '--info': 'hsl(230 60% 60%)',
      '--info-foreground': 'hsl(0 0% 98%)',
      '--destructive': 'hsl(0 65% 55%)',
      '--destructive-foreground': 'hsl(0 0% 98%)',
    },
  }
}

// OKLCH 管线：保留并使用这些导出
export interface Oklch {
  l: number
  c: number
  h: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const v = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

function srgbToLinear(u: number): number {
  const s = u / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex)
  const R = srgbToLinear(r),
    G = srgbToLinear(g),
    B = srgbToLinear(b)
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B
  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const C = Math.sqrt(a * a + b2 * b2)
  let h = (Math.atan2(b2, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c: C, h }
}

export function oklchToString({ l, c, h }: Oklch): string {
  const Lpct = Math.max(0, Math.min(1, l)) * 100
  return `oklch(${Lpct.toFixed(2)}% ${c.toFixed(4)} ${Math.round(h)})`
}

export function makeOklchPaletteFromPrimary(primary: Oklch) {
  const base = oklchToString(primary)
  const primaryFg = primary.l > 0.6 ? 'oklch(15% 0 0)' : 'oklch(98% 0 0)'
  const accent = oklchToString({
    l: primary.l,
    c: Math.min(primary.c * 1.1, 0.35),
    h: (primary.h + 15) % 360,
  })
  const secondary = oklchToString({
    l: Math.min(primary.l + 0.08, 0.97),
    c: Math.max(primary.c - 0.06, 0.02),
    h: (primary.h + 200) % 360,
  })
  const success = 'oklch(74% 0.12 145)'
  const warning = 'oklch(84% 0.16 84)'
  const info = 'oklch(79% 0.14 230)'
  const destructive = 'oklch(57.7% 0.245 27.3)'
  return {
    light: {
      '--primary': base,
      '--primary-foreground': primaryFg,
      '--accent': accent,
      '--accent-foreground': primaryFg,
      '--secondary': secondary,
      '--secondary-foreground': 'oklch(22% 0 0)',
      '--success': success,
      '--success-foreground': 'oklch(15% 0.02 145)',
      '--warning': warning,
      '--warning-foreground': 'oklch(28% 0.07 46)',
      '--info': info,
      '--info-foreground': 'oklch(20% 0.02 230)',
      '--destructive': destructive,
      '--destructive-foreground': 'oklch(98% 0 0)',
    },
    dark: {
      '--primary': base,
      '--primary-foreground': 'oklch(98% 0 0)',
      '--accent': accent,
      '--accent-foreground': 'oklch(98% 0 0)',
      '--secondary': 'oklch(26.9% 0 0)',
      '--secondary-foreground': 'oklch(98.5% 0 0)',
      '--success': 'oklch(65% 0.12 145)',
      '--success-foreground': 'oklch(98% 0 0)',
      '--warning': 'oklch(41% 0.11 46)',
      '--warning-foreground': 'oklch(99% 0.02 95)',
      '--info': 'oklch(65% 0.14 230)',
      '--info-foreground': 'oklch(98% 0 0)',
      '--destructive': 'oklch(70.4% 0.191 22.2)',
      '--destructive-foreground': 'oklch(98.5% 0 0)',
    },
  }
}
