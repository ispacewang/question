// src/composables/useAiChat.js
// AI 答疑对话 — 管理对话状态，注入当前题目上下文

import { ref, computed } from 'vue'
import { buildQAPrompt, buildFirstQAPrompt } from '../ai/prompts'
import { loadModel, generate, onAIProgress } from '../ai/service'

export function useAiChat() {
  const messages = ref([])        // { role: 'user'|'assistant', content: string }
  const loading = ref(false)
  const progressMsg = ref('')
  const error = ref('')
  const visible = ref(false)
  const input = ref('')

  // 当前题目上下文
  const questionContext = ref(null)

  onAIProgress((msg) => {
    progressMsg.value = msg
  })

  const canSend = computed(() => input.value.trim().length > 0 && !loading.value)

  /**
   * 设置题目上下文并打开面板
   */
  function openWithContext(ctx) {
    questionContext.value = ctx
    messages.value = []
    visible.value = true
  }

  /**
   * 发送消息
   */
  async function send() {
    const text = input.value.trim()
    if (!text) return

    input.value = ''
    messages.value.push({ role: 'user', content: text })
    loading.value = true
    error.value = ''

    try {
      await loadModel()

      const isFirst = messages.value.length === 1 && questionContext.value
      const prompt = isFirst
        ? buildFirstQAPrompt(questionContext.value)
        : buildQAPrompt(questionContext.value || {}, messages.value.slice(0, -1))

      const fullPrompt = prompt + text
      const result = await generate(fullPrompt, 256)

      if (result) {
        messages.value.push({ role: 'assistant', content: result })
      }
    } catch (e) {
      error.value = e.message || '请求失败'
    } finally {
      loading.value = false
    }
  }

  /**
   * 关闭面板
   */
  function close() {
    visible.value = false
    messages.value = []
    questionContext.value = null
    input.value = ''
  }

  /**
   * 切换面板
   */
  function toggle(ctx) {
    if (visible.value) {
      close()
    } else {
      openWithContext(ctx)
    }
  }

  return {
    messages,
    loading,
    progressMsg,
    error,
    visible,
    input,
    canSend,
    questionContext,
    openWithContext,
    send,
    close,
    toggle,
  }
}
