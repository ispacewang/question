<template>
  <div class="flex flex-col items-center gap-5 py-6 px-4 h-full overflow-y-auto">
    <!-- 环形图 -->
    <div class="relative w-[120px] h-[120px] flex-shrink-0">
      <Doughnut v-if="hasData" :data="donutData" :options="donutOptions" />
      <div v-else class="flex items-center justify-center h-full">
        <div class="w-[90px] h-[90px] rounded-full border-[10px] border-muted" />
      </div>
      <div v-if="hasData" class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-xl font-bold tabular-nums">{{ rate }}%</span>
        <span class="text-[10px] text-muted-foreground">正确率</span>
      </div>
    </div>

    <!-- 数字行 -->
    <div class="flex items-center gap-4 w-full justify-center">
      <div class="text-center">
        <span class="block text-lg font-bold text-success">{{ stats.correct }}</span>
        <span class="text-[10px] text-muted-foreground">正确</span>
      </div>
      <div class="w-px h-7 bg-border" />
      <div class="text-center">
        <span class="block text-lg font-bold text-destructive">{{ stats.incorrect }}</span>
        <span class="text-[10px] text-muted-foreground">错误</span>
      </div>
      <div class="w-px h-7 bg-border" />
      <div class="text-center">
        <span class="block text-lg font-bold">{{ stats.correct + stats.incorrect }}</span>
        <span class="text-[10px] text-muted-foreground">总题</span>
      </div>
    </div>

    <!-- 题类型柱形图 -->
    <div v-if="hasTypeData" class="w-full flex-shrink-0">
      <div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">题型分布</div>
      <div class="h-[120px]">
        <Bar :data="barData" :options="barOptions" />
      </div>
    </div>

    <div v-if="!hasData" class="text-xs text-muted-foreground text-center">暂无答题记录</div>

    <!-- AI 诊断 -->
    <div class="w-full mt-4 pt-4 border-t border-border">
      <button
        @click="runDiagnosis"
        :disabled="aiLoading || !hasData"
        class="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg v-if="!aiLoading" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"/>
          <circle cx="12" cy="22" r="2" fill="currentColor"/>
        </svg>
        <svg v-else class="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="30 70"/></svg>
        {{ aiLoading ? aiProgressMsg || '分析中…' : '🤖 AI 诊断薄弱点' }}
      </button>

      <!-- 诊断结果 -->
      <div v-if="aiDiagnosis" class="mt-3 p-3 bg-primary/5 border-l-2 border-primary text-xs leading-relaxed text-foreground/85">
        {{ aiDiagnosis }}
      </div>

      <!-- 错误 -->
      <div v-if="aiError" class="mt-2 text-[11px] text-destructive px-1">
        {{ aiError }}
        <button @click="aiError = ''" class="ml-1 underline">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Doughnut, Bar } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, BarElement, CategoryScale, LinearScale } from 'chart.js'
import { useAiDiagnosis } from '../composables/useAiDiagnosis'
ChartJS.register(ArcElement, Tooltip, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  stats: { type: Object, required: true, default: () => ({ correct: 0, incorrect: 0, byType: {} }) }
})

const total = computed(() => props.stats.correct + props.stats.incorrect)
const hasData = computed(() => total.value > 0)
const rate = computed(() => total.value > 0 ? Math.round(props.stats.correct / total.value * 100) : 0)

const typeOrder = ['单选题', '多选题', '判断题', '简答题']
const hasTypeData = computed(() => {
  return typeOrder.some(t => props.stats.byType?.[t]?.total > 0)
})

const barData = computed(() => ({
  labels: typeOrder.filter(t => props.stats.byType?.[t]?.total > 0),
  datasets: [
    {
      label: '正确',
      data: typeOrder.filter(t => props.stats.byType?.[t]?.total > 0).map(t => props.stats.byType[t].correct),
      backgroundColor: '#5d9b6a',
      borderWidth: 0,
      borderRadius: 0,
      barPercentage: 0.6,
    },
    {
      label: '错误',
      data: typeOrder.filter(t => props.stats.byType?.[t]?.total > 0).map(t => props.stats.byType[t].incorrect),
      backgroundColor: '#c2655a',
      borderWidth: 0,
      borderRadius: 0,
      barPercentage: 0.6,
    },
  ],
}))

const donutData = computed(() => ({
  datasets: [{
    data: [props.stats.correct || 0.1, props.stats.incorrect || 0.1],
    backgroundColor: ['#4a7dbf', '#e0ded9'],
    borderWidth: 0,
  }]
}))

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '75%',
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  events: [],
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  stacked: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(29, 29, 31, 0.9)',
      padding: 8,
      bodyFont: { size: 11 },
      cornerRadius: 0,
    },
  },
  scales: {
    x: {
      stacked: true,
      display: false,
      grid: { display: false },
    },
    y: {
      stacked: true,
      ticks: {
        font: { size: 10 },
        color: '#86868b',
        padding: 4,
      },
      grid: { display: false },
      border: { display: false },
    },
  },
}

// AI 诊断
const { diagnosis: aiDiagnosis, loading: aiLoading, progressMsg: aiProgressMsg, error: aiError, runDiagnosis } = useAiDiagnosis(computed(() => props.stats))
</script>
