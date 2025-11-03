import { toast } from 'vue-sonner'

/**
 * Toast 通知组合式函数
 * 基于 vue-sonner 实现统一的通知提示
 */
export function useToast() {
  return {
    /**
     * 成功通知
     * @param message 主要消息
     * @param description 详细描述（可选）
     */
    success: (message: string, description?: string) => {
      toast.success(message, { description })
    },

    /**
     * 错误通知
     * @param message 主要消息
     * @param description 详细描述（可选）
     */
    error: (message: string, description?: string) => {
      toast.error(message, { description })
    },

    /**
     * 警告通知
     * @param message 主要消息
     * @param description 详细描述（可选）
     */
    warning: (message: string, description?: string) => {
      toast.warning(message, { description })
    },

    /**
     * 信息通知
     * @param message 主要消息
     * @param description 详细描述（可选）
     */
    info: (message: string, description?: string) => {
      toast.info(message, { description })
    },

    /**
     * 加载中通知
     * @param message 主要消息
     * @returns 返回 toast ID，可用于后续更新或关闭
     */
    loading: (message: string) => {
      return toast.loading(message)
    },

    /**
     * Promise 通知
     * 自动处理 loading、success、error 状态
     * @param promise Promise 对象
     * @param messages 不同状态的消息
     */
    promise: <T>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string | ((data: T) => string)
        error: string | ((error: any) => string)
      },
    ) => {
      return toast.promise(promise, messages)
    },

    /**
     * 自定义通知
     * @param message 消息内容
     * @param options 自定义选项
     */
    custom: (message: string, options?: any) => {
      return toast(message, options)
    },

    /**
     * 关闭指定通知
     * @param toastId Toast ID
     */
    dismiss: (toastId?: string | number) => {
      toast.dismiss(toastId)
    },
  }
}
