/** @file theme.js — 深色模式状态管理，View Transition API 圆形扩散动画 */
import { ref, watchEffect, nextTick } from 'vue'

const isDark = ref(localStorage.getItem('theme') === 'dark')

// 初始化：同步 DOM class 和 localStorage
watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
})

export function useTheme() {
  /**
   * 切换深色/浅色模式。
   * 优先使用 View Transition API（Chromium 111+ / Electron）实现从点击位置
   * 圆形扩散的过渡动画；不支持时回退为直接切换。
   * @param {MouseEvent} [event] - 点击事件，用于获取圆形扩散的原点坐标
   */
  const toggle = async (event) => {
    // 支持 View Transition API（Chromium 111+ / Electron）
    if (document.startViewTransition) {
      const x = event?.clientX ?? window.innerWidth / 2
      const y = event?.clientY ?? window.innerHeight / 2
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )

      const transition = document.startViewTransition(() => {
        isDark.value = !isDark.value
      })

      await transition.ready

      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ]

      // 新主题始终从按钮位置圆形扩散
      document.documentElement.animate(
        { clipPath },
        {
          duration: 500,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    } else {
      // 回退：直接切换
      isDark.value = !isDark.value
    }
  }

  return { isDark, toggle }
}
