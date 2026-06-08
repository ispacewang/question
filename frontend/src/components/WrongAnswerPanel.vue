<template>
  <div class="h-full flex flex-col p-4">
    <div class="flex items-center justify-between pb-3 mb-3 border-b border-border/50 flex-shrink-0">
      <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">错题本</span>
      <div v-if="wrongAnswers.length > 0" class="flex items-center gap-2">
        <span class="text-[11px] text-muted-foreground font-medium tabular-nums">{{ wrongAnswers.length }} 题</span>
        <button class="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1" @click="$emit('clear')">清空</button>
      </div>
    </div>

    <!-- 无数据占位 -->
    <div v-if="wrongAnswers.length === 0" class="flex-1 flex flex-col items-center justify-center text-center">
      <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3 opacity-40">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <p class="text-xs text-muted-foreground">暂无错题</p>
      <p class="text-[10px] text-muted-foreground/60 mt-1">答题后错题自动收集</p>
    </div>

    <!-- 错题列表（可滚动） -->
    <div v-else class="flex-1 overflow-y-auto min-h-0 space-y-2">
      <div v-for="(item, i) in wrongAnswers" :key="item.questionData.questionId || i" class="py-3 border-b border-border/30 last:border-b-0">
        <p class="text-sm font-medium mb-2 leading-relaxed">{{ item.questionData.question }}</p>
        <div v-if="item.questionData.options?.length" class="flex flex-col gap-0.5 mb-2">
          <div v-for="(opt, j) in item.questionData.options" :key="j"
            class="text-[11px] px-1 py-0.5 flex gap-0.5"
            :class="item.questionData.correctAnswer?.includes(String.fromCharCode(65 + j)) ? 'text-success font-medium' : 'text-muted-foreground'"
          >
            <span class="font-semibold flex-shrink-0">{{ String.fromCharCode(65 + j) }}.</span>
            <span>{{ opt }}</span>
          </div>
        </div>
        <div class="flex gap-3 text-xs">
          <span class="text-destructive">你的 {{ fmtAns(item.questionData.userAnswer) }}</span>
          <span class="text-success font-medium">正确 {{ fmtAns(item.questionData.correctAnswer) }}</span>
        </div>
      </div>
    </div>

    <div class="relative pt-2.5 border-t border-border/50 flex-shrink-0">
      <Button variant="outline" size="sm" class="w-full text-xs" @click="showExportMenu = !showExportMenu">导出错题 ▾</Button>
      <div v-if="showExportMenu" class="absolute bottom-full left-0 right-0 bg-background border border-border shadow-lg mb-1">
        <button class="block w-full px-3.5 py-2 text-xs text-left hover:bg-muted transition-colors border-b border-border last:border-b-0" @click="handleExport('md')">Markdown</button>
        <button class="block w-full px-3.5 py-2 text-xs text-left hover:bg-muted transition-colors" @click="handleExport('txt')">纯文本</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/** @file WrongAnswerPanel.vue — 错题本面板，错题列表+导出Markdown/纯文本 */
import { ref } from 'vue'
import { saveAs } from 'file-saver'
import Button from './ui/Button.vue'

const props = defineProps({ wrongAnswers: { type: Array, required: true, default: () => [] } })
defineEmits(['clear'])
const showExportMenu = ref(false)

/**
 * 格式化答案显示：数组用逗号拼接，非数组直接返回
 * @param {string|string[]} a - 用户答案或正确答案
 * @returns {string} 格式化后的答案字符串
 */
const fmtAns = (a) => Array.isArray(a) ? a.join(', ') : (a || '')

/**
 * 生成错题本导出内容
 * @param {boolean} md - true 生成 Markdown 格式，false 生成纯文本格式
 * @returns {string} 格式化后的错题本内容
 */
const genContent = (md) => {
  let c = md ? '# 错题本\n\n' : '--- 错题本 ---\n\n'
  props.wrongAnswers.forEach((item, i) => {
    const q = item.questionData
    const ua = fmtAns(q.userAnswer), ca = fmtAns(q.correctAnswer)
    if (md) {
      c += `## ${i + 1}. ${q.question}\n\n`
      q.options?.forEach((o, j) => { c += `- ${String.fromCharCode(65 + j)}. ${o}\n` })
      c += '\n'
      c += `**你的答案：** \`${ua}\`\n**正确答案：** \`${ca}\`\n\n`
      if (q.explanation) c += `> **解析**\n> ${q.explanation}\n\n`
      c += '---\n\n'
    } else {
      c += `${i + 1}. ${q.question}\n`
      q.options?.forEach((o, j) => { c += `   ${String.fromCharCode(65 + j)}. ${o}\n` })
      c += `\n你的答案：${ua}\n正确答案：${ca}\n`
      if (q.explanation) c += `【解析】${q.explanation}\n`
      c += `\n${'='.repeat(32)}\n\n`
    }
  })
  return c
}

/**
 * 导出错题本文件
 * @param {string} fmt - 导出格式，'md' 为 Markdown，其他为纯文本
 */
const handleExport = (fmt) => {
  showExportMenu.value = false
  const blob = new Blob([genContent(fmt === 'md')], { type: 'text/plain;charset=utf-8' })
  const ts = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')
  saveAs(blob, `错题本_${ts}.${fmt}`)
}
</script>
