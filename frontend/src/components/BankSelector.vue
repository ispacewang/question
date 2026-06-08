/** @file BankSelector.vue — 题库选择器，支持题库标签切换、拖拽/点击上传Excel、AI生成题库（液体流光按钮） */
<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- 错题库 -->
    <button
      v-if="mistakeBank.hasMistakes"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 select-none whitespace-nowrap border"
      :class="selectedBank === mistakeBank.id
        ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-800 dark:text-amber-300 shadow-sm'
        : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:border-border'"
      @click="selectBank(mistakeBank.id)"
    >
      <span class="text-sm leading-none">📝</span>
      <span class="max-w-[100px] truncate">{{ mistakeBank.name }}</span>
      <span class="text-[10px] font-bold px-1.5 leading-4 min-w-4 text-center rounded-none"
        :class="selectedBank === mistakeBank.id ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300' : 'bg-amber-400/10 text-amber-600 dark:text-amber-400'"
      >{{ mistakeBank.count }}</span>
    </button>

    <!-- 题库 -->
    <button
      v-for="bank in remoteBanks"
      :key="bank"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 select-none whitespace-nowrap border"
      :class="selectedBank === bank
        ? 'bg-primary/15 border-primary text-primary shadow-sm'
        : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:border-border'"
      @click="selectBank(bank)"
    >
      <span class="text-sm leading-none">📚</span>
      <span class="max-w-[100px] truncate">{{ bank }}</span>
      <span class="inline-flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-destructive text-sm leading-none ml-0.5" @click.stop="onDeleteBank(bank)">×</span>
    </button>

    <!-- AI 生成按钮（仅 AI 模式） -->
    <button
      v-if="isAiMode"
      @click="genDialogOpen = true"
      data-tour="gen-btn"
      class="liquid-btn inline-flex items-center px-3 py-1 text-xs font-semibold select-none whitespace-nowrap"
    >
      <span class="liquid-btn-inner px-2">✨ 生成题库</span>
      <span v-if="genStatus?.running" class="text-[9px] opacity-70 ml-1">{{ genStatus.progress || 0 }}</span>
    </button>

    <!-- 上传 -->
    <button
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted/30 border border-dashed border-muted-foreground/20 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 hover:border-solid transition-all duration-200 select-none whitespace-nowrap"
      @click="dialogVisible = true"
    >
      <span class="text-base font-light leading-none">+</span>
      <span>上传题库</span>
    </button>

    <!-- AI 生成弹窗 -->
    <Dialog :open="genDialogOpen" @update:open="genDialogOpen = $event" class="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle>AI 生成题库</DialogTitle>
        <DialogDescription>输入主题，AI 将自动生成题目并写入题库</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 p-1">
        <div class="space-y-1.5">
          <label class="text-xs font-medium">主题</label>
          <input v-model="genTopic" placeholder="如：铁路信号安全、高压电气…" class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary transition-colors" />
        </div>
        <div class="flex gap-3">
          <div class="flex-1 space-y-1.5">
            <label class="text-xs font-medium">题数</label>
            <input v-model.number="genTotal" type="number" min="10" max="2000" step="10" class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary" />
          </div>
          <div class="flex-1 space-y-1.5">
            <label class="text-xs font-medium">题库名（可选）</label>
            <input v-model="genBankName" placeholder="默认自动命名" class="w-full px-3 py-2 text-sm bg-background border border-border outline-none focus:border-primary" />
          </div>
        </div>

        <!-- 进度 -->
        <div v-if="genStatus" class="space-y-2 py-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">
              {{ genStatus.done ? `✅ 完成 — ${genStatus.count} 题` : genStatus.error ? `❌ ${genStatus.error}` : `生成中… ${genStatus.progress || 0} / ${genStatus.total || 500}` }}
            </span>
            <span v-if="genStatus.running" class="text-primary animate-pulse">⏳</span>
          </div>
          <div v-if="genStatus.running" class="w-full h-1.5 bg-muted overflow-hidden">
            <div class="h-full transition-all duration-500 rounded-none"
              style="background: linear-gradient(90deg, #667eea, #764ba2);"
              :style="{ width: ((genStatus.progress / genStatus.total) * 100) + '%' }"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="genDialogOpen = false" :disabled="genStatus?.running">取消</Button>
        <button v-if="!genStatus?.done" @click="startGenerate" :disabled="genStatus?.running || !genTopic.trim()"
          class="liquid-btn inline-flex items-center px-4 py-1.5 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span class="liquid-btn-inner px-3">
            {{ genStatus?.running ? '⏳ 生成中…' : '开始生成' }}
          </span>
        </button>
        <Button v-else @click="finishGenerate" class="gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
          完成
        </Button>
      </DialogFooter>
    </Dialog>

    <!-- 上传弹窗 -->
    <Dialog :open="dialogVisible" @update:open="dialogVisible = $event" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>上传题库</DialogTitle>
        <DialogDescription>支持 Excel/CSV，表头：题型、题干、选项、答案、解析</DialogDescription>
      </DialogHeader>
      <div
        class="flex flex-col items-center justify-center gap-4 py-8 px-4 border-2 border-dashed cursor-pointer transition-colors"
        :class="dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <Upload class="h-8 w-8 text-primary/60" />
        <p class="text-sm text-muted-foreground">拖入文件，或 <span class="text-primary font-medium">点击上传</span></p>
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onFileChange" />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="dialogVisible = false">取消</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Upload } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import axios from 'axios'
import Dialog from './ui/Dialog.vue'
import DialogHeader from './ui/DialogHeader.vue'
import DialogTitle from './ui/DialogTitle.vue'
import DialogDescription from './ui/DialogDescription.vue'
import DialogFooter from './ui/DialogFooter.vue'
import Button from './ui/Button.vue'
import { getBanks, uploadFile, deleteBank } from '../api'
import { getMistakeBook, MISTAKE_BOOK_ID } from '../utils/mistakeBook'
import { useAiMode } from '../composables/useAiMode'

