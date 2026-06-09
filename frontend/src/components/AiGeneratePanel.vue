<!-- AiGeneratePanel.vue — AI 生成题库面板 -->
<template>
  <div class="flex flex-col gap-4">
    <!-- 模式指示 -->
    <div class="flex items-center gap-2 px-3 py-2 bg-primary/5 border-l-2 border-primary">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-primary"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span class="text-xs font-medium text-primary">AI 生成模式</span>
      <span class="text-[10px] text-muted-foreground ml-auto">Beta</span>
    </div>

    <!-- 生成配置 -->
    <div class="flex items-end gap-3">
      <div class="flex-1 space-y-1.5">
        <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">主题</label>
        <input v-model="topic" placeholder="如：铁路信号安全、高压电气…" class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary transition-colors" />
      </div>
      <div class="w-28 space-y-1.5">
        <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">题数</label>
        <input v-model.number="total" type="number" min="10" max="2000" step="10" class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary transition-colors" />
      </div>
    </div>
    <!-- 模型选择 -->
    <div class="space-y-1.5">
      <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">模型</label>
      <select v-model="genModel" class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary transition-colors appearance-none" style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>'); background-repeat: no-repeat; background-position: right 10px center;">
        <option v-for="m in genModels" :key="m.id" :value="m.id">{{ m.name || m.id }}</option>
      </select>
    </div>

    <!-- 进度 -->
    <div v-if="status" class="space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="text-muted-foreground flex items-center gap-1">
          <template v-if="status.done">
            <CircleCheck class="size-3.5 text-success" />
            已生成 {{ status.count }} 题 → 题库「{{ status.bankName }}」
          </template>
          <template v-else-if="status.error">
            <CircleX class="size-3.5 text-destructive" />
            {{ status.error }}
          </template>
          <template v-else>
            <Loader class="size-3.5 animate-spin text-primary" />
            生成中… {{ status.progress || 0 }} / {{ status.total || 500 }}
          </template>
        </span>
        <span v-if="status.running" class="text-primary"><Loader class="size-3.5 animate-spin" /></span>
      </div>
      <div v-if="status.running" class="w-full h-1 bg-muted overflow-hidden">
        <div class="h-full bg-primary transition-all duration-300" :style="{ width: ((status.progress / status.total) * 100) + '%' }" />
      </div>
    </div>

    <div class="flex gap-2">
      <button @click="startGenerate" :disabled="generating || !topic.trim()" class="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
        <svg v-if="generating" class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="30 70"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
        {{ generating ? '生成中…' : '生成题库' }}
      </button>
    </div>
  </div>
</template>

<script setup>
/** @file AiGeneratePanel.vue — AI 生成题库面板（独立组件，已被 BankSelector 内联替代） */
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import axios from 'axios'
import { useAiMode } from '../composables/useAiMode'
import { CircleCheck, CircleX, Loader } from 'lucide-vue-next'

const { selectedModel, availableModels } = useAiMode()

const emit = defineEmits(['generated'])

const topic = ref('')
const total = ref(500)
const generating = ref(false)
const status = ref(null)
const genModel = ref(selectedModel.value || 'deepseek-v4-pro')
const genModels = computed(() => availableModels.value.length ? availableModels.value : [{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }, { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }])
let pollTimer = null

/**
 * 发起 AI 生成题库请求
 * @async
 */
async function startGenerate() {
  if (!topic.value.trim()) return
  generating.value = true
  status.value = { running: true, progress: 0, total: total.value }
  try {
    const res = await axios.post('http://localhost:13002/api/ai/generate', {
      topic: topic.value,
      total: total.value,
      model: genModel.value,
    })
    if (res.data.ok) {
      toast.success('开始生成题库…')
      pollStatus()
    }
  } catch (e) {
    status.value = { error: e.response?.data?.error || '请求失败' }
    generating.value = false
  }
}

/**
 * 轮询 AI 生成进度，每 3 秒查询一次，完成后触发 generated 事件
 * @async
 */
async function pollStatus() {
  try {
    const res = await axios.get('http://localhost:13002/api/ai/status')
    status.value = res.data
    if (res.data.running) {
      pollTimer = setTimeout(pollStatus, 3000)
    } else {
      generating.value = false
      if (res.data.done) {
        toast.success(`题库「${res.data.bankName}」已生成 ${res.data.count} 题`)
        emit('generated', res.data.bankName)
        topic.value = ''
      } else if (res.data.error) {
        toast.error(res.data.error)
      }
    }
  } catch {
    generating.value = false
    toast.error('查询进度失败')
  }
}
</script>
