// composables/useAiMode.js — AI 模式 + 模型选择状态管理
import { ref, computed } from 'vue'
import axios from 'axios'

const BASE = 'http://localhost:13002/api/ai'

// 全局单例状态
const aiMode = ref(localStorage.getItem('quiz-ai-mode') === 'ai')
const apiConfigured = ref(false)
const apiKeyMasked = ref('')
const checking = ref(false)
const selectedModel = ref(localStorage.getItem('quiz-ai-model') || '')
const availableModels = ref([])
const modelsLoading = ref(false)

export function useAiMode() {

  const isAiMode = computed(() => aiMode.value)

  /** 检测 API 配置状态 */
  async function checkConfig() {
    checking.value = true
    try {
      const res = await axios.get(`${BASE}/config`)
      apiConfigured.value = res.data.configured
      apiKeyMasked.value = res.data.apiKey || ''
      // 回填已保存的模型
      if (res.data.model && !selectedModel.value) {
        selectedModel.value = res.data.model
        localStorage.setItem('quiz-ai-model', res.data.model)
      }
    } catch {
      apiConfigured.value = false
    } finally {
      checking.value = false
    }
  }

  /** 保存 API Key */
  async function saveApiKey(apiKey) {
    const res = await axios.post(`${BASE}/config`, {
      apiKey,
      provider: 'deepseek',
      model: selectedModel.value || undefined,
    })
    if (res.data.ok) {
      apiConfigured.value = true
      if (res.data.model && !selectedModel.value) {
        selectedModel.value = res.data.model
        localStorage.setItem('quiz-ai-model', res.data.model)
      }
    }
  }

  /** 获取可用模型列表 */
  async function fetchModelList() {
    modelsLoading.value = true
    try {
      const res = await axios.get(`${BASE}/models`)
      availableModels.value = res.data.models || []
      if (res.data.current && !selectedModel.value) {
        selectedModel.value = res.data.current
        localStorage.setItem('quiz-ai-model', res.data.current)
      }
      return availableModels.value
    } catch {
      availableModels.value = []
      return []
    } finally {
      modelsLoading.value = false
    }
  }

  /** 切换模型（全局） */
  async function selectModel(modelId) {
    selectedModel.value = modelId
    localStorage.setItem('quiz-ai-model', modelId)
    // 同步到后端
    try {
      await axios.put(`${BASE}/config/model`, { model: modelId })
    } catch { /* 静默 */ }
  }

  /** 切换 AI 模式 */
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
    selectedModel,
    availableModels,
    modelsLoading,
    checkConfig,
    saveApiKey,
    fetchModelList,
    selectModel,
    toggleMode,
  }
}
