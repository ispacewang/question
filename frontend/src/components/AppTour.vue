<script setup>
/** @file AppTour.vue — driver.js 功能引导，新用户自动播放 */
import { ref, onMounted } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * 引导步骤数组，每个步骤对应一个页面区域。
 * element 使用 data-tour 属性定位，popover 定义标题和描述文字。
 */
const steps = [
  {
    element: '[data-tour="bank-selector"]',
    popover: {
      title: '题库切换',
      description: '点击题库标签选中练习的题库。再次点击取消选中。上传题库按钮支持 Excel/CSV 一键导入。',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="quiz"]',
    popover: {
      title: '答题区',
      description: '点击选项选中答案。提交后正确选项标绿、错误标红。左上角 [全部|单选|多选|判断] 可筛选题型。⚡ 速刷自动跳题。',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="panel-toggles"]',
    popover: {
      title: '统计 & 错题本',
      description: '底部两个浮动按钮控制侧栏。点击可展开答题统计（正确率、雷达图）和错题本（回顾错题、导出）。答题时可收起侧栏专注刷题。',
      side: 'top',
    },
  },
  {
    element: '[data-tour="exam-btn"]',
    popover: {
      title: '考试模式',
      description: '点击这里进入考试。选择题库和时长后生成完整试卷（单选/多选/判断），计时作答。',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="theme-btn"]',
    popover: {
      title: '深色模式',
      description: '点击 🌙/☀ 切换浅色和深色模式。',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="history-btn"]',
    popover: {
      title: '考试记录',
      description: '点击「我的」查看历史考试成绩。每次交卷后可保存成绩、回顾错题。右上角数字显示已保存的考试数量。',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="ai-mode-btn"]',
    popover: {
      title: 'AI 生成题库',
      description: '点击这里开启 AI 模式。输入 DeepSeek API Key 后，即可用 AI 自动生成单选/多选/判断/简答/填空题。生成的题库可直接使用，也支持 AI 辅助判题。',
      side: 'bottom',
      popoverClass: 'driver-popover driver-popover-beta',
    },
  },
]

/** driver.js 实例配置：显示进度、支持关闭、中文按钮文案 */
const driverObj = driver({
  showProgress: true,
  steps,
  popoverClass: 'driver-popover',
  animate: true,
  overlayColor: 'rgba(0, 0, 0, 0.4)',
  smoothScroll: true,
  allowClose: true,
  stagePadding: 4,
  prevBtnText: '上一步',
  nextBtnText: '下一步',
  doneBtnText: '知道了',
  progressText: '{{current}} / {{total}}',
})

const runTour = () => { driverObj.drive() }

onMounted(() => {
  if (!localStorage.getItem('tour-shown-v7')) {
    setTimeout(() => {
      driverObj.drive()
      localStorage.setItem('tour-shown-v7', '1')
    }, 800)
  }
})

defineExpose({ runTour })
</script>

<template>
  <button
    class="inline-flex items-center justify-center w-7 h-7 text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors"
    title="功能引导"
    @click="runTour"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
    </svg>
  </button>
</template>

<style>
.driver-popover.driverjs-theme {
  border-radius: 0 !important; border: 1px solid var(--color-border) !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15) !important; background: var(--color-card) !important; color: var(--color-foreground) !important;
}
.driver-popover-beta.driverjs-theme {
  background: #f0f4fb !important;
}
.dark .driver-popover-beta.driverjs-theme {
  background: #1e2430 !important;
}
.driver-popover .driver-popover-title {
  font-family: var(--font-sans) !important; font-size: 15px !important; font-weight: 650 !important;
  color: var(--color-foreground) !important; border-bottom: 1px solid var(--color-border) !important;
  padding-bottom: 10px !important; margin-bottom: 8px !important;
}
.driver-popover-beta .driver-popover-title::after {
  content: 'Beta';
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 700;
  color: #b8954a;
  background: #fef3c7;
  border: 1px solid #f59e0b30;
  vertical-align: middle;
}
.driver-popover .driver-popover-description { font-size: 13px !important; color: var(--color-muted-foreground) !important; line-height: 1.6 !important; }
.driver-popover .driver-popover-footer button { border-radius: 0 !important; font-size: 12px !important; font-weight: 500 !important; text-shadow: none !important; }
.driver-popover .driver-popover-next-btn { background: var(--color-primary) !important; color: var(--color-primary-foreground) !important; border: none !important; }
.driver-popover .driver-popover-prev-btn { background: transparent !important; color: var(--color-muted-foreground) !important; border: 1px solid var(--color-border) !important; }
.driver-popover .driver-popover-close-btn { color: var(--color-muted-foreground) !important; }
.driver-popover .driver-popover-progress-text { font-size: 11px !important; color: var(--color-muted-foreground) !important; }
</style>
