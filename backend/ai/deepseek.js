// backend/ai/deepseek.js — DeepSeek API 封装
const https = require('https');

const DEFAULT_MODEL = 'deepseek-chat';
const API_BASE = 'api.deepseek.com';

/**
 * 调用 DeepSeek Chat API
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
      hostname: API_BASE,
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

// ─── 导出 chat 函数与默认模型名 ───
module.exports = { chat, DEFAULT_MODEL };
