<script setup>
/** @file TitleBar.vue — 自定义标题栏，Mica磨玻璃效果，深色模式切换+窗口控制 */
import { ref, onMounted } from 'vue'
import { Minus, Square, X, Moon, Sun, RotateCcw, Download } from 'lucide-vue-next'
import { useTheme } from '@/stores/theme'

const { isDark, toggle } = useTheme()
const isMaximized = ref(false)
const version = ref('')
const updateState = ref({ status: 'idle' })

const min = () => window.electronAPI?.minimizeWindow()
const max = () => window.electronAPI?.maximizeWindow()
const close = () => window.electronAPI?.closeWindow()
const restartUpdate = () => window.electronAPI?.restartAndInstallUpdate()

onMounted(async () => {
  window.electronAPI?.onWindowStateChanged((max) => { isMaximized.value = max })
  window.electronAPI?.onUpdateStateChanged((state) => { updateState.value = state || { status: 'idle' } })
  version.value = await window.electronAPI?.getVersion() || ''
  updateState.value = await window.electronAPI?.getUpdateState?.() || { status: 'idle' }
})
</script>

<template>
  <header
    class="flex items-center justify-between h-[44px] flex-shrink-0 select-none transition-colors"
    style="-webkit-app-region: drag; background: rgba(74, 125, 191, 0.12); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border-bottom: 1px solid var(--color-border);"
  >
    <!-- 左侧 -->
    <div class="flex items-center gap-2.5 pl-3">
      <img src="/favicon1.ico" alt="icon" class="w-5 h-5" />
      <span class="text-[14px] font-semibold text-foreground tracking-tight">Quesora</span>
    </div>

    <!-- 右侧 -->
    <div class="flex items-center" style="-webkit-app-region: no-drag;">
      <button
        v-if="updateState.status === 'downloaded'"
        class="h-[24px] inline-flex items-center gap-1 px-2 mr-1 text-[10px] font-medium text-primary border border-primary/30 bg-primary/10 hover:bg-primary/15 transition-colors"
        @click="restartUpdate"
        title="重启并安装更新"
      >
        <RotateCcw class="w-3 h-3" />
        重启更新
      </button>
      <span
        v-else-if="updateState.status === 'checking' || updateState.status === 'downloading' || updateState.status === 'installing'"
        class="h-[24px] inline-flex items-center gap-1 px-2 mr-1 text-[10px] text-muted-foreground/70"
        :title="updateState.status === 'downloading' ? `正在下载更新 ${updateState.progress || 0}%` : updateState.status === 'installing' ? '正在重启并安装更新' : '正在检查更新'"
      >
        <Download class="w-3 h-3 animate-pulse" />
        {{ updateState.status === 'downloading' ? `${updateState.progress || 0}%` : updateState.status === 'installing' ? '正在重启' : '检查更新' }}
      </span>
      <span v-if="version" class="text-[10px] text-muted-foreground/60 mr-1 font-mono">v{{ version }}</span>
      <!-- 深色模式切换 -->
      <button
        data-tour="theme-btn"
        class="w-[36px] h-[44px] flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
        @click="toggle($event)"
        :title="isDark ? '浅色模式' : '深色模式'"
      >
        <Sun v-if="isDark" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>

      <!-- 窗口控制 -->
      <button
        class="w-[46px] h-[44px] flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
        @click="min"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <button
        class="w-[46px] h-[44px] flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
        @click="max"
      >
        <Square class="w-3 h-3" />
      </button>
      <button
        class="w-[46px] h-[44px] flex items-center justify-center text-foreground/50 hover:text-white hover:bg-destructive/70 transition-colors"
        @click="close"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </header>
</template>
