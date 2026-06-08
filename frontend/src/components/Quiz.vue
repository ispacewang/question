/** @file Quiz.vue — 答题核心组件，支持单选/多选/判断/简答/填空，题型筛选、顺序/随机、速刷模式、AI判题 */
<template>
  <div class="flex flex-col min-h-full">
    <div class="px-5 py-3 border-b border-border/50" data-tour="bank-selector">
      <BankSelector ref="bankSelectorRef" @bank-change="onBankChange" />
    </div>

    <div v-if="!currentBank && !loading" class="flex-1 flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
      <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 opacity-40">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      </div>
      <p class="text-sm">{{ emptyDescription }}</p>
    </div>

    <div v-else-if="loading" class="p-8 space-y-3 max-w-[800px] mx-auto w-full">
      <div class="h-4 w-[30%] bg-muted animate-pulse" />
      <div class="h-4 w-full bg-muted animate-pulse" />
      <div class="h-4 w-[80%] bg-muted animate-pulse" />
      <div class="h-10 w-full bg-muted animate-pulse mt-4" />
    </div>

    <div v-else-if="question" class="flex-1 flex flex-col">
      <div class="px-4 py-5 max-w-[800px] mx-auto w-full">
        <!-- 工具栏 -->
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-border/40">
          <div class="flex items-center gap-1.5 flex-wrap">
            <Badge variant="default">{{ question.type }}</Badge>
            <Badge v-if="question.meta?.['题目分类']" variant="secondary">{{ question.meta['题目分类'] }}</Badge>
          </div>
          <div class="flex items-center gap-2" data-tour="modes">
            <!-- 题型筛选 -->
            <div class="flex items-center gap-0.5 mr-1">
              <button
                v-for="t in typeFilters"
                :key="t.key"
                @click="toggleTypeFilter(t.key)"
                class="text-[10px] px-1.5 py-0.5 border transition-colors"
                :class="typeFilter.includes(t.key)
                  ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'"
              >{{ t.label }}</button>
            </div>
            <!-- 顺序/随机 -->
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-medium" :class="orderMode ? 'text-primary' : 'text-muted-foreground'">顺序</span>
              <label class="relative inline-block w-[34px] h-5 cursor-pointer">
                <input type="checkbox" v-model="orderMode" @change="onModeChange" class="opacity-0 w-0 h-0" />
                <span class="absolute inset-0 rounded-full transition-colors duration-300" :class="orderMode ? 'bg-primary' : 'bg-border'" />
                <span class="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-300" :class="orderMode ? 'left-[17px]' : 'left-[3px]'" />
              </label>
              <span class="text-[11px] font-medium" :class="!orderMode ? 'text-primary' : 'text-muted-foreground'">随机</span>
            </div>
            <Button size="xs" :variant="quickMode ? 'default' : 'outline'" @click="quickMode = !quickMode">⚡ 速刷</Button>
          </div>
        </div>

        <!-- 题干 -->
        <p class="text-base font-semibold leading-relaxed mb-6">{{ question.question }}</p>

        <!-- 简答/填空 -->
        <Textarea v-if="isShortAnswer || isFillBlank" v-model="userAnswer" :rows="4" placeholder="输入你的答案..." class="mb-5" />

        <!-- 选项 -->
        <div v-else class="flex flex-col gap-1.5 mb-6">
          <div v-for="(opt, i) in question.options" :key="i"
            @click="!showResult && selectOption(i)"
            class="flex items-start gap-3 px-3.5 py-3 border transition-all duration-200 cursor-pointer select-none"
            :class="optionClass(i)"
          >
            <span class="flex items-center justify-center w-6 h-6 border text-xs font-semibold flex-shrink-0 transition-colors"
              :class="optionLetterClass(i)"
            >{{ String.fromCharCode(65 + i) }}</span>
            <span class="text-sm leading-relaxed pt-0.5">{{ opt }}</span>
            <span v-if="showResult && isCorrectOption(i)" class="ml-auto text-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
            </span>
            <span v-if="showResult && isWrongUserOption(i)" class="ml-auto text-destructive">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </span>
          </div>
        </div>

        <!-- 操作 -->
        <div class="flex gap-2.5 pt-4 border-t border-border/40">
          <Button v-if="!showResult" @click="submitAnswer" :disabled="!canSubmit" size="sm">
            {{ quickMode ? '提交并继续 →' : '提交答案' }}
          </Button>
          <button
            v-if="!showResult && (isShortAnswer || isFillBlank)"
            @click="aiJudgeQuestion"
            :disabled="!userAnswer || aiJudging"
            class="liquid-btn inline-flex items-center px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span class="liquid-btn-inner px-2">{{ aiJudging ? '⏳ 判题中' : '✨ AI 判题' }}</span>
          </button>
          <Button v-else-if="showResult" size="sm" @click="nextQuestion">下一题 →</Button>
          <div class="flex-1" />
        </div>

        <!-- 反馈 -->
        <div v-if="showResult" class="mt-5 space-y-3">
          <div class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-l-[3px]"
            :class="lastResult?.correct
              ? 'bg-success/[0.06] dark:bg-success/[0.12] border-l-success text-success dark:text-success'
              : 'bg-destructive/[0.06] dark:bg-destructive/[0.10] border-l-destructive text-destructive dark:text-destructive'"
          >{{ lastResult?.correct ? '✓ 回答正确！' : '✗ 回答错误' }}</div>
          <div v-if="!lastResult?.correct" class="flex gap-2 text-sm px-4">
            <span class="text-muted-foreground">正确答案：</span>
            <span class="font-semibold text-success">{{ fmtAnswer }}</span>
          </div>
          <div v-if="lastResult?.explanation" class="p-4 bg-muted/50 text-sm leading-relaxed">
            <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">解析</span>
            {{ lastResult.explanation }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Badge from './ui/Badge.vue'
import Button from './ui/Button.vue'
import Textarea from './ui/Textarea.vue'
import BankSelector from './BankSelector.vue'
import * as api from '../api'
import { getMistakeBook, removeQuestionFromMistakeBook, MISTAKE_BOOK_ID } from '../utils/mistakeBook'
import { useAiMode } from '../composables/useAiMode'

const { isAiMode } = useAiMode()

const bankSelectorRef = ref(null)
const currentBank = ref('')
const question = ref(null)
const userAnswer = ref('')
const orderMode = ref(false)
const quickMode = ref(false)
const loading = ref(false)
const showResult = ref(false)
const lastResult = ref(null)
const lastMistakeIdx = ref(0)
const aiJudging = ref(false)

// 题型筛选 — "全部" 等同于不过滤
const ALL_TYPES = ['单选题', '多选题', '判断题']
const typeFilters = computed(() => {
  const base = [{ key: 'all', label: '全部' }]
  for (const t of ALL_TYPES) base.push({ key: t, label: t })
  if (isAiMode.value) {
    base.push({ key: '简答题', label: '简答' }, { key: '填空题', label: '填空' })
  }
  return base
})
const typeFilter = ref(['all'])

function toggleTypeFilter(key) {
  if (key === 'all') {
    typeFilter.value = ['all']
  } else {
    const cur = [...typeFilter.value]
    const allIdx = cur.indexOf('all')
    if (allIdx >= 0) cur.splice(allIdx, 1)
    const idx = cur.indexOf(key)
    if (idx >= 0) cur.splice(idx, 1)
    else cur.push(key)
    if (cur.length === 0) typeFilter.value = ['all']
    else typeFilter.value = cur
  }
  loadQuestion()
}

const emit = defineEmits(['answer-submitted', 'bank-changed'])

const canSubmit = computed(() => !!userAnswer.value && !showResult.value) // 有答案且未显示结果时可提交
const isShortAnswer = computed(() => question.value?.type === '简答题')   // 简答题需文本框输入
const isFillBlank = computed(() => question.value?.type === '填空题')      // 填空题需文本框输入
const isMultiChoice = computed(() => question.value?.type === '多选题')    // 多选题支持多选字母
const isMistakeBook = computed(() => currentBank.value === MISTAKE_BOOK_ID)
const emptyDescription = computed(() => {
  if (!currentBank.value) return '选择一个题库开始答题'
  if (isMistakeBook.value) return '错题库为空'
  return '题库为空'
})

const correctAnswer = computed(() => lastResult.value?.correctAnswer || question.value?.correctAnswer || question.value?.answer || '')
const fmtAnswer = computed(() => Array.isArray(correctAnswer.value) ? correctAnswer.value.join(', ') : correctAnswer.value)

const isCorrectOption = (i) => showResult.value && correctAnswer.value.includes(String.fromCharCode(65 + i))
const isWrongUserOption = (i) => {
  if (!showResult.value || lastResult.value?.correct) return false
  const ua = userAnswer.value; const letter = String.fromCharCode(65 + i)
  return isMultiChoice.value && Array.isArray(ua) ? ua.includes(letter) : ua === letter
}

const optionClass = (i) => {
  if (!showResult.value) {
    const sel = isMultiChoice.value ? Array.isArray(userAnswer.value) && userAnswer.value.includes(String.fromCharCode(65 + i)) : userAnswer.value === String.fromCharCode(65 + i)
    return sel ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]'
  }
  if (isCorrectOption(i)) return 'border-success/30 bg-success/[0.06] dark:bg-success/[0.12] dark:border-success/25'
  if (isWrongUserOption(i)) return 'border-destructive/30 bg-destructive/[0.05] dark:bg-destructive/[0.10] dark:border-destructive/25'
  return 'border-border/20 opacity-60'
}
const optionLetterClass = (i) => {
  if (!showResult.value) {
    const sel = isMultiChoice.value ? Array.isArray(userAnswer.value) && userAnswer.value.includes(String.fromCharCode(65 + i)) : userAnswer.value === String.fromCharCode(65 + i)
    return sel ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/25 text-muted-foreground'
  }
  if (isCorrectOption(i)) return 'bg-success border-success text-success-foreground'
  if (isWrongUserOption(i)) return 'bg-destructive border-destructive text-destructive-foreground'
  return 'border-muted-foreground/15 text-muted-foreground'
}

