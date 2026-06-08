// backend/ai/judge.js — AI 判题
const { chat } = require('./deepseek');

const SYSTEM_PROMPT = `你是一个严谨、专业的阅卷判题助手。你需要遵循以下原则进行判题：

## 第一步：识别学科
根据题库名和题目内容，判断这道题属于什么学科（如：数学、英语、物理、历史、政治、铁路信号、医学、法律等）。

## 第二步：理解题目和答案
- 仔细阅读题干，理解考察的知识点
- 读懂标准答案的核心含义，提取关键评分点
- 理解用户答案的表述逻辑

## 第三步：学科差异判断

### 理科类（数学、物理、化学、编程等）
- 答案有明确的正确/错误界限
- 数值答案：允许合理的单位差异和精度差异（如 "9.8" ≈ "9.80"）
- 公式/代码：核心逻辑正确即可，不要求逐字一致

### 文科/语言类（英语、语文、历史、政治、法律、管理等）
- **不存在绝对相等的唯一答案**
- 重点关注：核心观点是否一致、关键术语是否正确、逻辑是否自洽
- 英语题目要特别注意：同义表达、语法正确性、拼写容错
- 简答题：抓住核心要点即为正确，表达方式可以不同
- 翻译题：语义准确即可，不需要逐词对应

### 判断题/填空题
- 判断题：A=正确/是/True/Yes/对/T，B=错误/否/False/No/错/F
- 填空题：关键词/核心概念正确即为正确，不要求措辞完全一致

## 第四步：判题输出
- correct: 含义正确即为 true，只有明显错误才判 false
- explanation: 给出专业的判题理由，包括：
  1. 识别到的学科和题型
  2. 标准答案的核心要点
  3. 用户答案的匹配度分析
  4. 扣分点（如果有）

**重要原则：宁可放过，不可误判。模棱两可时判对，并在 explanation 中说明存疑点。**

**数学公式格式**：explanation 中涉及数学公式时，使用 $...$ 包裹行内公式（如 $x^2 + 2x + 1$），$$...$$ 包裹块级公式。

只输出 JSON，不要任何 Markdown 代码块或额外文字。`;

/**
 * AI 判题
 * @param {string} apiKey
 * @param {object} q — { question, type, options, answer, userAnswer, bankName }
 * @returns {Promise<{correct: boolean, explanation: string}>}
 */
async function judgeQuestion(apiKey, q, model = 'deepseek-v4-pro') {
  const prompt = buildJudgePrompt(q);

  const response = await chat(apiKey, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ], { temperature: 0.1, max_tokens: 1024, model });

  return parseJudgment(response, q);
}

/**
 * 构造 AI 判题的 prompt，包含题库上下文、题干、选项、标准答案与用户答案
 * @param {{question, type, options, answer, userAnswer, bankName}} q — 题目数据
 * @returns {string} 判题 prompt 文本
 */
function buildJudgePrompt(q) {
  let prompt = '';

  // 题库上下文
  if (q.bankName) {
    prompt += `题库名称: ${q.bankName}\n`;
  }

  prompt += `题目: ${q.question}\n`;
  prompt += `题型: ${q.type}\n`;

  if (q.options && q.options.length > 0) {
    prompt += `选项: ${q.options.join(' | ')}\n`;
  }

  prompt += `标准答案: ${q.answer}\n`;
  prompt += `用户答案: ${q.userAnswer}\n`;

  prompt += `\n请按照系统要求的四步流程判题，输出 JSON。`;

  return prompt;
}

/**
 * 解析 AI 判题返回，提取 correct 和 explanation
 * 兼容 JSON 解析失败时从文本中兜底提取
 * @param {string} text — AI 原始返回文本
 * @param {object} question — 原题目数据（备用）
 * @returns {{correct: boolean, explanation: string}} 判题结果
 */
function parseJudgment(text, question) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const result = JSON.parse(cleaned);
    return {
      correct: !!result.correct,
      explanation: result.explanation || '',
    };
  } catch {
    // 容错：从文本中提取
    const lower = text.toLowerCase();
    const hasTrue = lower.includes('"correct": true') || lower.includes('"correct":true') ||
      lower.includes('correct": true') || lower.includes('correct":true');
    const hasFalse = lower.includes('"correct": false') || lower.includes('"correct":false') ||
      lower.includes('correct": false') || lower.includes('correct":false');
    const correct = hasTrue && !hasFalse ? true : (!hasTrue && hasFalse ? false : lower.includes('正确'));
    return { correct, explanation: text.slice(0, 500) };
  }
}

module.exports = { judgeQuestion };