const { isAiMode } = useAiMode()

const remoteBanks = ref([])
const selectedBank = ref('')
const dialogVisible = ref(false)
const dragOver = ref(false)
const fileInput = ref(null)
const emit = defineEmits(['bank-change'])

const mistakeBank = reactive({ id: MISTAKE_BOOK_ID, name: '错题库', hasMistakes: false, count: 0 })

// ─── AI 生成 ───
const genDialogOpen = ref(false)
const genTopic = ref('')
const genTotal = ref(500)
const genBankName = ref('')
const genStatus = ref(null)
let genPollTimer = null

/**
 * 发起 AI 题库生成请求，成功后开始轮询进度
 * @returns {Promise<void>}
 */
async function startGenerate() {
  if (!genTopic.value.trim()) return
  genStatus.value = { running: true, progress: 0, total: genTotal.value }
  try {
    const res = await axios.post('http://localhost:13002/api/ai/generate', {
      topic: genTopic.value,
      total: genTotal.value,
      bankName: genBankName.value || undefined,
    })
    if (res.data.ok) {
      pollGenStatus()
    }
  } catch (e) {
    genStatus.value = { error: e.response?.data?.error || '请求失败' }
  }
}

/**
 * 轮询 AI 生成进度，running 时每 3 秒查一次
 * @returns {Promise<void>}
 */
async function pollGenStatus() {
  try {
    const res = await axios.get('http://localhost:13002/api/ai/status')
    genStatus.value = res.data
    if (res.data.running) {
      genPollTimer = setTimeout(pollGenStatus, 3000)
    }
  } catch {
    genStatus.value = { error: '查询进度失败' }
  }
}

/**
 * 完成 AI 生成：关闭弹窗，刷新题库列表，自动选中新题库并播放碎屑动画
 */
function finishGenerate() {
  genDialogOpen.value = false
  const name = genStatus.value?.bankName || ''
  genTopic.value = ''
  genBankName.value = ''
  genStatus.value = null
  if (genPollTimer) clearTimeout(genPollTimer)
  fetchAll().then(() => {
    if (name) {
      // 自动选中新题库
      selectedBank.value = name
      emit('bank-change', name)
      spawnConfetti()
    }
  })
}

// 碎屑 — 从题库选择器区域散落
/**
 * 题库选择器区域散落彩色碎屑动画（25 个粒子）
 */
