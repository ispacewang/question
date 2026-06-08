// composables/useAiMode.js — AI 模式状态管理
import { ref, computed } from 'vue'
import axios from 'axios'

const BASE = 'http://localhost:13002/api/ai'

// 全局单例
const aiMode = ref(localStorage.getItem('quiz-ai-mode') === 'ai')
const apiConfigured = ref(false)
const apiKeyMasked = ref('')
const checking = ref(false)

export function useAiMode() {

  const isAiMode = computed(() => aiMode.value)

  /**
   * 检测后端 API Key 配置状态
   * @async
   */
  async function checkConfig() {
    checking.value = true
    try {
      const res = await axios.get(`${BASE}/config`)
      apiConfigured.value = res.data.configured
      apiKeyMasked.value = res.data.apiKey || ''
    } catch {
      apiConfigured.value = false
    } finally {
      checking.value = false
    }
  }

  /**
   * 保存 DeepSeek API Key 到后端
   * @async
   * @param {string} apiKey - DeepSeek API Key
   */
  async function saveApiKey(apiKey) {
    const res = await axios.post(`${BASE}/config`, {
      apiKey,
      provider: 'deepseek',
    })
    if (res.data.ok) {
      apiConfigured.value = true
    }
  }

  /**
   * 切换 AI 模式 / 离线模式，并持久化到 localStorage
   */
  function toggleMode() {
    aiMode.value = !aiMode.value
    localStorage.setItem('quiz-ai-mode', aiMode.value ? 'ai' : 'offline')
  }

  return {
    aiMode,
    isAiMode,
    apiConfigured,
    apiKeyMasked,
    checking,
    checkConfig,
    saveApiKey,
    toggleMode,
  }
}
