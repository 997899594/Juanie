/**
 * 现代化主题管理 Composable
 */
import { usePreferredColorScheme, useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { ThemeMode, ThemePackage, ThemePreset } from '../types'

export function useTheme() {
  console.log('🎯 useTheme initialized - 2025 Optimized')

  // 🎯 核心状态
  const customThemes = useStorage<ThemePreset[]>('custom-themes', [])
  const currentPreset = useStorage<string>('theme-preset', 'default')
  const currentMode = useStorage<ThemeMode>('theme-mode', 'system')

  // 🎯 系统偏好
  const systemPreference = usePreferredColorScheme()

  // 🎯 计算属性
  const resolvedMode = computed<'light' | 'dark'>(() => {
    if (currentMode.value === 'system') {
      return systemPreference.value === 'dark' ? 'dark' : 'light'
    }
    return currentMode.value
  })

  const isDark = computed(() => resolvedMode.value === 'dark')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 🎯 智能主题应用
  const applyCustomTheme = (theme: ThemePreset) => {
    console.log('🎨 Applying custom theme:', theme.name)

    const root = document.documentElement
    const variant = resolvedMode.value === 'dark' ? theme.variants.dark : theme.variants.light
    const colors = variant?.colors

    if (colors) {
      Object.entries(colors).forEach(([key, value]) => {
        const cssVar = `--color-${key}`
        const cssValue =
          typeof value === 'string' && value.includes('oklch') ? value : `oklch(${value})`
        root.style.setProperty(cssVar, cssValue)
      })

      root.setAttribute('data-theme', theme.id)
      console.log('🎉 Custom theme applied successfully')
    }
  }

  // 🎯 核心方法
  const setTheme = (themeId: string) => {
    console.log('🎯 setTheme:', themeId)

    if (!themeId) {
      console.warn('⚠️ setTheme: themeId is required')
      return
    }

    currentPreset.value = themeId

    // 智能判断主题类型
    if (themeId.startsWith('custom-') || themeId.startsWith('inline-')) {
      const customTheme = customThemes.value.find((t) => t.id === themeId)
      if (customTheme) {
        applyCustomTheme(customTheme)
      }
    } else {
      // 内置主题通过 CSS 切换
      document.documentElement.setAttribute('data-theme', themeId)
    }
  }

  const createCustomTheme = (baseThemeId: string, customName: string): string => {
    console.log('🎯 createCustomTheme:', { baseThemeId, customName })

    if (!baseThemeId || !customName?.trim()) {
      throw new Error('baseThemeId 和 customName 都是必需的')
    }

    const newTheme: ThemePreset = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      description: `基于 ${baseThemeId} 的自定义主题`,
      source: 'custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variants: {
        light: {
          id: `custom-${Date.now()}-light`,
          name: `${customName} 浅色`,
          colors: {
            // 基于基础主题的颜色
            background: '100% 0 0',
            foreground: '15% 0.02 260',
            card: '100% 0 0',
            'card-foreground': '15% 0.02 260',
            popover: '100% 0 0',
            'popover-foreground': '15% 0.02 260',
            primary: '68% 0.4 340',
            'primary-foreground': '100% 0 0',
            secondary: '98% 0.02 340',
            'secondary-foreground': '15% 0.02 260',
            muted: '97% 0.01 260',
            'muted-foreground': '45% 0.02 260',
            accent: '95% 0.05 340',
            'accent-foreground': '15% 0.02 260',
            destructive: '55% 0.8 15',
            'destructive-foreground': '100% 0 0',
            success: '50% 0.6 140',
            'success-foreground': '100% 0 0',
            warning: '60% 0.8 45',
            'warning-foreground': '15% 0.02 260',
            info: '55% 0.7 200',
            'info-foreground': '100% 0 0',
            border: '94% 0.02 340',
            input: '94% 0.02 340',
            ring: '68% 0.4 340',
          },
        },
        dark: {
          id: `custom-${Date.now()}-dark`,
          name: `${customName} 深色`,
          colors: {
            background: '8% 0.01 260',
            foreground: '95% 0.01 260',
            card: '12% 0.01 260',
            'card-foreground': '95% 0.01 260',
            popover: '8% 0.01 260',
            'popover-foreground': '95% 0.01 260',
            primary: '72% 0.45 340',
            'primary-foreground': '8% 0.01 260',
            secondary: '18% 0.02 260',
            'secondary-foreground': '95% 0.01 260',
            muted: '18% 0.02 260',
            'muted-foreground': '70% 0.02 260',
            accent: '25% 0.05 340',
            'accent-foreground': '95% 0.01 260',
            destructive: '50% 0.7 15',
            'destructive-foreground': '95% 0.01 260',
            success: '45% 0.5 140',
            'success-foreground': '95% 0.01 260',
            warning: '55% 0.7 45',
            'warning-foreground': '8% 0.01 260',
            info: '50% 0.6 200',
            'info-foreground': '95% 0.01 260',
            border: '25% 0.02 260',
            input: '25% 0.02 260',
            ring: '72% 0.45 340',
          },
        },
      },
    }

    customThemes.value = [...customThemes.value, newTheme]
    console.log('✅ Theme created:', newTheme.id)

    return newTheme.id
  }

  const exportThemeAsFile = (): boolean => {
    try {
      console.log('🎯 exportThemeAsFile')

      const themePackage: ThemePackage = {
        meta: {
          name: '导出的主题包',
          version: '1.0.0',
          author: 'Juanie UI 2025',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        themes: customThemes.value,
      }

      const blob = new Blob([JSON.stringify(themePackage, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `themes-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('✅ Theme exported')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('❌ Export failed:', errorMessage)
      error.value = `导出失败: ${errorMessage}`
      return false
    }
  }

  const importThemeFromFile = async (file: File): Promise<boolean> => {
    console.log('🎯 importThemeFromFile:', file.name)

    try {
      const text = await file.text()
      const data = JSON.parse(text) as ThemePackage

      if (data.themes && Array.isArray(data.themes)) {
        // 验证主题数据结构
        const validThemes = data.themes.filter((theme) => theme.id && theme.name && theme.variants)

        if (validThemes.length > 0) {
          customThemes.value = [...customThemes.value, ...validThemes]
          console.log('✅ Themes imported:', validThemes.length)
          return true
        } else {
          throw new Error('没有找到有效的主题数据')
        }
      } else {
        throw new Error('文件格式不正确')
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      console.error('❌ Import failed:', errorMessage)
      error.value = `导入失败: ${errorMessage}`
      return false
    }
  }

  const deleteCustomTheme = (themeId: string): boolean => {
    console.log('🗑️ deleteCustomTheme:', themeId)

    if (!themeId) {
      console.warn('⚠️ deleteCustomTheme: themeId is required')
      return false
    }

    const initialLength = customThemes.value.length
    customThemes.value = customThemes.value.filter((t) => t.id !== themeId)

    const deleted = customThemes.value.length < initialLength
    if (deleted && currentPreset.value === themeId) {
      // 如果删除的是当前主题，切换到默认主题
      setTheme('default')
    }

    return deleted
  }

  const toggleMode = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(currentMode.value)
    const nextIndex = (currentIndex + 1) % modes.length
    currentMode.value = modes[nextIndex]
    console.log('🌙 toggleMode:', currentMode.value)
  }

  const clearError = () => {
    error.value = null
  }

  // 🎯 监听主题变化并自动应用
  watch(
    [currentPreset, resolvedMode],
    ([newPreset, newMode], [oldPreset, oldMode]) => {
      if (newPreset !== oldPreset || newMode !== oldMode) {
        console.log('Theme changed:', {
          preset: { old: oldPreset, new: newPreset },
          mode: { old: oldMode, new: newMode },
        })
        setTheme(newPreset)
      }
    },
    { immediate: true },
  )

  console.log('✅ useTheme setup complete - 2025 Optimized')

  return {
    // 状态
    customThemes,
    currentPreset,
    currentMode,
    resolvedMode,
    isDark,
    isLoading,
    error,

    // 方法
    setTheme,
    toggleMode,
    clearError,
    createCustomTheme,
    exportThemeAsFile,
    importThemeFromFile,
    deleteCustomTheme,
  }
}

export type UseThemeReturn = ReturnType<typeof useTheme>
