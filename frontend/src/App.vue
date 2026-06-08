/** @file App.vue — 主布局，三栏刷题模式（统计|答题|错题）+ 考试模式 + AI 模式切换 */
<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useTheme } from './stores/theme'
import { addQuestionToMistakeBook } from './utils/mistakeBook'
import AppTour from './components/AppTour.vue'
import Quiz from './components/Quiz.vue'
import StatsPanel from './components/StatsPanel.vue'
import WrongAnswerPanel from './components/WrongAnswerPanel.vue'
import Exam from './components/Exam.vue'
import TitleBar from './components/TitleBar.vue'
import Dialog from './components/ui/Dialog.vue'
import DialogHeader from './components/ui/DialogHeader.vue'
import DialogTitle from './components/ui/DialogTitle.vue'
import DialogDescription from './components/ui/DialogDescription.vue'
import DialogFooter from './components/ui/DialogFooter.vue'
import Button from './components/ui/Button.vue'
import Input from './components/ui/Input.vue'
import Select from './components/ui/Select.vue'
import SelectItem from './components/ui/SelectItem.vue'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import ExamHistoryPanel from './components/ExamHistoryPanel.vue'
import { useAiMode } from './composables/useAiMode'
import { useExamHistory } from './composables/useExamHistory'

const quizRef = ref(null)
const quizStats = ref({ correct: 0, incorrect: 0, byType: {} })
const wrongAnswers = ref([])

useTheme()

const isExamMode = ref(false)
const examInfo = ref(null)

// 侧栏
const leftOpen = ref(false)
const rightOpen = ref(false)
const hasStats = computed(() => quizStats.value.correct + quizStats.value.incorrect > 0)
const hasWrong = computed(() => wrongAnswers.value.length > 0)
const toggleLeft = () => { leftOpen.value = !leftOpen.value }
const toggleRight = () => { rightOpen.value = !rightOpen.value }

/**
 * 处理答题提交结果，更新统计面板和错题本
 * @param {Object} result - 答题结果 { isCorrect, questionData }
 */
const handleAnswerSubmitted = (result) => {
  const type = result.questionData?.type || '未知'
  if (!quizStats.value.byType[type]) {
    quizStats.value.byType[type] = { correct: 0, incorrect: 0, total: 0 }
  }
  quizStats.value.byType[type].total++
  if (result.isCorrect) {
    quizStats.value.correct++
    quizStats.value.byType[type].correct++
  } else {
    quizStats.value.incorrect++
    quizStats.value.byType[type].incorrect++
    if (result.questionData && !wrongAnswers.value.some(x => x.questionData.questionId === result.questionData.questionId)) {
      wrongAnswers.value.unshift(result)
      addQuestionToMistakeBook(result.questionData)
      quizRef.value?.refreshBanks?.()
    }
  }
}

/**
 * 题库切换时重置统计和错题数据
 */
const handleBankChanged = () => {
  quizStats.value = { correct: 0, incorrect: 0, byType: {} }
  wrongAnswers.value = []
}

/**
 * 进入考试模式
 * @param {Object} info - 考试配置 { bank, duration, typeCounts }
 */
const handleCreateExam = (info) => {
  isExamMode.value = true
  examInfo.value = info || {}
  quizStats.value = { correct: 0, incorrect: 0, byType: {} }
  wrongAnswers.value = []
}

/** 退出考试模式，清除考试信息 */
const handleExitExam = () => { isExamMode.value = false; examInfo.value = null }

// 考试弹窗
const showExamDialog = ref(false)
const showHistoryPanel = ref(false)
const { sorted: examRecords } = useExamHistory()
const examForm = ref({ bank: '', duration: 60 })
const examTypeCounts = ref({ '单选题': 40, '多选题': 30, '判断题': 30, '简答题': 10, '填空题': 10 })
const availableBanks = ref([])
const isAiBank = computed(() => examForm.value.bank && examForm.value.bank.startsWith('AI题库_'))

/**
 * 获取远端题库列表
 * @returns {Promise<void>}
 */
