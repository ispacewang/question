// src/composables/useAiDiagnosis.js
// AI 薄弱点诊断 — 从错题数据生成诊断分析

import { ref, computed } from 'vue'
import { getMistakeBook } from '../utils/mistakeBook'
import { buildDiagnosisPrompt } from '../ai/prompts'
import { loadModel, generate, onAIProgress } from '../ai/service'

export function useAiDiagnosis(quizStats) {
  const diagnosis = ref('')
  const loading = ref(false)
  const progressMsg = ref('')
  const error = ref('')

  onAIProgress((msg) => {
    progressMsg.value = msg
  })

  /**
   * 从错题本提取分析数据
   */
  const collectAnalysisData = computed(() => {
    const book = getMistakeBook()
    const stats = quizStats?.value || { correct: 0, incorrect: 0, byType: {} }

    // 收集易错的知识点（一级纲要 / 题目分类）
    const topicMap = new Map()
    for (const item of book) {
      const meta = item.meta || item.questionData?.meta || {}
      const topics = [
        meta['一级纲要'],
        meta['题目分类'],
      ].filter(Boolean)

      for (const t of topics) {
        topicMap.set(t, (topicMap.get(t) || 0) + 1)
      }
    }

    const wrongTopics = [...topicMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t)

    const total = stats.correct + stats.incorrect

    return {
      total,
      correct: stats.correct || 0,
      incorrect: stats.incorrect || 0,
      rate: total > 0 ? Math.round((stats.correct / total) * 100) : 0,
      byType: stats.byType || {},
      wrongTopics,
    }
  })

  /**
   * 运行诊断
   */
  async function runDiagnosis() {
    const data = collectAnalysisData.value
    if (data.total === 0) {
      diagnosis.value = '暂无答题数据，先刷几道题再来诊断吧。'
      return
    }

    loading.value = true
    error.value = ''
    diagnosis.value = ''

    try {
      await loadModel()
      const prompt = buildDiagnosisPrompt(data)
      const result = await generate(prompt, 200)
      diagnosis.value = result || '模型暂未返回有效结果，请重试。'
    } catch (e) {
      error.value = e.message || '诊断失败'
      diagnosis.value = ''
    } finally {
      loading.value = false
    }
  }

  return {
    diagnosis,
    loading,
    progressMsg,
    error,
    runDiagnosis,
  }
}
