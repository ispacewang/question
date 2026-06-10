/** @file App.vue — 主布局，三栏刷题模式（统计|答题|错题）+ 考试模式 + AI 模式切换 */
<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import axios from 'axios'
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
const downloadingPaper = ref(false)
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

/** 下载 PDF（试卷 或 答案） */
async function downloadPaper(answer = false) {
  if (!examForm.value.bank || downloadingPaper.value) return
  downloadingPaper.value = true
  try {
    const body = { bankName: examForm.value.bank, answer }
    if (isAiBank.value) body.typeCounts = { ...examTypeCounts.value }
    const res = await axios.post('http://localhost:13002/api/download-paper', body, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${examForm.value.bank}_${answer ? '答案' : '试卷'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(answer ? '答案已下载' : '试卷已下载')
  } catch (e) {
    toast.error('下载失败：' + (e.response?.data?.error || e.message))
  } finally {
    downloadingPaper.value = false
  }
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

onMounted(() => {
  console.log('[App] onMounted: 开始, isAiMode=', isAiMode.value)
  aiModeModule.checkConfig().then(() => {
    console.log('[App] checkConfig完成: isAiMode=', isAiMode.value, 'apiConfigured=', apiConfigured.value)
    if (isAiMode.value) {
      console.log('[App] 调用 fetchModelList')
      fetchModelList()
    } else {
      console.log('[App] isAiMode=false, 跳过 fetchModelList')
    }
  })
})

// ─── AI 模式 ───
const aiModeModule = useAiMode()
const { aiMode, isAiMode, apiConfigured, saveApiKey, toggleMode, selectedModel, availableModels, modelsLoading, fetchModelList, selectModel } = aiModeModule
const showApiKeyDialog = ref(false)
const showModelDropdown = ref(false)

// 模型标签（简短显示名）
const modelLabel = computed(() => {
  if (!selectedModel.value) return '选择模型'
  if (selectedModel.value === 'deepseek-v4-pro') return 'V4 Pro'
  if (selectedModel.value === 'deepseek-v4-flash') return 'V4 Flash'
  return selectedModel.value.replace('deepseek-', '')
})

/** 全局切换模型 */
async function onGlobalModelSelect(modelId) {
  showModelDropdown.value = false
  await selectModel(modelId)
}

/** API Key 配置完成后的回调 */
async function onAiKeySaved() {
  console.log('[App] onAiKeySaved 触发')
  showApiKeyDialog.value = false
  await fetchModelList()
  console.log('[App] onAiKeySaved: fetchModelList完成, availableModels=', availableModels.value.length)
  if (!isAiMode.value) {
    console.log('[App] onAiKeySaved: 开启AI模式')
    toggleMode()
  }
}

// 点击外部关闭模型下拉
function handleClickOutside(e) {
  if (!e.target.closest('[data-tour="model-selector"]')) {
    showModelDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

watch(hasStats, (v) => { if (v) leftOpen.value = true })
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background">
    <TitleBar class="sticky top-0 z-50 flex-shrink-0" />

    <!-- 工具栏 -->
    <div v-if="!isExamMode" class="flex items-center justify-between px-4 py-1.5 border-b border-border/50 flex-shrink-0">
      <AppTour />
      <div class="flex items-center gap-1.5">
        <!-- 全局模型切换（仅 AI 模式） -->
        <div v-if="isAiMode" class="relative" data-tour="model-selector">
          <button
            @click="showModelDropdown = !showModelDropdown"
            class="flex items-center gap-1 px-2 py-1 text-[11px] transition-colors hover:text-primary"
            :class="showModelDropdown ? 'text-primary' : 'text-muted-foreground'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="opacity-80"><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"/></svg>
            <span class="max-w-[80px] truncate">{{ modelLabel }}</span>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <Transition name="drop-fade">
            <div v-if="showModelDropdown" class="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-background border border-border shadow-lg">
              <button
                v-for="m in availableModels"
                :key="m.id"
                @click="onGlobalModelSelect(m.id)"
                class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-muted"
                :class="selectedModel === m.id ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'"
              >
                <span class="w-1.5 h-1.5 flex-shrink-0" :class="selectedModel === m.id ? 'bg-primary' : 'bg-transparent'" />
                <span class="flex-1 truncate">{{ m.name || m.id }}</span>
                <span v-if="selectedModel === m.id" class="text-primary"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg></span>
              </button>
              <!-- 加载中 -->
              <div v-if="modelsLoading" class="px-3 py-3 text-center text-[10px] text-muted-foreground">
                <span class="animate-pulse">加载模型列表…</span>
              </div>
              <!-- 未配置 API Key -->
              <div v-else-if="!apiConfigured && availableModels.length === 0" class="px-3 py-3 text-center space-y-1.5">
                <div class="text-[10px] text-muted-foreground">请先配置 API Key</div>
                <button @click="showModelDropdown = false; showApiKeyDialog = true" class="text-[10px] text-primary hover:underline">去配置 →</button>
              </div>
              <!-- 加载完成但列表为空 -->
              <div v-else-if="!modelsLoading && availableModels.length === 0" class="px-3 py-3 text-center">
                <div class="text-[10px] text-muted-foreground">暂无模型列表</div>
                <button @click="fetchModelList()" class="mt-1 text-[10px] text-primary hover:underline">重试</button>
              </div>
            </div>
          </Transition>
        </div>
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
        <div class="flex items-center gap-1.5 mr-auto">
          <button
            @click="downloadPaper(false)"
            :disabled="!examForm.bank || downloadingPaper"
            class="flex items-center gap-1 px-2 py-1 text-[11px] transition-colors"
            :class="downloadingPaper ? 'text-muted-foreground' : 'text-muted-foreground hover:text-primary'"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {{ downloadingPaper ? '生成中…' : '试卷' }}
          </button>
          <button
            @click="downloadPaper(true)"
            :disabled="!examForm.bank || downloadingPaper"
            class="flex items-center gap-1 px-2 py-1 text-[11px] transition-colors"
            :class="downloadingPaper ? 'text-muted-foreground' : 'text-muted-foreground hover:text-primary'"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            答案
          </button>
          <span class="text-[9px] px-1 py-0.5 bg-amber-500/10 text-amber-600 font-bold">Beta</span>
        </div>
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

    <ApiKeyDialog :open="showApiKeyDialog" @close="showApiKeyDialog = false" @saved="onAiKeySaved" />

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

/* 模型下拉动画 */
.drop-fade-enter-active { transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
.drop-fade-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.drop-fade-enter-from { opacity: 0; transform: translateY(-4px); }
.drop-fade-leave-to { opacity: 0; transform: translateY(-2px); }
</style>