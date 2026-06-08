// src/ai/worker.js — Web Worker: 通过 fetch 拦截实现本地模型加载
// 拦截所有到 huggingface.co 的请求，重定向到本地 Express

import { env, pipeline } from '@xenova/transformers'

// ============================================================
// ONNX Runtime WASM 文件路径 — 不走 CDN
// ============================================================
env.backends.onnx.wasm.wasmPaths = 'http://localhost:13002/wasm/'

// ============================================================
// fetch 拦截：huggingface.co → localhost:13002
// ============================================================

const HF_HOSTS = ['huggingface.co', 'hf.co', 'hf-mirror.com']
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com']
const LOCAL_BASE = 'http://localhost:13002'

const _fetch = self.fetch
self.fetch = function(url, options) {
  const urlStr = typeof url === 'string' ? url : url.url || url.toString()
  remoteLog('fetch-all', { url: urlStr })
  for (const host of [...HF_HOSTS, ...CDN_HOSTS]) {
    if (urlStr.includes(host)) {
      const newUrl = urlStr.replace(/https?:\/\/[^/]+/, LOCAL_BASE)
      remoteLog('fetch-redirect', { from: urlStr, to: newUrl })
      return _fetch(newUrl, options)
    }
  }
  return _fetch(url, options)
}

// ============================================================
// 远程日志 — 写入 Express 后端的 ai-debug.log
// ============================================================
function remoteLog(step, data) {
  try {
    _fetch('http://localhost:13002/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, ...data }),
    }).catch(() => {})
  } catch {}
}

// ============================================================
// 模型配置
// ============================================================

const MODEL_REGISTRY = {
  '0.5B': {
    name: 'onnx-community/Qwen2.5-0.5B-Instruct',
    label: 'Qwen2.5 0.5B (轻量)',
    modelFile: 'model',  // ONNX 文件叫 model_quantized.onnx
  },
  '1.5B': {
    name: 'onnx-community/Qwen2.5-1.5B-Instruct',
    label: 'Qwen2.5 1.5B (标准)',
    modelFile: 'model',
  },
}

const DEFAULT_MODEL_KEY = '0.5B'

let generator = null
let modelLoading = false
let modelLoaded = false
let currentModelKey = DEFAULT_MODEL_KEY
let currentModelName = MODEL_REGISTRY[DEFAULT_MODEL_KEY].name

// ============================================================
// 消息处理
// ============================================================

self.onmessage = async (e) => {
  const { id, type, payload } = e.data

  try {
    switch (type) {
      case 'load':
        await handleLoad(payload)
        self.postMessage({ id, type: 'loaded' })
        break

      case 'generate':
        if (!modelLoaded) await handleLoad(payload)
        const result = await doGenerate(payload.text, payload.maxTokens || 256)
        self.postMessage({ id, type: 'result', payload: result })
        break

      case 'setModel':
        await handleSetModel(payload.modelKey)
        self.postMessage({ id, type: 'modelSet', payload: { modelKey: payload.modelKey } })
        break

      case 'getAvailableModels':
        self.postMessage({ id, type: 'availableModels', payload: MODEL_REGISTRY })
        break

      default:
        self.postMessage({ id, type: 'error', payload: `Unknown type: ${type}` })
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', payload: err.message || String(err) })
  }
}

// ============================================================
// 模型加载
// ============================================================

async function handleLoad(payload) {
  const modelKey = payload?.modelKey || currentModelKey
  const model = MODEL_REGISTRY[modelKey]
  if (!model) throw new Error(`Unknown model: ${modelKey}`)

  if (modelLoaded && modelKey === currentModelKey) return

  currentModelKey = modelKey
  currentModelName = model.name

  if (modelLoading) {
    let attempts = 0
    while (modelLoading && attempts < 300) {
      await new Promise(r => setTimeout(r, 200))
      attempts++
    }
    if (modelLoaded && modelKey === currentModelKey) return
    throw new Error('模型加载超时')
  }

  modelLoading = true
  try {
    remoteLog('load-start', { model: model.label, repo: model.name })
    self.postMessage({ id: null, type: 'progress', payload: `正在加载 ${model.label}...` })

    generator = await pipeline(
      'text-generation',
      model.name,
      {
        model_file_name: model.modelFile || undefined,
        quantized: true,
        progress_callback: (info) => {
          remoteLog('progress', info)
          if (info.status === 'progress') {
            const pct = info.progress ? Math.round(info.progress) : 0
            const file = info.file || ''
            self.postMessage({
              id: null,
              type: 'progress',
              payload: `加载中: ${file ? file.split('/').pop() : ''} ${pct}%`
            })
          }
        }
      }
    )

    modelLoaded = true
    remoteLog('load-done', { model: model.label })
    self.postMessage({ id: null, type: 'progress', payload: `${model.label} 就绪 ✅` })
  } catch (err) {
    remoteLog('load-error', { error: err.message, stack: err.stack })
    throw err
  } finally {
    modelLoading = false
  }
}

async function handleSetModel(modelKey) {
  if (!MODEL_REGISTRY[modelKey]) {
    throw new Error(`未知模型: ${modelKey}。可用: ${Object.keys(MODEL_REGISTRY).join(', ')}`)
  }
  modelLoaded = false
  generator = null
  await handleLoad({ modelKey })
}

// ============================================================
// 文本生成
// ============================================================

async function doGenerate(text, maxTokens) {
  if (!generator) throw new Error('模型未加载')

  const messages = [
    { role: 'system', content: '你是一个学习助手，用中文回复。回答简洁准确，不超过200字。' },
    { role: 'user', content: text }
  ]

  const result = await generator(messages, {
    max_new_tokens: maxTokens,
    temperature: 0.7,
    top_p: 0.9,
    do_sample: true,
  })

  // 兼容多种返回格式
  let raw = result[0]
  let generated = ''
  if (typeof raw === 'string') {
    generated = raw
  } else if (Array.isArray(raw)) {
    // 消息数组 [{role, content}, ...]
    const last = raw[raw.length - 1]
    generated = typeof last === 'string' ? last : (last?.content || '')
  } else if (raw && typeof raw === 'object') {
    generated = raw.generated_text || raw.content || ''
    if (Array.isArray(generated)) {
      const last = generated[generated.length - 1]
      generated = typeof last === 'string' ? last : (last?.content || '')
    }
  }

  // 提取最终文本
  if (typeof generated !== 'string') generated = JSON.stringify(generated)

  const assistantPrefix = '助手: '
  const idx = generated.lastIndexOf(assistantPrefix)
  const answer = idx >= 0
    ? generated.slice(idx + assistantPrefix.length).trim()
    : generated.trim()

  return answer
    .replace(/^你是一个学习助手.*?\s*/g, '')
    .replace(/^用户:.*?\n/g, '')
    .trim()
}
