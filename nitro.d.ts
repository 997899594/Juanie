/// <reference types="nitropack" />

declare global {
  // Nitro 全局函数
  function defineEventHandler<T = any>(handler: (event: any) => T | Promise<T>): any
  function getRequestURL(event: any): URL
  function getHeader(event: any, name: string): string | undefined
  function setHeader(event: any, name: string, value: string): void
  function setResponseStatus(event: any, status: number): void
  function readBody(event: any): Promise<any>
  function sendRedirect(event: any, location: string, code?: number): void
  function createError(options: { statusCode: number; statusMessage: string; data?: any }): Error

  // 全局类型
  type HeadersInit = Record<string, string> | Headers | string[][]
}

export {}
