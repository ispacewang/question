// composables/useExamHistory.js — 考试历史存储
import { ref, computed } from 'vue'

const STORAGE_KEY = 'exam-history'
const MAX_RECORDS = 20

const records = ref(loadRecords())

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecords(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECORDS)))
}

export function useExamHistory() {

  const sorted = computed(() =>
    [...records.value].sort((a, b) => b.id - a.id)
  )

  /**
   * 保存考试记录到 localStorage，返回生成的记录对象
   * @param {Object} data - 考试结果数据
   * @param {string} data.bankName - 题库名称
   * @param {number} data.score - 正确题数
   * @param {number} data.total - 总题数
   * @param {number} [data.wrongCount] - 错误题数
   * @param {number} [data.duration] - 耗时（分钟）
   * @param {Object[]} [data.questions] - 题目列表
   * @param {string[]} [data.answers] - 用户答案列表
   * @param {Object} [data.wrongDetails] - 错题详情
   * @param {Set} [data.wrongSet] - 错题索引集合
   * @returns {Object} 生成的考试记录（含 id、date 等字段）
   */
  function saveExam(data) {
    const record = {
      id: Date.now(),
      date: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      bankName: data.bankName || '',
      score: data.score,
      total: data.total,
      percentage: Math.round((data.score / data.total) * 100),
      wrongCount: data.wrongCount || 0,
      duration: data.duration || 0,
      questions: data.questions || [],
      answers: data.answers || [],
      wrongDetails: data.wrongDetails || {},
      wrongSet: data.wrongSet ? Array.from(data.wrongSet) : [],
    }
    records.value = [record, ...records.value].slice(0, MAX_RECORDS)
    saveRecords(records.value)
    return record
  }

  /**
   * 按 ID 查找考试记录
   * @param {number} id - 记录 ID
   * @returns {Object|undefined} 匹配的考试记录，未找到返回 undefined
   */
  function getExam(id) {
    return records.value.find(r => r.id === id)
  }

  /**
   * 按 ID 删除一条考试记录
   * @param {number} id - 要删除的记录 ID
   */
  function removeExam(id) {
    records.value = records.value.filter(r => r.id !== id)
    saveRecords(records.value)
  }

  /**
   * 清空所有考试记录
   */
  function clearAll() {
    records.value = []
    saveRecords([])
  }

  return {
    records,
    sorted,
    saveExam,
    getExam,
    removeExam,
    clearAll,
  }
}