const onBankChange = async (bankId) => {
  currentBank.value = bankId
  emit('bank-changed')
  if (!bankId) { question.value = null; return }
  lastMistakeIdx.value = 0
  await loadQuestion()
}

/**
 * 加载题目：错题库取本地数据，普通题库调远端接口。支持题型过滤与顺序/随机模式
 * @returns {Promise<void>}
 */
const loadQuestion = async () => {
  if (!currentBank.value) return
  loading.value = true
  try {
    if (isMistakeBook.value) {
      const book = getMistakeBook()
      let filtered = book
      if (!typeFilter.value.includes('all')) {
        filtered = book.filter(q => typeFilter.value.includes(q.type || '单选题'))
      }
      if (filtered.length === 0) { question.value = null; loading.value = false; return }
      let q
      if (orderMode.value) {
        if (lastMistakeIdx.value >= filtered.length) lastMistakeIdx.value = 0
        q = filtered[lastMistakeIdx.value]; lastMistakeIdx.value++
      } else {
        q = filtered[Math.floor(Math.random() * filtered.length)]
      }
      question.value = { ...q, id: q.questionId }
    } else {
      const res = await api.getQuestion(currentBank.value, orderMode.value, typeFilter.value.includes('all') ? null : [...typeFilter.value])
      question.value = res.data
    }
    userAnswer.value = ''; showResult.value = false; lastResult.value = null
  } catch (e) {
    toast.error(e.response?.data?.error || '加载失败')
    question.value = null
  } finally { loading.value = false }
}

