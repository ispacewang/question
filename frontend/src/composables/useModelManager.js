// src/composables/useModelManager.js
// 模型管理：选择、加载、状态追踪

import { ref, computed } from 'vue'
import { getAvailableModels, loadModel, generate, onAIProgress, setModel, isModelLoaded } from '../ai/service'

// 模型信息（与 worker.js 中的 MODEL_REGISTRY 同步）
const MODEL_INFO = {
  '0.5B': {
    key: '0.5B',
    name: 'Qwen2.5 0.5B (轻量)',
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    diskMB: 510,
    ramGB: '1.0 - 1.5',
    speedDesc: '⚡ 快 (10-20 t/s)',
    qualityDesc: '基础中文答疑',
    tier: 'lite',
  },
  '1.5B': {
    key: '1.5B',
    name: 'Qwen2.5 1.5B (标准)',
    repo: 'onnx-community/Qwen2.5-1.5B-Instruct',
    diskMB: 1280,
    ramGB: '2.5 - 3.5',
    speedDesc: '中等 (5-10 t/s)',
    qualityDesc: '良好中文答疑',
    tier: 'standard',
  },
}

export function useModelManager() {
  const currentModel = ref(localStorage.getItem('ai-model') || '0.5B')
  const loading = ref(false)
  const progress = ref('')
  const isReady = ref(false)
  const availableModels = ref({})
  const installedModels = ref([])

  onAIProgress((msg) => { progress.value = msg })

  /**
   * 获取本地安装的模型列表
   */
  async function detectInstalledModels() {
    try {
      const resp = await fetch('http://localhost:13002/api/installed-models')
      if (resp.ok) {
        const data = await resp.json()
        // installed 格式: { 'onnx-community/Qwen2.5-0.5B-Instruct': true, ... }
        const installed = []
        const repoToKey = {}
        for (const [key, info] of Object.entries(MODEL_INFO)) {
          repoToKey[info.repo] = key
        }
        for (const [repo, exists] of Object.entries(data.installed || {})) {
          if (exists && repoToKey[repo]) {
            installed.push(repoToKey[repo])
          }
        }
        installedModels.value = installed
        return installed
      }
    } catch {
      // 服务未启动或不可用
    }
    return []
  }

  /**
   * 初始化：检测已安装模型，加载默认模型
   */
  async function init() {
    await detectInstalledModels()

    // 加载上次使用的模型
    const savedModel = localStorage.getItem('ai-model') || '0.5B'
    try {
      await switchModel(savedModel)
    } catch {
      // 模型加载失败不阻塞启动，用户可手动选择
    }
  }

  /**
   * 切换模型
   */
  async function switchModel(key) {
    if (!MODEL_INFO[key]) throw new Error(`未知模型: ${key}`)

    loading.value = true
    progress.value = ''

    try {
      await loadModel(key)
      currentModel.value = key
      isReady.value = true
      localStorage.setItem('ai-model', key)
    } catch (err) {
      isReady.value = false
      throw err
    } finally {
      loading.value = false
    }
  }

  const currentModelInfo = computed(() => MODEL_INFO[currentModel.value])

  return {
    // 状态
    currentModel,
    currentModelInfo,
    loading,
    progress,
    isReady,
    installedModels,

    // 模型列表
    MODEL_INFO,

    // 方法
    init,
    switchModel,
    detectInstalledModels,
  }
}
