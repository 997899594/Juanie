/**
 * 应用配置工具
 */

export const config = {
  /**
   * API 基础 URL
   */
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  
  /**
   * 前端应用 URL
   */
  appUrl: import.meta.env.VITE_APP_URL || window.location.origin,
  
  /**
   * 获取完整的重定向 URL
   * @param path 路径，默认为根路径
   * @returns 完整的 URL
   */
  getRedirectUrl(path: string = '/'): string {
    const baseUrl = this.appUrl.endsWith('/') ? this.appUrl.slice(0, -1) : this.appUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  },
  
  /**
   * 获取当前页面的完整 URL（用于重定向）
   * @param route 当前路由对象
   * @returns 完整的 URL
   */
  getCurrentPageUrl(route: any): string {
    return this.getRedirectUrl(route.fullPath);
  }
};