function spawnConfetti() {
  const container = document.querySelector('[data-tour="bank-selector"]')
  if (!container) return
  const rect = container.getBoundingClientRect()
  const colors = ['#4a7dbf', '#5d9b6a', '#b8954a', '#6b9fd4', '#c2655a']
  for (let i = 0; i < 25; i++) {
    setTimeout(() => {
      const el = document.createElement('div')
      const x = rect.left + Math.random() * rect.width
      const y = rect.top + Math.random() * rect.height * 0.3
      el.style.cssText = `
        position: fixed; z-index: 9999; pointer-events: none;
        width: ${3 + Math.random() * 6}px; height: ${3 + Math.random() * 6}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${x}px; top: ${y}px;
        --dx: ${(Math.random() - 0.5) * 120}px;
        --dy: ${40 + Math.random() * 80}px;
        --dr: ${200 + Math.random() * 500}deg;
        animation: confetti-local ${1 + Math.random() * 1.5}s ease-out forwards;
        animation-delay: ${Math.random() * 0.3}s;
      `
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 2500)
    }, i * 25)
  }
}
// ─── 题库管理 ───

/**
 * 拉取远端题库列表并更新错题库状态
 * @returns {Promise<void>}
 */
const fetchAll = async () => {
  try { const r = await getBanks(); remoteBanks.value = r.data.banks } catch {}
  const b = getMistakeBook(); mistakeBank.count = b.length; mistakeBank.hasMistakes = b.length > 0
}

/**
 * 选择/取消题库，再次点击同一题库可取消选中
 * @param {string} id - 题库名称/标识
 */
const selectBank = (id) => {
  if (selectedBank.value === id) { selectedBank.value = ''; emit('bank-change', '') }
  else { selectedBank.value = id; emit('bank-change', id) }
}

const onDrop = (e) => { dragOver.value = false; const file = e.dataTransfer?.files?.[0]; if (file) doUpload(file) }
const onFileChange = (e) => { const file = e.target?.files?.[0]; if (file) doUpload(file) }

/**
 * 上传题库文件（Excel/CSV），成功后刷新列表
 * @param {File} file - 用户选择的文件
 * @returns {Promise<void>}
 */
const doUpload = async (file) => {
  try { await uploadFile(file); toast.success('上传成功'); dialogVisible.value = false; fetchAll() }
  catch { toast.error('上传失败') }
}

/**
 * 删除题库，若正在使用该题库则自动取消选中
 * @param {string} name - 题库名称
 * @returns {Promise<void>}
 */
const onDeleteBank = async (name) => {
  try { await deleteBank(name); toast.success('已删除'); fetchAll(); if (selectedBank.value === name) { selectedBank.value = ''; emit('bank-change', '') } }
  catch { toast.error('删除失败') }
}

onMounted(fetchAll)
defineExpose({ refreshBanks: fetchAll })
</script>

<style>
/* 液体流光按钮 */
.liquid-btn {
  position: relative;
  border: none;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  z-index: 1;
  transition: transform 0.2s;
}
.liquid-btn:hover {
  transform: scale(1.04);
}
.liquid-btn::before {
  content: '';
  position: absolute;
  inset: -1.5px;
  border-radius: inherit;
  padding: 1.5px;
  background: conic-gradient(from var(--liquid-angle, 0deg), #4a7dbf, #5d9b6a, #6b9fd4, #b8954a, #4a7dbf);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: liquid-rotate 3s linear infinite;
  z-index: -1;
  transition: animation-duration 0.3s, inset 0.2s;
}
.liquid-btn:hover::before {
  animation-duration: 1s;
  inset: -2px;
  background: conic-gradient(from var(--liquid-angle, 0deg), #c2655a, #b8954a, #e879f9, #6b9fd4, #c2655a);
}
.liquid-btn-inner {
  position: relative;
  background: var(--color-background);
  z-index: 1;
}
@keyframes liquid-rotate {
  to { --liquid-angle: 360deg; }
}
@property --liquid-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

/* 局部碎屑 */
@keyframes confetti-local {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx, 40px), var(--dy, 80px)) rotate(var(--dr, 360deg)) scale(0); opacity: 0; }
}
</style>
