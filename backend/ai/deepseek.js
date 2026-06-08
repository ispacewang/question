// backend/ai/deepseek.js — DeepSeek API 封装 (v4)
const https = require('https');

const API_HOST = 'api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-pro';

/** 推荐模型列表（优先显示） */
const RECOMMENDED_MODELS = [
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
];

/**
 * 调用 DeepSeek Chat API (OpenAI 兼容格式)
 * @param {string} apiKey
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} opts — { temperature, max_tokens, model }
 * @returns {Promise<string>} 助手回复文本
 */
function chat(apiKey, messages, opts = {}) {
  const { temperature = 0.7, max_tokens = 4096, model = DEFAULT_MODEL } = opts;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    });

    const req = https.request({
      hostname: API_HOST,
      path: '/v1/chat/completions',
      method: 'POST',
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'API 错误'));
            return;
          }
          const content = json.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) {
          reject(new Error(`解析响应失败: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('API 请求超时')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 获取可用模型列表
 * @param {string} apiKey
 * @returns {Promise<Array<{id:string, name:string}>>}
 */
function fetchModels(apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: API_HOST,
      path: '/v1/models',
      method: 'GET',
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            // API 不支持 /v1/models 时返回推荐列表
            resolve(RECOMMENDED_MODELS);
            return;
          }
          const models = (json.data || [])
            .filter(m => m.id && (m.id.startsWith('deepseek')))
            .map(m => ({ id: m.id, name: m.id }));

          // 推荐模型优先，再拼接其余
          const seen = new Set(RECOMMENDED_MODELS.map(m => m.id));
          const rest = models.filter(m => !seen.has(m.id));
          resolve([...RECOMMENDED_MODELS, ...rest]);
        } catch (e) {
          resolve(RECOMMENDED_MODELS);
        }
      });
    });

    req.on('timeout', () => { req.destroy(); resolve(RECOMMENDED_MODELS); });
    req.on('error', () => resolve(RECOMMENDED_MODELS));
    req.end();
  });
}

module.exports = { chat, fetchModels, DEFAULT_MODEL, RECOMMENDED_MODELS };
