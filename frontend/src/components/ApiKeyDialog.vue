<!-- ApiKeyDialog.vue — API Key 输入弹窗 -->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="w-[400px] bg-background border border-border shadow-2xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">🔑 配置 DeepSeek API</span>
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
                @keydown.enter="save"
              />
            </div>

            <p v-if="error" class="text-xs text-destructive">{{ error }}</p>

            <div class="flex justify-end gap-2 pt-2">
              <button @click="$emit('close')" class="px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors">取消</button>
              <button @click="save" :disabled="!key.trim()" class="px-4 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">保存并启用</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/** @file ApiKeyDialog.vue — DeepSeek API Key 配置弹窗 */
import { ref } from 'vue'

defineProps({ open: Boolean })
const emit = defineEmits(['close', 'saved'])

const key = ref('')
const error = ref('')

/**
 * 保存 API Key：调用 useAiMode().saveApiKey 写入后端，成功后触发 saved 事件
 */
async function save() {
  if (!key.value.trim()) return
  error.value = ''
  try {
    const { useAiMode } = await import('../composables/useAiMode')
    const { saveApiKey } = useAiMode()
    await saveApiKey(key.value.trim())
    emit('saved')
  } catch (e) {
    error.value = e.response?.data?.error || e.message || '保存失败'
  }
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active > div, .modal-fade-leave-active > div { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-fade-enter-from > div { transform: scale(0.96) translateY(8px); }
.modal-fade-leave-to > div { transform: scale(0.96) translateY(8px); }
</style>
