<!-- ApiKeyDialog.vue — API Key + 模型选择弹窗 -->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <!-- 步骤1：输入 Key -->
        <div v-if="step === 'key'" class="w-[400px] bg-background border border-border shadow-2xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold"><Key class="size-4 inline-block -mt-0.5" /> 配置 DeepSeek API</span>
              <span class="text-[10px] px-1.5 py-0.5 border border-amber-500/30 text-amber-600 bg-amber-500/5 font-medium">Beta</span>
            </div>
            <button @click="$emit('close')" class="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-xs text-muted-foreground leading-relaxed">
              输入 DeepSeek API Key 即可使用 AI 生成题库和智能判题。
              <a href="https://platform.deepseek.com/api_keys" target="_blank" class="text-primary underline underline-offset-2">获取 Key →</a>
            </p>
            <div class="space-y-2">
              <label class="text-xs font-medium">API Key</label>
              <input
                v-model="key"
                type="password"
                placeholder="sk-..."
                class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary transition-colors"
                @keydown.enter="goFetchModels"
              />
            </div>
            <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button @click="$emit('close')" class="px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors">取消</button>
              <button @click="goFetchModels" :disabled="!key.trim() || loading" class="px-4 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
                {{ loading ? '验证中…' : '下一步' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 步骤2：选择模型 -->
        <div v-else-if="step === 'model'" class="w-[400px] bg-background border border-border shadow-2xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold"><Bot class="size-4 inline-block -mt-0.5" /> 选择模型</span>
            </div>
            <button @click="$emit('close')" class="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-xs text-muted-foreground">API Key 已验证。请选择默认模型：</p>

            <div v-if="modelsLoading" class="text-center py-6 text-xs text-muted-foreground">
              <span class="animate-pulse">获取模型列表…</span>
            </div>

            <div v-else class="space-y-1">
              <button
                v-for="m in models"
                :key="m.id"
                @click="onSelectModel(m)"
                class="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border transition-colors"
                :class="selectedId === m.id
                  ? 'border-primary/40 bg-primary/5 text-primary font-medium'
                  : 'border-transparent hover:border-border hover:bg-muted/50'"
              >
                <span class="w-2 h-2 flex-shrink-0"
                  :class="selectedId === m.id ? 'bg-primary' : 'border border-muted-foreground/30'" />
                <span class="flex-1">{{ m.name || m.id }}</span>
                <span class="text-[10px] text-muted-foreground font-mono">{{ m.id }}</span>
              </button>
            </div>
          </div>
          <div class="px-5 py-4 border-t border-border/50 flex justify-end">
            <button @click="finish" :disabled="!selectedId" class="px-4 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
              完成
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { Key, Bot } from 'lucide-vue-next'

defineProps({ open: Boolean })
const emit = defineEmits(['close', 'saved'])

const step = ref('key')
const key = ref('')
const error = ref('')
const loading = ref(false)
const selectedId = ref('')
const models = ref([])
const modelsLoading = ref(false)

async function goFetchModels() {
  if (!key.value.trim()) return
  error.value = ''
  loading.value = true
  try {
    const { useAiMode } = await import('../composables/useAiMode')
    const { saveApiKey, fetchModelList, selectedModel } = useAiMode()
    await saveApiKey(key.value.trim())
    step.value = 'model'
    selectedId.value = selectedModel.value || 'deepseek-v4-pro'
    modelsLoading.value = true
    const list = await fetchModelList()
    models.value = list
  } catch (e) {
    error.value = e.response?.data?.error || e.message || '验证失败'
  } finally {
    loading.value = false
    modelsLoading.value = false
  }
}

async function onSelectModel(m) {
  selectedId.value = m.id
}

async function finish() {
  if (selectedId.value) {
    const { useAiMode } = await import('../composables/useAiMode')
    const { selectModel } = useAiMode()
    await selectModel(selectedId.value)
  }
  emit('saved')
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active > div, .modal-fade-leave-active > div { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-fade-enter-from > div { transform: scale(0.96) translateY(8px); }
.modal-fade-leave-to > div { transform: scale(0.96) translateY(8px); }
</style>