const onModeChange = () => { loadQuestion() }

/**
 * 选择/取消选项。多选时维护字母数组，单选时直接设字母
 * @param {number} i - 选项索引 (0=A, 1=B, ...)
 */
const selectOption = (i) => {
  const l = String.fromCharCode(65 + i)
  if (isMultiChoice.value) {
    if (!Array.isArray(userAnswer.value)) userAnswer.value = []
    const a = [...userAnswer.value]; const p = a.indexOf(l)
    p === -1 ? a.push(l) : a.splice(p, 1)
    userAnswer.value = a
  } else { userAnswer.value = l }
}

/**
 * 本地判题（错题库用），支持单选/多选答案比对
 * @param {Object} q - 题目对象
 * @param {string|string[]} ua - 用户答案
 * @returns {boolean} 是否正确
 */
const checkLocalAnswer = (q, ua) => {
  const answer = q.correctAnswer || q.answer || ''
  if (q.type === '多选题') {
    const std = answer.replace(/,/g, '').split('').map(s => s.trim().toUpperCase()).filter(Boolean).sort()
    const usr = (Array.isArray(ua) ? ua : [ua]).map(s => String(s).trim().toUpperCase()).filter(Boolean).sort()
    return JSON.stringify(std) === JSON.stringify(usr)
  }
  return answer.trim().toUpperCase() === String(ua || '').trim().toUpperCase()
}

