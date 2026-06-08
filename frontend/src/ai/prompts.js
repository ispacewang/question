// src/ai/prompts.js — AI 提示词模板
// 针对 0.5B 小模型优化：极简、结构化、指令明确

/**
 * 诊断提示词
 * @param {{ total: number, correct: number, incorrect: number, rate: number, byType: Record<string,{correct:number,incorrect:number,total:number}>, wrongTopics: string[] }} stats
 */
export function buildDiagnosisPrompt(stats) {
  const byTypeLines = Object.entries(stats.byType || {})
    .filter(([, v]) => v.total > 0)
    .map(([type, v]) => {
      const rate = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0
      return `- ${type}: ${v.correct}/${v.total} (正确率${rate}%)`
    })
    .join('\n')

  const topicLines = (stats.wrongTopics || []).length > 0
    ? `- 易错知识点: ${stats.wrongTopics.join('、')}`
    : ''

  return `你是学习诊断助手。分析以下答题数据，给出薄弱点诊断和一条学习建议。用中文回复，不超过150字。

总题数: ${stats.total} | 正确: ${stats.correct} | 错误: ${stats.incorrect} | 正确率: ${stats.rate}%
题型表现:
${byTypeLines || '暂无'}
${topicLines}

请直接输出分析（无需复述数据）：`
}

/**
 * 答疑提示词（含当前题目上下文）
 * @param {object} ctx
 */
export function buildQAPrompt(ctx, chatHistory) {
  const parts = [
    `题目: ${ctx.question}`,
    `题型: ${ctx.type}`,
  ]
  if (ctx.options?.length) {
    parts.push(`选项: ${ctx.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}`)
  }
  parts.push(`正确答案: ${ctx.answer}`)
  if (ctx.explanation) parts.push(`解析: ${ctx.explanation}`)
  parts.push(`用户答案: ${ctx.userAnswer || '未答'}`)

  const contextBlock = parts.join('\n')

  let historyBlock = ''
  if (chatHistory?.length) {
    historyBlock = chatHistory
      .slice(-6)
      .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n')
  }

  return `你是答疑助手。根据题目信息回答用户的疑问。用中文回复，简洁准确，不超过200字。

===题目信息===
${contextBlock}
===对话历史===
${historyBlock}
===当前问题===
`
}

/**
 * 首条答疑消息（无历史）
 */
export function buildFirstQAPrompt(ctx) {
  const parts = [
    `题目: ${ctx.question}`,
    `题型: ${ctx.type}`,
  ]
  if (ctx.options?.length) {
    parts.push(`选项: ${ctx.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}`)
  }
  parts.push(`正确答案: ${ctx.answer}`)
  if (ctx.explanation) parts.push(`解析: ${ctx.explanation}`)
  parts.push(`用户答案: ${ctx.userAnswer || '未答'}`)

  return `你是答疑助手。我答了一道题，请帮我理解一下这道题。先说我的答案是否正确，再解释为什么。用中文回复，不超过200字。

${parts.join('\n')}`
}