const fetchBanks = async () => {
  try {
    const { getBanks } = await import('./api')
    const res = await getBanks()
    availableBanks.value = res.data.banks || []
  } catch { availableBanks.value = [] }
}

/**
 * 打开考试弹窗，先拉取题库列表
 * @returns {Promise<void>}
 */
const openExamDialog = async () => {
  await fetchBanks()
  if (!availableBanks.value.length) { toast.warning('请先上传题库'); return }
  showExamDialog.value = true
}

/** 验证考试表单并启动考试 */
const startExam = () => {
  if (!examForm.value.bank) { toast.error('请选择题库'); return }
  if (!examForm.value.duration || examForm.value.duration <= 0) { toast.error('请输入有效时长'); return }
  showExamDialog.value = false
  handleCreateExam({
    bank: examForm.value.bank,
    duration: examForm.value.duration,
    typeCounts: isAiBank.value ? { ...examTypeCounts.value } : null,
  })
}

const showIntroDialog = ref(false)
onMounted(() => {
  if (!localStorage.getItem('ai-quiz-intro-shown')) {
    showIntroDialog.value = true
    localStorage.setItem('ai-quiz-intro-shown', '1')
  }
  aiModeModule.checkConfig()
})

// ─── AI 模式 ───
const aiModeModule = useAiMode()
const { aiMode, isAiMode, apiConfigured, saveApiKey, toggleMode } = aiModeModule
const showApiKeyDialog = ref(false)

