<template>
  <div v-if="wrongAnswers.length > 0" class="h-full flex flex-col p-4">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between pb-3 mb-3 border-b border-border flex-shrink-0">
      <span class="text-sm font-semibold text-foreground">错题本</span>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-muted-foreground font-medium">{{ wrongAnswers.length }} 题</span>
        <button
          class="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1"
          @click="$emit('clear')"
          title="清空错题本"
        >清空</button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-for="(item, i) in wrongAnswers" :key="item.questionData.questionId || i" class="flex gap-2.5 py-3.5 border-b border-border last:border-b-0">
        <div class="flex items-center justify-center w-6 h-6 border border-destructive text-destructive text-[11px] font-bold flex-shrink-0 mt-0.5">{{ i + 1 }}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium mb-2 leading-relaxed">{{ item.questionData.question }}</p>
          <div v-if="item.questionData.options?.length" class="flex flex-col gap-0.5 mb-2">
            <div v-for="(opt, j) in item.questionData.options" :key="j"
              class="text-[11px] px-1 py-0.5 flex gap-0.5"
              :class="item.questionData.correctAnswer?.includes(String.fromCharCode(65 + j)) ? 'text-success font-medium' : 'text-muted-foreground'"
            >
              <span class="font-semibold flex-shrink-0" :class="item.questionData.correctAnswer?.includes(String.fromCharCode(65 + j)) ? 'text-success' : 'text-muted-foreground'">{{ String.fromCharCode(65 + j) }}.</span>
              <span>{{ opt }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1 mb-2">
            <div class="flex items-center gap-1.5 text-xs">
              <span class="text-muted-foreground font-medium flex-shrink-0 min-w-[26px] text-[11px]">你的</span>
              <span class="font-semibold text-[11px] px-1.5 py-0.5 border border-destructive/20 bg-destructive/5 text-destructive">{{ fmtAns(item.questionData.userAnswer) }}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs">
              <span class="text-muted-foreground font-medium flex-shrink-0 min-w-[26px] text-[11px]">正确</span>
              <span class="font-semibold text-[11px] px-1.5 py-0.5 border border-success/20 bg-success/5 text-success">{{ fmtAns(item.questionData.correctAnswer) }}</span>
            </div>
          </div>
          <div v-if="item.questionData.explanation" class="mt-1.5 p-2 bg-muted border-l-2 border-primary">
            <span class="text-[10px] font-semibold text-primary uppercase tracking-wider block mb-0.5">解析</span>
            <p class="text-[11px] leading-relaxed text-muted-foreground m-0">{{ item.questionData.explanation }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出 -->
    <div class="relative pt-2.5 border-t border-border flex-shrink-0">
      <Button variant="outline" size="sm" class="w-full" @click="showExportMenu = !showExportMenu">
        导出错题 ▾
      </Button>
      <div v-if="showExportMenu" class="absolute bottom-full left-0 right-0 bg-background border border-border overflow-hidden mb-1 shadow-lg">
        <button class="block w-full px-3.5 py-2 text-xs text-left hover:bg-muted transition-colors border-b border-border last:border-b-0" @click="handleExport('md')">Markdown</button>
        <button class="block w-full px-3.5 py-2 text-xs text-left hover:bg-muted transition-colors" @click="handleExport('txt')">纯文本</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { saveAs } from 'file-saver'
import Button from './ui/Button.vue'

const props = defineProps({ wrongAnswers: { type: Array, required: true, default: () => [] } })
defineEmits(['clear'])
const showExportMenu = ref(false)

const fmtAns = (a) => Array.isArray(a) ? a.join(', ') : (a || '')

const genContent = (md) => {
  let c = md ? '# 错题本\n\n' : '--- 错题本 ---\n\n'
  props.wrongAnswers.forEach((item, i) => {
    const q = item.questionData
    const ua = fmtAns(q.userAnswer), ca = fmtAns(q.correctAnswer)
    if (md) {
      c += `## ${i + 1}. ${q.question}\n\n`
      q.options?.forEach((o, j) => { c += `- ${String.fromCharCode(65 + j)}. ${o}\n` })
      if (q.options?.length) c += '\n'
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

const handleExport = (fmt) => {
  showExportMenu.value = false
  const blob = new Blob([genContent(fmt === 'md')], { type: 'text/plain;charset=utf-8' })
  const ts = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')
  saveAs(blob, `错题本_${ts}.${fmt}`)
}
</script>
