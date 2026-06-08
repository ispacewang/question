// src/ai/service.js — AI 服务层
// 封装 Worker 通信，提供简洁的 async API
// 支持多模型选择、进度回调

let worker = null
let pendingRequests = new Map()
let requestId = 0
let loadPromise = null

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, type, payload } = e.data

      if (type === 'progress' && onProgress) {
        onProgress(payload)
        return
      }

      if (id == null) return

      const pending = pendingRequests.get(id)
      if (!pending) return

      pendingRequests.delete(id)

      if (type === 'error') {
        pending.reject(new Error(payload))
      } else {
        pending.resolve({ type, payload })
      }
    }
  }
  return worker
}

/**
 * 发送消息给 Worker
 */
function send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    pendingRequests.set(id, { resolve, reject })
    getWorker().postMessage({ id, type, payload })
  })
}

let onProgress = null

/**
 * 设置进度回调
 * @param {(msg: string) => void} cb
 */
export function onAIProgress(cb) {
  onProgress = cb
}

// ============================================================
// 模型管理
// ============================================================

/**
 * 获取可用模型列表
 * @returns {Promise<Record<string, {name:string, label:string}>>}
 */
export async function getAvailableModels() {
  const result = await send('getAvailableModels')
  return result.payload
}

/**
 * 切换模型
 * @param {'0.5B'|'1.5B'} modelKey
 */
export async function setModel(modelKey) {
  modelLoaded = false
  loadPromise = null
  const result = await send('setModel', { modelKey })
  return result.payload
}

// ============================================================
// 模型加载
// ============================================================

let modelLoaded = false

/**
 * 加载当前选定的模型（幂等）
 * @param {string} [modelKey] 可选指定模型
 */
export async function loadModel(modelKey) {
  // 如果要切换模型，先 setModel
  if (modelKey) {
    await setModel(modelKey)
  }

  if (loadPromise) return loadPromise

  loadPromise = send('load', { modelKey }).then(() => {
    modelLoaded = true
    return true
  }).catch(err => {
    loadPromise = null
    modelLoaded = false
    throw err
  })

  return loadPromise
}

// ============================================================
// 推理
// ============================================================

/**
 * 文本生成
 * @param {string} text - 提示词
 * @param {number} maxTokens - 最大输出 token
 * @returns {Promise<string>}
 */
export async function generate(text, maxTokens = 256) {
  const result = await send('generate', { text, maxTokens })
  return result.payload
}

/**
 * 检查模型是否已加载
 */
export function isModelLoaded() {
  return loadPromise !== null && modelLoaded
}
