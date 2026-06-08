<template>
  <div class="flex flex-col gap-5 py-5 px-4 h-full overflow-y-auto">
    <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">答题统计</span>

    <div v-if="!hasData" class="flex flex-col items-center justify-center py-8 text-center">
      <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3 opacity-40">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
      </div>
      <p class="text-xs text-muted-foreground">暂无答题记录</p>
    </div>

    <template v-else>
      <!-- 数字统计 -->
      <div class="grid grid-cols-3 gap-3">
        <div class="text-center">
          <span class="block text-2xl font-bold tabular-nums text-success">{{ stats.correct }}</span>
          <span class="text-[10px] text-muted-foreground">✓ 正确</span>
        </div>
        <div class="text-center">
          <span class="block text-2xl font-bold tabular-nums text-destructive">{{ stats.incorrect }}</span>
          <span class="text-[10px] text-muted-foreground">✗ 错误</span>
        </div>
        <div class="text-center">
          <span class="block text-2xl font-bold tabular-nums">{{ rate }}%</span>
          <span class="text-[10px] text-muted-foreground">正确率</span>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="w-full h-1 bg-muted overflow-hidden">
        <div class="h-full bg-primary transition-all duration-500" :style="{ width: rate + '%' }" />
      </div>

      <!-- 雷达图 — 题型正确率 -->
      <div v-if="radarLabels.length > 0" class="space-y-1.5">
        <div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">题型正确率</div>
        <div class="h-[160px]">
          <Radar :data="radarData" :options="radarOptions" />
        </div>
      </div>

      <!-- 题型明细 -->
      <div v-if="hasTypeData" class="space-y-1.5">
        <div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">题型明细</div>
        <div v-for="t in typeBreakdown" :key="t.name" class="flex items-center justify-between text-xs py-0.5">
          <span class="text-muted-foreground">{{ t.name }}</span>
          <span class="tabular-nums">
            <span class="text-success font-medium">{{ t.correct }}</span>
            <span class="text-muted-foreground mx-0.5">/</span>
            <span class="text-destructive font-medium">{{ t.incorrect }}</span>
            <span class="text-muted-foreground ml-1 text-[10px]">({{ t.rate }}%)</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
/** @file StatsPanel.vue — 答题统计面板，数字统计+正确率进度条+题型雷达图+题型明细 */
import { computed } from 'vue'
import { Radar } from 'vue-chartjs'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps({
  stats: { type: Object, required: true, default: () => ({ correct: 0, incorrect: 0, byType: {} }) }
})

const total = computed(() => props.stats.correct + props.stats.incorrect)
const hasData = computed(() => total.value > 0)
const rate = computed(() => total.value > 0 ? Math.round(props.stats.correct / total.value * 100) : 0)

const typeOrder = ['单选题', '多选题', '判断题', '简答题', '填空题']
const hasTypeData = computed(() => typeOrder.some(t => props.stats.byType?.[t]?.total > 0))

/** 题型明细：按题型汇总正确/错误/正确率，仅展示有数据的题型 */
const typeBreakdown = computed(() =>
  typeOrder
    .filter(t => props.stats.byType?.[t]?.total > 0)
    .map(t => {
      const d = props.stats.byType[t]
      return { name: t, correct: d.correct, incorrect: d.incorrect, rate: d.total > 0 ? Math.round(d.correct / d.total * 100) : 0 }
    })
)

const radarLabels = computed(() => typeBreakdown.value.map(t => t.name))
/** 雷达图数据：每个题型正确率作为一个数据点，蓝色半透明填充 */
const radarData = computed(() => ({
  labels: radarLabels.value,
  datasets: [{
    data: typeBreakdown.value.map(t => t.rate),
    backgroundColor: 'rgba(74, 125, 191, 0.15)',
    borderColor: 'rgba(74, 125, 191, 0.7)',
    borderWidth: 1.5,
    pointBackgroundColor: 'rgba(74, 125, 191, 1)',
    pointBorderColor: '#fff',
    pointRadius: 3,
    pointHoverRadius: 5,
  }],
}))

/** 雷达图配置：极坐标范围 0-100，隐藏刻度，自定义 tooltip */
const radarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    r: {
      beginAtZero: true,
      max: 100,
      min: 0,
      ticks: { display: false, stepSize: 25 },
      pointLabels: { font: { size: 9 }, color: '#8e8e93' },
      grid: { color: 'rgba(0,0,0,0.06)' },
      angleLines: { color: 'rgba(0,0,0,0.06)' },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(29,29,31,0.9)',
      padding: 8,
      bodyFont: { size: 11 },
      cornerRadius: 0,
      callbacks: { label: (ctx) => ` 正确率: ${ctx.raw}%` },
    },
  },
}
</script>
