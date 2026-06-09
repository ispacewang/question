<template>
  <div v-if="open" class="fixed inset-0 z-40 flex">
    <!-- 遮罩 -->
    <div class="flex-1 bg-black/10 backdrop-blur-[1px]" @click="$emit('close')" />

    <!-- 面板 -->
    <div class="w-[380px] bg-background border-l border-border flex flex-col shadow-xl animate-drawer-in">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div class="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <h3 class="text-sm font-semibold">考试记录</h3>
        </div>
        <button @click="$emit('close')" class="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- 列表 -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="!sorted.length" class="flex flex-col items-center justify-center h-full gap-5 px-8 py-12">
          <div class="w-20 h-20 flex items-center justify-center border border-dashed border-border rounded-full">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" class="text-muted-foreground/40"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div class="text-center space-y-2">
            <p class="text-sm font-medium text-muted-foreground">暂无考试记录</p>
            <p class="text-xs text-muted-foreground/50 max-w-[240px] leading-relaxed">参加考试后点击「保存成绩」，即可在此查看历史记录与错题回顾</p>
          </div>
        </div>

        <div v-else class="p-4 space-y-2.5">
          <div
            v-for="r in sorted"
            :key="r.id"
            class="group border border-border/60 hover:border-primary/30 transition-colors cursor-pointer"
            :class="{ 'border-primary/30 bg-primary/[0.02]': viewingExam?.id === r.id }"
          >
            <div class="flex items-center gap-3.5 p-4" @click="toggleView(r)">
              <!-- 圆环 -->
              <div class="relative flex-shrink-0">
                <svg width="52" height="52" viewBox="0 0 52 52" class="-rotate-90">
                  <circle cx="26" cy="26" r="21" fill="none" stroke="var(--color-border)" stroke-width="4.5" />
                  <circle
                    cx="26" cy="26" r="21" fill="none"
                    :stroke="ringColor(r.percentage)"
                    stroke-width="4.5"
                    stroke-linecap="round"
                    :stroke-dasharray="131.9"
                    :stroke-dashoffset="131.9 * (1 - r.percentage / 100)"
                    class="transition-all duration-700"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-[11px] font-bold tabular-nums leading-none">{{ r.percentage }}%</span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ fmtBankName(r.bankName) }}</p>
                <p class="text-[10px] text-muted-foreground mt-0.5">{{ r.date }} · {{ r.duration }}分钟</p>
                <div class="flex items-center gap-2 mt-1.5">
                  <span class="text-[10px] text-success font-medium">{{ r.score }}/{{ r.total }} 正确</span>
                  <span v-if="r.wrongCount" class="text-[10px] text-destructive font-medium">{{ r.wrongCount }} 错误</span>
                </div>
              </div>

              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                class="flex-shrink-0 text-muted-foreground transition-transform duration-200"
                :class="{ 'rotate-90': viewingExam?.id === r.id }"
              ><path d="m9 18 6-6-6-6"/></svg>
            </div>

            <!-- 展开：错题详情 -->
            <Transition name="expand">
              <div v-if="viewingExam?.id === r.id" class="px-4 pb-4 border-t border-border/30 space-y-3">
                <div v-if="r.wrongSet && r.wrongSet.length" class="space-y-2.5 pt-4">
                  <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">错题回顾</p>
                  <div
                    v-for="wi in r.wrongSet"
                    :key="wi"
                    class="text-xs p-3 border border-border/40 space-y-2"
                  >
                    <div class="flex items-center gap-1.5">
                      <Badge variant="outline" class="text-[9px]! px-1! py-0!">{{ r.questions[wi]?.type }}</Badge>
                      <span class="text-[10px] text-muted-foreground">第 {{ wi + 1 }} 题</span>
                    </div>
                    <KatexRender class="leading-relaxed" :text="r.questions[wi]?.question" />
                    <div class="flex gap-4 pt-1.5 border-t border-border/20">
                      <span class="text-destructive"><X class="size-3 inline-block -mt-0.5" /> {{ fmtUserAns(r, wi) }}</span>
                      <span class="text-success"><Check class="size-3 inline-block -mt-0.5" /> {{ r.wrongDetails[wi]?.answer || '?' }}</span>
                    </div>
                    <KatexRender v-if="r.wrongDetails[wi]?.explanation" class="text-[10px] text-muted-foreground pt-1.5 border-t border-border/20 leading-relaxed" :text="r.wrongDetails[wi].explanation" />
                  </div>
                </div>
                <div v-else class="pt-4 text-xs text-success font-medium"><Trophy class="size-4 inline-block -mt-0.5" /> 满分通过！</div>

                <button
                  @click.stop="removeRecord(r.id)"
                  class="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >删除此记录</button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/** @file ExamHistoryPanel.vue — 考试历史面板，右侧滑入，环形进度条+错题回顾+删除 */
import { ref } from 'vue'
import Badge from './ui/Badge.vue'
import KatexRender from './KatexRender.vue'
import { useExamHistory } from '../composables/useExamHistory'
import { X, Check, Trophy } from 'lucide-vue-next'

defineProps({ open: Boolean })
defineEmits(['close'])

const { sorted, removeExam } = useExamHistory()
const viewingExam = ref(null)

/**
 * 切换考试记录的展开/折叠状态
 * @param {Object} record - 考试记录对象，含 id 字段
 */
function toggleView(record) {
  viewingExam.value = viewingExam.value?.id === record.id ? null : record
}

/**
 * 根据正确率返回环形进度条颜色
 * @param {number} pct - 正确率百分比 (0-100)
 * @returns {string} CSS 变量：≥80 绿色，≥60 黄色，否则红色
 */
function ringColor(pct) {
  if (pct >= 80) return 'var(--color-success)'
  if (pct >= 60) return 'var(--color-warning)'
  return 'var(--color-destructive)'
}

/**
 * 格式化题库名称：去除"AI题库_"前缀和尾部 hash
 * @param {string} name - 原始题库名称
 * @returns {string} 格式化后的显示名称
 */
function fmtBankName(name) {
  if (!name) return '未知题库'
  return name.replace(/^AI题库_/, '').replace(/_[a-z0-9]+$/, '')
}

/**
 * 格式化用户提交的答案用于错题展示
 * @param {Object} record - 考试记录
 * @param {number} wi - 题目索引
 * @returns {string} 格式化后的答案文本
 */
function fmtUserAns(record, wi) {
  const q = record.questions[wi]
  const a = record.answers[wi]
  if (q?.type === '多选题' && Array.isArray(a)) return a.join(', ')
  return a || '(未答)'
}

/**
 * 删除考试记录，若当前正在查看该记录则同时关闭展开
 * @param {number} id - 记录 ID
 */
function removeRecord(id) {
  removeExam(id)
  if (viewingExam.value?.id === id) viewingExam.value = null
}
</script>

<style scoped>
@keyframes drawerIn {
  from { transform: translateX(40px); opacity: 0.7; }
  to { transform: translateX(0); opacity: 1; }
}
.animate-drawer-in {
  animation: drawerIn 0.2s ease;
}

.expand-enter-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-leave-active {
  transition: all 0.15s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 2000px;
}
</style>
