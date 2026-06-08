<!-- src/components/ModelSelector.vue — AI 模型选择器（首次启动 / 设置页） -->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="w-[520px] max-h-[85vh] overflow-y-auto bg-background border border-border shadow-2xl">
          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div class="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="text-primary">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"/>
                <path d="M12 16c-3.3 0-6 2-6 4.5V22h12v-1.5c0-2.5-2.7-4.5-6-4.5z"/>
                <circle cx="12" cy="22" r="2" fill="currentColor"/>
              </svg>
              <span class="text-sm font-semibold">AI 模型设置</span>
            </div>
            <button
              v-if="step !== 'downloading'"
              @click="$emit('close')"
              class="flex items-center justify-center w-7 h-7 hover:bg-muted transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Step 1: 模型选择 -->
          <div v-if="step === 'select'" class="p-5 space-y-4">
            <p class="text-sm text-muted-foreground">
              选择要使用的 AI 答题助手模型。模型将在本地运行，无需联网。
            </p>

            <div
              v-for="(info, key) in MODEL_INFO" :key="key"
              class="relative border border-border hover:border-primary/50 transition-colors cursor-pointer p-4"
              :class="{ 'border-primary bg-primary/5': selectedModel === key }"
              @click="selectedModel = key"
            >
              <div class="flex items-start gap-3">
                <!-- Radio indicator -->
                <div class="mt-0.5 flex-shrink-0 w-4 h-4 border-2 flex items-center justify-center transition-colors"
                  :class="selectedModel === key ? 'border-primary bg-primary' : 'border-muted-foreground/30'"
                >
                  <svg v-if="selectedModel === key" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold">{{ info.name }}</span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 border font-medium"
                      :class="info.tier === 'standard' ? 'border-amber-500/30 text-amber-600 bg-amber-500/5' : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'"
                    >
                      {{ info.tier === 'standard' ? '推荐' : '轻量' }}
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground mt-1">{{ info.qualityDesc }}</p>

                  <!-- 资源占用条 -->
                  <div class="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div class="flex flex-col">
                      <span class="text-muted-foreground">💾 磁盘</span>
                      <span class="font-medium">{{ info.diskMB >= 1000 ? (info.diskMB / 1000).toFixed(1) + ' GB' : info.diskMB + ' MB' }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-muted-foreground">🧠 内存</span>
                      <span class="font-medium">{{ info.ramGB }} GB</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-muted-foreground">⚡ 速度</span>
                      <span class="font-medium">{{ info.speedDesc }}</span>
                    </div>
                  </div>

                  <!-- 已安装标记 -->
                  <div v-if="installedModels.includes(key)" class="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    已安装，无需下载
                  </div>
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center justify-between pt-2">
              <button
                v-if="!isFirstLaunch"
                @click="$emit('close')"
                class="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                取消
              </button>
              <div v-else />
              <button
                @click="confirmSelection"
                class="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                {{ installedModels.includes(selectedModel) ? '开始使用' : '下载并开始' }}
              </button>
            </div>

            <!-- 底部提示 -->
            <p class="text-[10px] text-muted-foreground/60 text-center">
              可随时在设置中切换模型。AI 推理完全在本地运行，不联网不消耗 API 额度。
            </p>
          </div>

          <!-- Step 2: 下载 / 加载中 -->
          <div v-else-if="step === 'downloading'" class="p-8 flex flex-col items-center justify-center space-y-4">
            <div class="w-12 h-12 border-[3px] border-primary border-t-transparent animate-spin rounded-full" />
            <p class="text-sm font-medium text-foreground">{{ MODEL_INFO[selectedModel]?.name }} 加载中…</p>
            <p class="text-xs text-muted-foreground text-center max-w-[320px]">{{ progress || '正在初始化模型引擎...' }}</p>
            <div class="w-48 h-1 bg-muted overflow-hidden">
              <div class="h-full bg-primary animate-pulse" style="width: 60%" />
            </div>
          </div>

          <!-- Step 3: 完成 -->
          <div v-else-if="step === 'done'" class="p-8 flex flex-col items-center justify-center space-y-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="text-emerald-500">
              <circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-5"/>
            </svg>
            <p class="text-sm font-semibold">模型就绪 ✅</p>
            <p class="text-xs text-muted-foreground">{{ MODEL_INFO[selectedModel]?.name }} 已加载，AI 答疑已可用。</p>
            <button
              @click="$emit('close')"
              class="mt-2 px-6 py-2 bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
            >
              {{ isFirstLaunch ? '开始使用' : '确定' }}
            </button>
          </div>

          <!-- Step 4: 错误 -->
          <div v-else-if="step === 'error'" class="p-8 flex flex-col items-center justify-center space-y-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="text-destructive">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
            </svg>
            <p class="text-sm font-semibold">加载失败</p>
            <p class="text-xs text-muted-foreground text-center max-w-[280px]">{{ errorMsg }}</p>
            <div class="flex gap-2 mt-2">
              <button @click="step = 'select'" class="px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">重选</button>
              <button @click="confirmSelection" class="px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity">重试</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useModelManager } from '../composables/useModelManager'

const props = defineProps({
  open: Boolean,
  isFirstLaunch: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'ready'])

const {
  currentModel,
  loading,
  progress,
  installedModels,
  switchModel,
  detectInstalledModels,
  MODEL_INFO,
} = useModelManager()

const step = ref('select')
const selectedModel = ref(currentModel.value || '1.5B')
const errorMsg = ref('')

// 初始化时检测已安装模型
onMounted(async () => {
  await detectInstalledModels()
  if (installedModels.value.length > 0) {
    selectedModel.value = installedModels.value.includes('1.5B') ? '1.5B' : installedModels.value[0]
  }
})

async function confirmSelection() {
  step.value = 'downloading'
  errorMsg.value = ''

  try {
    await switchModel(selectedModel.value)
    step.value = 'done'
    emit('ready', selectedModel.value)
  } catch (err) {
    errorMsg.value = err.message || '模型加载失败，请检查网络或磁盘空间。'
    step.value = 'error'
  }
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active > div,
.modal-fade-leave-active > div {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-fade-enter-from > div {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
.modal-fade-leave-to > div {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
</style>
