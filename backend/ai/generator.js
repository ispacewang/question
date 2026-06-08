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
async function generateQuestions(apiKey, topic = '通用知识', total = 500, onProgress, model = 'deepseek-v4-pro') {
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
      ], { temperature: 0.8, max_tokens: 4096, model });

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

【重要】涉及数学公式、物理公式、化学方程式等内容时，使用 $...$ 包裹行内公式，$$...$$ 包裹独占行公式：
- 行内示例：已知 $f(x) = x^2 + 2x + 1$，求 $f(3)$ 的值
- 块级示例：$$E = mc^2$$
- 希腊字母用 LaTeX：$\\pi$ $\\theta$ $\\alpha$ $\\beta$ $\\sum_{i=1}^{n}$
- 上下标：$x^{2}$ $a_{1}$ $H_2O$
- 分数：$\\frac{a}{b}$
- 根号：$\\sqrt{2}$ $\\sqrt[3]{8}$
- 化学方程式：$2H_2 + O_2 \\rightarrow 2H_2O$
- 物理公式：$F = ma$ $U = IR$ $E = \\frac{1}{2}mv^2$

【图形生成】如果题目需要配图（函数图像、几何图形、坐标系等），添加 diagram 字段。支持两种格式：

1. JSXGraph JSON（首选 — 函数图、坐标系、几何图形）：
   "diagram": {"boundingbox":[-5,5,5,-5], "axis":true, "grid":false,
     "elements":[
       {"type":"functiongraph","attrs":["x^2-4*x+3"],"opts":{"strokeColor":"#4a7dbf","strokeWidth":2}}
     ]}
   boundingbox: [xMin, yMax, xMax, yMin] (注意 y 轴方向)
   支持的 element 类型: functiongraph, point, line, circle, polygon, text, sector, angle, tangent, integral, glider, slider
   函数语法: JS 表达式，如 "sin(x)", "x^3-3*x", "exp(-x^2)", "1/x"

2. SVG 字符串（立体几何、物理图等复杂图形）：
   "diagramSvg": "<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'>...</svg>"
   禁止使用 script、onclick 等事件属性

⚠️ 配图只是题目背景，绝对不能标注答案！例如：
- 问"求零点"→ 图只画函数曲线，不标零点坐标
- 问"求交点"→ 图只画两条曲线，不标交点
- 问"求最大值"→ 图只画曲线，不标顶点
- 几何题→ 可以标顶点字母(A,B,C)、已知边长，但不要标待求的量

不需要图形的题目不写 diagram 字段。

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
    return parsed.map(q => {
      const meta = {
        一级纲要: 'AI生成',
        题目分类: q.type || '单选题',
      }
      if (q.diagram) meta.diagram = q.diagram
      if (q.diagramSvg) meta.diagramSvg = q.diagramSvg
      return {
        question: q.question || '',
        type: q.type || '单选题',
        options: JSON.stringify(q.options || []),
        answer: q.answer || '',
        explanation: q.explanation || '',
        meta: JSON.stringify(meta),
      }
    });
  } catch (e) {
    // 尝试从文本中提取 JSON 数组
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return parsed.map(q => {
          const meta = { 一级纲要: 'AI生成', 题目分类: q.type || '单选题' }
          if (q.diagram) meta.diagram = q.diagram
          if (q.diagramSvg) meta.diagramSvg = q.diagramSvg
          return {
            question: q.question || '',
            type: q.type || '单选题',
            options: JSON.stringify(q.options || []),
            answer: q.answer || '',
            explanation: q.explanation || '',
            meta: JSON.stringify(meta),
          }
        });
      } catch {}
    }
    console.error('[generator] parse error:', cleaned.slice(0, 300));
    return [];
  }
}

module.exports = { generateQuestions };