watch(hasStats, (v) => { if (v) leftOpen.value = true })
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background">
    <TitleBar class="sticky top-0 z-50 flex-shrink-0" />

    <!-- 工具栏 -->
    <div v-if="!isExamMode" class="flex items-center justify-between px-4 py-1.5 border-b border-border/50 flex-shrink-0">
      <AppTour />
      <div class="flex items-center gap-1.5">
        <!-- AI 模式切换 -->
        <button
          @click="isAiMode ? toggleMode() : (apiConfigured ? toggleMode() : showApiKeyDialog = true)"
          data-tour="ai-mode-btn"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border transition-all duration-200"
          :class="isAiMode
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-dashed border-muted-foreground/25 text-muted-foreground hover:border-primary/40 hover:text-primary'"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          AI {{ isAiMode ? '开' : '' }}
          <span class="text-[9px] px-1 py-0.5 bg-amber-500/10 text-amber-600 font-bold">Beta</span>
        </button>
        <Button size="xs" @click="openExamDialog" class="gap-1" data-tour="exam-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          考试
        </Button>
        <Button size="xs" variant="ghost" @click="showHistoryPanel = !showHistoryPanel"
          class="gap-1.5"
          :class="showHistoryPanel ? 'text-primary' : ''"
          data-tour="history-btn"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span class="text-[11px]">我的</span>
          <span v-if="examRecords.length" class="text-[9px] font-bold text-primary-foreground bg-primary min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">{{ examRecords.length }}</span>
        </Button>
      </div>
    </div>

    <!-- 引导弹窗 -->
    <Dialog :open="showIntroDialog" @update:open="showIntroDialog = $event" class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>功能介绍</DialogTitle>
        <DialogDescription>答题小助手 — 题库上传、刷题、考试、错题本</DialogDescription>
      </DialogHeader>
      <div class="text-sm leading-relaxed">
        <ul class="space-y-1 pl-4 list-disc text-muted-foreground">
          <li>Excel/CSV 题库一键上传</li>
          <li>刷题模式 + 考试模式切换</li>
          <li>题型雷达图分析</li>
          <li>多题型：单选 / 多选 / 判断</li>
        </ul>
      </div>
      <DialogFooter>
        <Button @click="showIntroDialog = false">开始使用</Button>
      </DialogFooter>
    </Dialog>

    <!-- 考试弹窗 -->
    <Dialog :open="showExamDialog" @update:open="showExamDialog = $event" class="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>新建考试</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">题库</label>
          <Select v-model="examForm.bank" placeholder="请选择题库">
            <SelectItem v-for="b in availableBanks" :key="b" :value="b">{{ b }}</SelectItem>
          </Select>
        </div>
        <!-- AI 模式：各题型数量 -->
        <div v-if="isAiBank" class="space-y-2">
          <label class="text-sm font-medium">各题型数量</label>
          <div class="grid grid-cols-3 gap-2">
            <div v-for="t in ['单选题', '多选题', '判断题', '简答题', '填空题']" :key="t" class="space-y-1">
              <label class="text-[10px] text-muted-foreground">{{ t }}</label>
              <input v-model.number="examTypeCounts[t]" type="number" min="0" max="100" class="w-full px-2 py-1.5 text-xs bg-background border border-border outline-none focus:border-primary" />
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">时长（分钟）</label>
          <Input :model-value="examForm.duration" @update:model-value="examForm.duration = Number($event) || 0" type="number" :min="1" :max="180" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="showExamDialog = false">取消</Button>
        <Button @click="startExam">开始</Button>
      </DialogFooter>
    </Dialog>

    <!-- 考试模式 -->
    <div v-if="isExamMode" class="flex-1 bg-background min-h-0 overflow-y-auto">
      <Exam :exam-info="examInfo" @exit-exam="handleExitExam" />
    </div>

    <!-- 刷题模式 -->
    <div v-else class="flex-1 flex min-h-0 relative">
      <Transition name="panel-slide">
        <div v-if="leftOpen" class="w-[260px] border-r border-border/50 overflow-y-auto flex-shrink-0 bg-background" data-tour="stats">
          <StatsPanel :stats="quizStats" />
        </div>
      </Transition>

      <div class="flex-1 overflow-y-auto min-w-0 pb-20" data-tour="quiz">
        <Quiz ref="quizRef" @answer-submitted="handleAnswerSubmitted" @bank-changed="handleBankChanged" />
      </div>

      <Transition name="panel-slide">
        <div v-if="rightOpen" class="w-[340px] border-l border-border/50 overflow-y-auto min-h-0 flex-shrink-0 bg-background" data-tour="wrong">
          <WrongAnswerPanel :wrong-answers="wrongAnswers" @clear="wrongAnswers = []" />
        </div>
      </Transition>

      <!-- 浮动切换按钮 -->
      <div class="absolute bottom-6 flex gap-2 z-40" style="left: 50%; transform: translateX(-50%);" data-tour="panel-toggles">
        <button
          @click="toggleLeft"
          class="flex items-center gap-1.5 px-3 py-2 bg-background/95 backdrop-blur-sm border border-border/60 hover:border-primary/40 text-xs font-medium transition-all shadow-md"
          :class="{ 'border-primary/30 bg-primary/5': leftOpen }"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="transition-transform" :class="{ 'rotate-180': leftOpen }"><path d="m9 18 6-6-6-6"/></svg>
          统计
          <span v-if="hasStats" class="text-[10px] tabular-nums text-muted-foreground">{{ quizStats.correct }}/{{ quizStats.correct + quizStats.incorrect }}</span>
        </button>
        <button
          @click="toggleRight"
          class="flex items-center gap-1.5 px-3 py-2 bg-background/95 backdrop-blur-sm border border-border/60 hover:border-primary/40 text-xs font-medium transition-all shadow-md"
          :class="{ 'border-primary/30 bg-primary/5': rightOpen }"
        >
          错题本
          <span v-if="hasWrong" class="text-[10px] tabular-nums text-destructive">{{ wrongAnswers.length }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="transition-transform" :class="{ 'rotate-180': rightOpen }"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      </div>
    </div>

    <Toaster position="top-center" rich-colors />

    <ApiKeyDialog :open="showApiKeyDialog" @close="showApiKeyDialog = false" @saved="showApiKeyDialog = false" />

    <ExamHistoryPanel :open="showHistoryPanel" @close="showHistoryPanel = false" />
  </div>
</template>

<style>
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease;
  overflow: hidden;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}
</style>
