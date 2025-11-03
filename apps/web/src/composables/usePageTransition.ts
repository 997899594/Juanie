/**
 * 页面过渡动画组合式函数
 * 提供统一的页面进入动画配置
 */

export interface PageTransitionConfig {
  /** 页面容器动画 */
  page: {
    initial: { opacity: number; y: number }
    enter: { opacity: number; y: number; transition: { duration: number; ease: string } }
  }
  /** 页面标题动画 */
  header: {
    initial: { opacity: number; x: number }
    enter: { opacity: number; x: number; transition: { duration: number; delay: number } }
  }
  /** 卡片动画（带延迟） */
  card: (index: number) => {
    initial: { opacity: number; y: number }
    enter: { opacity: number; y: number; transition: { duration: number; delay: number } }
  }
  /** 列表项动画（交错） */
  listItem: (index: number) => {
    initial: { opacity: number; x: number }
    enter: { opacity: number; x: number; transition: { duration: number; delay: number } }
  }
  /** 统计卡片动画（缩放） */
  statsCard: (index: number) => {
    initial: { opacity: number; scale: number }
    enter: { opacity: number; scale: number; transition: { duration: number; delay: number } }
  }
}

/**
 * 使用页面过渡动画
 * @param options 配置选项
 * @returns 动画配置对象
 */
export function usePageTransition(options?: {
  /** 是否禁用动画（大列表性能优化） */
  disabled?: boolean
  /** 基础延迟时间（ms） */
  baseDelay?: number
  /** 动画持续时间（ms） */
  duration?: number
}): PageTransitionConfig {
  const disabled = options?.disabled ?? false
  const baseDelay = options?.baseDelay ?? 100
  const duration = options?.duration ?? 300

  // 如果禁用动画，返回无动画配置
  if (disabled) {
    return {
      page: {
        initial: { opacity: 1, y: 0 },
        enter: { opacity: 1, y: 0, transition: { duration: 0, ease: 'linear' } },
      },
      header: {
        initial: { opacity: 1, x: 0 },
        enter: { opacity: 1, x: 0, transition: { duration: 0, delay: 0 } },
      },
      card: () => ({
        initial: { opacity: 1, y: 0 },
        enter: { opacity: 1, y: 0, transition: { duration: 0, delay: 0 } },
      }),
      listItem: () => ({
        initial: { opacity: 1, x: 0 },
        enter: { opacity: 1, x: 0, transition: { duration: 0, delay: 0 } },
      }),
      statsCard: () => ({
        initial: { opacity: 1, scale: 1 },
        enter: { opacity: 1, scale: 1, transition: { duration: 0, delay: 0 } },
      }),
    }
  }

  return {
    // 页面容器：从下到上淡入
    page: {
      initial: { opacity: 0, y: 20 },
      enter: { opacity: 1, y: 0, transition: { duration, ease: 'easeOut' } },
    },

    // 页面标题：从左到右淡入
    header: {
      initial: { opacity: 0, x: -20 },
      enter: { opacity: 1, x: 0, transition: { duration, delay: baseDelay } },
    },

    // 卡片：从下到上淡入，带交错延迟
    card: (index: number) => ({
      initial: { opacity: 0, y: 20 },
      enter: {
        opacity: 1,
        y: 0,
        transition: { duration, delay: baseDelay + index * 50 },
      },
    }),

    // 列表项：从左到右淡入，带交错延迟
    listItem: (index: number) => ({
      initial: { opacity: 0, x: -20 },
      enter: {
        opacity: 1,
        x: 0,
        transition: { duration, delay: baseDelay + index * 50 },
      },
    }),

    // 统计卡片：缩放淡入，带交错延迟
    statsCard: (index: number) => ({
      initial: { opacity: 0, scale: 0.9 },
      enter: {
        opacity: 1,
        scale: 1,
        transition: { duration, delay: baseDelay + index * 50 },
      },
    }),
  }
}

/**
 * 卡片悬停样式类
 * 提供统一的卡片交互效果
 */
export const cardHoverClass =
  'transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'

/**
 * 按钮点击样式类
 * 提供统一的按钮交互效果
 */
export const buttonActiveClass = 'active:scale-95 transition-transform'
