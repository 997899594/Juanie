/**
 * 璁捐浠ょ墝绫诲瀷瀹氫箟
 * 涓鸿璁＄郴缁熸彁渚涚被鍨嬪畨鍏ㄧ殑浠ょ墝鎺ュ彛
 */

/** 棰滆壊浠ょ墝 */
export interface ColorTokens {
  /** 鍝佺墝涓昏壊 */
  primary: string
  /** 鍝佺墝涓昏壊鎮仠鎬?*/
  primaryHover: string
  /** 鍝佺墝涓昏壊鎸変笅鎬?*/
  primaryPressed: string
  /** 鍝佺墝杈呭姪鑹?*/
  secondary: string
  /** 鍝佺墝杈呭姪鑹叉偓鍋滄€?*/
  secondaryHover: string
  /** 鍝佺墝杈呭姪鑹叉寜涓嬫€?*/
  secondaryPressed: string
}

/** 璇箟鍖栭鑹蹭护鐗?*/
export interface SemanticColorTokens {
  /** 鎴愬姛鑹?*/
  success: string
  /** 鎴愬姛鑹叉偓鍋滄€?*/
  successHover: string
  /** 鎴愬姛鑹叉寜涓嬫€?*/
  successPressed: string
  /** 璀﹀憡鑹?*/
  warning: string
  /** 璀﹀憡鑹叉偓鍋滄€?*/
  warningHover: string
  /** 璀﹀憡鑹叉寜涓嬫€?*/
  warningPressed: string
  /** 閿欒鑹?*/
  error: string
  /** 閿欒鑹叉偓鍋滄€?*/
  errorHover: string
  /** 閿欒鑹叉寜涓嬫€?*/
  errorPressed: string
  /** 淇℃伅鑹?*/
  info: string
  /** 淇℃伅鑹叉偓鍋滄€?*/
  infoHover: string
  /** 淇℃伅鑹叉寜涓嬫€?*/
  infoPressed: string
}

/** 涓€ц壊浠ょ墝 */
export interface NeutralColorTokens {
  /** 鑳屾櫙鑹?- 涓昏 */
  bgPrimary: string
  /** 鑳屾櫙鑹?- 娆¤ */
  bgSecondary: string
  /** 鑳屾櫙鑹?- 涓夌骇 */
  bgTertiary: string
  /** 鑳屾櫙鑹?- 鎮仠 */
  bgHover: string
  /** 鑳屾櫙鑹?- 鎸変笅 */
  bgPressed: string
  /** 鏂囨湰鑹?- 涓昏 */
  textPrimary: string
  /** 鏂囨湰鑹?- 娆¤ */
  textSecondary: string
  /** 鏂囨湰鑹?- 涓夌骇 */
  textTertiary: string
  /** 鏂囨湰鑹?- 绂佺敤 */
  textDisabled: string
  /** 杈规鑹?- 鏈€娴?*/
  borderLightest: string
  /** 杈规鑹?- 娴?*/
  borderLight: string
  /** 杈规鑹?- 鎮仠 */
  borderHover: string
  /** 杈规鑹?- 鐒︾偣 */
  borderFocus: string
}

/** 闂磋窛浠ょ墝 */
export interface SpacingTokens {
  /** 瓒呭皬闂磋窛 */
  xs: string
  /** 灏忛棿璺?*/
  sm: string
  /** 涓瓑闂磋窛 */
  md: string
  /** 澶ч棿璺?*/
  lg: string
  /** 瓒呭ぇ闂磋窛 */
  xl: string
  /** 瓒呰秴澶ч棿璺?*/
  '2xl': string
  /** 瓒呰秴瓒呭ぇ闂磋窛 */
  '3xl': string
}

/** 鍦嗚浠ょ墝 */
export interface RadiusTokens {
  /** 鏃犲渾瑙?*/
  none: string
  /** 灏忓渾瑙?*/
  sm: string
  /** 涓瓑鍦嗚 */
  md: string
  /** 澶у渾瑙?*/
  lg: string
  /** 瓒呭ぇ鍦嗚 */
  xl: string
  /** 瀹屽叏鍦嗚 */
  full: string
}

/** 瀛椾綋浠ょ墝 */
export interface TypographyTokens {
  /** 瀛椾綋鏃?*/
  fontFamily: {
    sans: string
    mono: string
  }
  /** 瀛椾綋澶у皬 */
  fontSize: {
    xs: string
    sm: string
    base: string
    lg: string
    xl: string
    '2xl': string
    '3xl': string
    '4xl': string
  }
  /** 瀛椾綋绮楃粏 */
  fontWeight: {
    normal: string
    medium: string
    semibold: string
    bold: string
  }
  /** 琛岄珮 */
  lineHeight: {
    tight: string
    normal: string
    relaxed: string
  }
}

/** 闃村奖浠ょ墝 */
export interface ShadowTokens {
  /** 灏忛槾褰?*/
  sm: string
  /** 涓瓑闃村奖 */
  md: string
  /** 澶ч槾褰?*/
  lg: string
  /** 瓒呭ぇ闃村奖 */
  xl: string
}

/** 鍔ㄧ敾浠ょ墝 */
export interface AnimationTokens {
  /** 鍔ㄧ敾鎸佺画鏃堕棿 */
  duration: {
    fast: string
    normal: string
    slow: string
  }
  /** 鍔ㄧ敾缂撳姩鍑芥暟 */
  easing: {
    linear: string
    easeIn: string
    easeOut: string
    easeInOut: string
  }
}

/** 瀹屾暣鐨勮璁′护鐗屾帴鍙?*/
export interface DesignTokens {
  /** 棰滆壊浠ょ墝 */
  colors: ColorTokens
  /** 璇箟鍖栭鑹蹭护鐗?*/
  semantic: SemanticColorTokens
  /** 涓€ц壊浠ょ墝 */
  neutral: NeutralColorTokens
  /** 闂磋窛浠ょ墝 */
  spacing: SpacingTokens
  /** 鍦嗚浠ょ墝 */
  radius: RadiusTokens
  /** 瀛椾綋浠ょ墝 */
  typography: TypographyTokens
  /** 闃村奖浠ょ墝 */
  shadows: ShadowTokens
  /** 鍔ㄧ敾浠ょ墝 */
  animations: AnimationTokens
}

/** 涓婚閰嶇疆绫诲瀷 */
export interface ThemeConfig {
  /** 涓婚鍚嶇О */
  name: string
  /** 璁捐浠ょ墝 */
  tokens: DesignTokens
}