/**
 * 提交答案：错题库本地判题，普通题库调远端接口。速刷模式自动跳下一题
 * @returns {Promise<void>}
 */
const submitAnswer = async () => {
  if (!canSubmit.value) return
  const q = question.value
  try {
    let correct, answer, explanation
    if (isMistakeBook.value) {
      correct = checkLocalAnswer(q, userAnswer.value)
      answer = q.correctAnswer || q.answer; explanation = q.explanation
    } else {
      const res = await api.submitAnswer(q.id, userAnswer.value, currentBank.value)
      correct = res.data?.correct; answer = res.data?.answer; explanation = res.data?.explanation
    }
    lastResult.value = {
      correct, explanation, correctAnswer: answer,
      questionData: { ...q, questionId: q.questionId || q.id, userAnswer: userAnswer.value, correctAnswer: answer, explanation },
    }
    showResult.value = true
    emit('answer-submitted', { isCorrect: correct, questionData: lastResult.value.questionData })
    if (isMistakeBook.value && correct) { removeQuestionFromMistakeBook(q.questionId); bankSelectorRef.value?.refreshBanks() }

    // 速刷模式：自动跳下一题
    if (quickMode.value) setTimeout(() => loadQuestion(), 600)
  } catch { toast.error('提交失败') }
}

const nextQuestion = () => { loadQuestion() }

/**
 * AI 判题：调用本地 AI 服务对简答/填空题评分，返回正确性与解析
 * @returns {Promise<void>}
 */
const aiJudgeQuestion = async () => {
  if (!question.value || !userAnswer.value || aiJudging.value) return
  aiJudging.value = true
  try {
    const res = await axios.post('http://localhost:13002/api/ai/judge', {
      questionId: question.value.id,
      userAnswer: userAnswer.value,
    })
    const { correct, explanation, answer: stdAnswer } = res.data
    lastResult.value = {
      correct: !!correct,
      explanation: explanation || 'AI 无法判题',
      correctAnswer: stdAnswer || question.value?.answer || '(AI 判题模式)',
      aiJudged: true,
      questionData: {
        ...question.value,
        questionId: question.value.questionId || question.value.id,
        userAnswer: userAnswer.value,
        correctAnswer: stdAnswer || '',
        explanation: explanation || '',
        aiJudged: true,
      },
    }
    showResult.value = true
    emit('answer-submitted', { isCorrect: !!correct, questionData: lastResult.value.questionData })
  } catch (e) {
    const msg = e.response?.data?.error || 'AI 判题失败，请检查 API Key'
    toast.error(msg)
  } finally {
    aiJudging.value = false
  }
}

defineExpose({ refreshBanks: () => bankSelectorRef.value?.refreshBanks() })
</script>
