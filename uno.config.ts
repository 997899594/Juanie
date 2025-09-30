import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  
  // 完整的设计系统 - 作为单一数据源
  theme: {
    colors: {
      // B站品牌色系
      'bilibili': {
        50: '#fef7f7',
        100: '#fdeaea',
        200: '#fbd5d5',
        300: '#f7b2b2',
        400: '#f48fb1',
        500: '#fb7299', // 主色
        600: '#e91e63',
        700: '#c2185b',
        800: '#ad1457',
        900: '#880e4f',
      },
      
      // 天空蓝色系
      'sky': {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9', // 主色
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
      },
      
      // 功能色系
      'success': '#10b981',
      'warning': '#f59e0b',
      'error': '#ef4444',
      'info': '#3b82f6',
      
      // 中性色系
      'gray': {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
      },
    },
    
    // 字体系统
    fontFamily: {
      'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
    },
    
    fontSize: {
      'xs': ['0.75rem', { lineHeight: '1rem' }],
      'sm': ['0.875rem', { lineHeight: '1.25rem' }],
      'base': ['1rem', { lineHeight: '1.5rem' }],
      'lg': ['1.125rem', { lineHeight: '1.75rem' }],
      'xl': ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
    },
    
    fontWeight: {
      'light': '300',
      'normal': '400',
      'medium': '500',
      'semibold': '600',
      'bold': '700',
    },
    
    // 圆角系统 - 基于8px网格
    borderRadius: {
      'none': '0',
      'xs': '0.125rem', // 2px
      'sm': '0.25rem',  // 4px
      'base': '0.5rem', // 8px
      'md': '0.5rem',   // 8px
      'lg': '0.75rem',  // 12px
      'xl': '1rem',     // 16px
      '2xl': '1.5rem',  // 24px
      'full': '9999px',
    },
    
    // 间距系统 - 基于4px网格
    spacing: {
      '0': '0',
      '1': '0.25rem',  // 4px
      '2': '0.5rem',   // 8px
      '3': '0.75rem',  // 12px
      '4': '1rem',     // 16px
      '5': '1.25rem',  // 20px
      '6': '1.5rem',   // 24px
      '8': '2rem',     // 32px
      '10': '2.5rem',  // 40px
      '12': '3rem',    // 48px
      '16': '4rem',    // 64px
      '20': '5rem',    // 80px
      '24': '6rem',    // 96px
      '32': '8rem',    // 128px
    },
    
    // 阴影系统 - 使用灰色作为默认
    boxShadow: {
      'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      'base': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      // 彩色阴影作为特殊效果
      'pink': '0 10px 15px -3px rgb(251 114 153 / 0.4), 0 4px 6px -4px rgb(251 114 153 / 0.1)',
      'blue': '0 10px 15px -3px rgb(14 165 233 / 0.4), 0 4px 6px -4px rgb(14 165 233 / 0.1)',
    },
    
    // 动画系统
    transitionDuration: {
      'fast': '150ms',
      'normal': '300ms',
      'slow': '500ms',
      'slower': '800ms',
    },
    
    transitionTimingFunction: {
      'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      'swift': 'cubic-bezier(0.4, 0, 0.6, 1)',
      'snappy': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    },
  },
  
  // 自定义规则
  rules: [
    // 渐变背景
    ['bg-bilibili-gradient', {
      'background': 'linear-gradient(135deg, #fb7299 0%, #f48fb1 100%)',
    }],
    ['bg-bilibili-soft', {
      'background': 'linear-gradient(135deg, #fef7f7 0%, #fdeaea 100%)',
    }],
    ['bg-bilibili-vibrant', {
      'background': 'linear-gradient(135deg, #fb7299 0%, #e91e63 100%)',
    }],
    ['bg-sky-gradient', {
      'background': 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
    }],
    ['bg-sky-soft', {
      'background': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    }],
    
    // 玻璃效果
    ['glass-bilibili', {
      'background': 'rgba(251, 114, 153, 0.1)',
      'backdrop-filter': 'blur(20px)',
      'border': '1px solid rgba(251, 114, 153, 0.2)',
    }],
    ['glass-sky', {
      'background': 'rgba(14, 165, 233, 0.1)',
      'backdrop-filter': 'blur(20px)',
      'border': '1px solid rgba(14, 165, 233, 0.2)',
    }],
    ['glass-white', {
      'background': 'rgba(255, 255, 255, 0.8)',
      'backdrop-filter': 'blur(20px)',
      'border': '1px solid rgba(255, 255, 255, 0.2)',
    }],
    
    // 发光效果
    ['glow-bilibili', {
      'box-shadow': '0 0 20px rgba(251, 114, 153, 0.5)',
    }],
    ['glow-sky', {
      'box-shadow': '0 0 20px rgba(14, 165, 233, 0.5)',
    }],
    ['glow-mint', {
      'box-shadow': '0 0 20px rgba(34, 197, 94, 0.5)',
    }],
    ['glow-violet', {
      'box-shadow': '0 0 20px rgba(168, 85, 247, 0.5)',
    }],
    
    // 悬停效果
    ['hover-bilibili', {
      'transition': 'all 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    }],
    ['hover-float', {
      'transition': 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      'transform': 'translateY(-2px)',
    }],
    
    // 动画效果
    ['animate-bounce-in', {
      'animation': 'bounceIn 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    }],
    ['animate-fade-in-up', {
      'animation': 'fadeInUp 500ms cubic-bezier(0.4, 0, 0.2, 1)',
    }],
  ],
  
  // 快捷方式
  shortcuts: {
    // 按钮样式
    'btn-bilibili': 'px-6 py-3 bg-bilibili-gradient text-white rounded-lg font-medium transition-all duration-normal hover:shadow-pink hover:scale-105 active:scale-95',
    'btn-bilibili-outline': 'px-6 py-3 bg-transparent text-bilibili-500 border-2 border-bilibili-500 rounded-lg font-medium transition-all duration-normal hover:bg-bilibili-500 hover:text-white hover:shadow-pink',
    'btn-sky': 'px-6 py-3 bg-sky-gradient text-white rounded-lg font-medium transition-all duration-normal hover:shadow-blue hover:scale-105 active:scale-95',
    'btn-cute': 'px-6 py-3 bg-bilibili-100 text-bilibili-700 rounded-full font-medium transition-all duration-normal hover:bg-bilibili-200 hover-float',
    
    // 卡片样式
    'card-bilibili': 'glass-white rounded-2xl p-6 transition-all duration-normal hover-float',
    'card-bilibili-pink': 'glass-bilibili rounded-2xl p-6 transition-all duration-normal hover-bilibili',
    'card-sky': 'glass-sky rounded-2xl p-6 transition-all duration-normal hover-float',
    
    // 输入框样式
    'input-bilibili': 'w-full px-4 py-3 bg-white border-2 border-bilibili-200 rounded-lg text-gray-800 placeholder-gray-400 transition-all duration-normal focus:border-bilibili-500 focus:glow-bilibili focus:outline-none',
    
    // 标签样式
    'tag-bilibili': 'px-3 py-1 bg-bilibili-100 text-bilibili-700 rounded-full text-sm font-medium',
    'tag-sky': 'px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium',
    'tag-mint': 'px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium',
    
    // 文本样式
    'text-bilibili': 'text-bilibili-500 font-medium',
    'text-gradient-bilibili': 'bg-gradient-to-r from-bilibili-500 to-bilibili-600 bg-clip-text text-transparent font-bold',
    
    // 布局样式
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    'grid-bilibili': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    
    // 动画样式
    'animate-bilibili': 'animate-bounce-in',
    'animate-float': 'animate-fade-in-up',
  },
  
  // 安全列表
  safelist: [
    'bg-bilibili-gradient',
    'bg-bilibili-soft',
    'bg-sky-gradient',
    'glass-bilibili',
    'glass-sky',
    'glass-white',
    'glow-bilibili',
    'glow-sky',
    'hover-bilibili',
    'hover-float',
  ],
})