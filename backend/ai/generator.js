// backend/ai/generator.js — AI 题目生成
const { chat } = require('./deepseek');

const TYPE_LIST = ['单选题', '多选题', '判断题', '简答题', '填空题'];

/**
 * 生成一批题目（分批调用 API，每批 10 题）
 * @param {string} apiKey
 * @param {string} topic — 主题/领域
 * @param {number} total — 总题数（默认 500）
 * @param {function} onProgress — 进度回调 ({batch, totalBatches, questions})
 * @returns {Promise<Array>} 题目数组
 */
async function generateQuestions(apiKey, topic = '通用知识', total = 500, onProgress) {
  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(total / BATCH_SIZE);
  const allQuestions = [];

  for (let batch = 0; batch < totalBatches; batch++) {
    const remaining = total - allQuestions.length;
    const batchSize = Math.min(BATCH_SIZE, remaining);
    if (batchSize <= 0) break;

    const types = [];
    for (let i = 0; i < batchSize; i++) {
      types.push(TYPE_LIST[i % 5]);
    }

    const prompt = buildGeneratePrompt(topic, batchSize, types, allQuestions.length + 1);

    try {
      const response = await chat(apiKey, [
        { role: 'system', content: '你是一个专业题库生成助手。只输出 JSON，不要任何解释或额外文字，不要使用 Markdown 代码块。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.8, max_tokens: 4096 });

      const questions = parseResponse(response);
      allQuestions.push(...questions);

      if (onProgress) {
        onProgress({ batch: batch + 1, totalBatches, questions: allQuestions.length });
      }
    } catch (err) {
      console.error(`[generator] batch ${batch + 1} failed:`, err.message);
      // 继续下一批
      if (onProgress) {
        onProgress({ batch: batch + 1, totalBatches, questions: allQuestions.length, error: err.message });
      }
    }
  }

  return allQuestions;
}

/**
 * 构造 AI 题库生成的 prompt
 * @param {string} topic — 主题/领域
 * @param {number} count — 本次生成数量
 * @param {string[]} types — 题型数组
 * @param {number} startIndex — 起始编号
 * @returns {string} 完整的 prompt 文本
 */
function buildGeneratePrompt(topic, count, types, startIndex) {
  return `生成 ${count} 道关于"${topic}"的考试题目。题目编号从 ${startIndex} 开始，类型依次为: ${types.join(', ')}。

每道题包含字段：question(题干), type, options(选项数组), answer(答案), explanation(解析)。

题型格式：
- 单选题：options 为 ["A. ...", "B. ...", "C. ...", "D. ..."]，answer 为 "A"~"D"
- 多选题：同上，answer 如 "ACD"
- 判断题：options 固定 ["A. 正确", "B. 错误"]，answer 为 "A" 或 "B"
- 简答题：options 为 []，answer 为参考答案文本，explanation 为评分要点
- 填空题：options 为 []，answer 为正确答案文本

返回纯 JSON 数组：
[{"question":"...", "type":"单选题", "options":["A. ..."], "answer":"B", "explanation":"..."}]

题目要有难度，选项有干扰性。直接输出 JSON 数组，不要 Markdown。`;
}

/**
 * 解析 AI 返回的原始文本，提取题目 JSON 数组
 * 兼容 Markdown 代码块包裹、纯 JSON、以及 JSON 作为文本子串的情况
 * @param {string} text — AI 原始返回文本
 * @returns {Array<{question, type, options, answer, explanation, meta}>} 标准化题目数组
 */
function parseResponse(text) {
  // 清理可能的 markdown 代码块标记
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('不是数组');
    return parsed.map(q => ({
      question: q.question || '',
      type: q.type || '单选题',
      options: JSON.stringify(q.options || []),
      answer: q.answer || '',
      explanation: q.explanation || '',
      meta: JSON.stringify({
        一级纲要: 'AI生成',
        题目分类: q.type || '单选题',
      }),
    }));
  } catch (e) {
    // 尝试从文本中提取 JSON 数组
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return parsed.map(q => ({
          question: q.question || '',
          type: q.type || '单选题',
          options: JSON.stringify(q.options || []),
          answer: q.answer || '',
          explanation: q.explanation || '',
          meta: JSON.stringify({ 一级纲要: 'AI生成', 题目分类: q.type || '单选题' }),
        }));
      } catch {}
    }
    console.error('[generator] parse error:', cleaned.slice(0, 300));
    return [];
  }
}

module.exports = { generateQuestions };
