<!-- KatexRender.vue — 混合文本渲染：自动识别 $...$ 行内公式 / $$...$$ 块级公式
     当文本不含 $ 分隔符但包含数学特征时，自动探测并包裹公式 -->
<template>
  <span class="katex-render-root">
    <template v-for="(seg, i) in segments" :key="i">
      <KatexMath v-if="seg.type === 'math'" :expr="seg.content" />
      <KatexMath v-else-if="seg.type === 'block'" :expr="seg.content" :display-mode="true" />
      <span v-else>{{ seg.content }}</span>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import KatexMath from './KatexMath.vue'

const props = defineProps({
  text: { type: String, default: '' },
})

const MATH_BLOCK_RE = /\$\$([\s\S]*?)\$\$/g
const MATH_INLINE_RE = /(?<!\\)\$([^\s$](?:[^$]*?[^\s\\])?)\$/g

/** 检测文本是否包含数学特征（用于无 $ 分隔符时的自动探测） */
const MATH_FEATURES = [
  // LaTeX 命令
  /\\sqrt\b/, /\\frac\b/, /\\sum\b/, /\\int\b/, /\\lim\b/, /\\prod\b/,
  /\\sin\b/, /\\cos\b/, /\\tan\b/, /\\log\b/, /\\ln\b/,
  /\\pi\b/, /\\theta\b/, /\\alpha\b/, /\\beta\b/, /\\gamma\b/,
  /\\delta\b/, /\\epsilon\b/, /\\lambda\b/, /\\mu\b/, /\\sigma\b/,
  /\\omega\b/, /\\infty\b/, /\\partial\b/, /\\nabla\b/,
  /\\pm\b/, /\\times\b/, /\\div\b/, /\\cdot\b/,
  /\\leq\b/, /\\geq\b/, /\\neq\b/, /\\approx\b/,
  /\\rightarrow\b/, /\\Rightarrow\b/, /\\leftarrow\b/,
  /\\subset\b/, /\\supset\b/, /\\in\b/, /\\notin\b/,
  /\\forall\b/, /\\exists\b/, /\\emptyset\b/,
  // Unicode 数学符号
  /[√πθ∞±×÷≤≥≠≈→⇒∂∇∑∫∏αβγδελμσω]/,
  // 上下标模式：x^2, a_i, x^{n+1}, a_{ij}
  /[a-zA-Z0-9)\]]\^[{]?[a-zA-Z0-9+\-*/()[\]]+[}]?/,
  /[a-zA-Z0-9)\]]_[{][a-zA-Z0-9+\-*/()[\]]+[}]/,
  /[a-zA-Z0-9)\]]_[a-zA-Z0-9]+/,
]

const segments = computed(() => {
  const text = props.text || ''
  if (!text) return [{ type: 'text', content: '' }]

  // ── 有 $ 分隔符 → 正常解析 ──
  if (text.includes('$')) {
    const blocks = []
    const noBlocks = text.replace(MATH_BLOCK_RE, (_, m) => {
      blocks.push(m)
      return `\x00BLOCK${blocks.length - 1}\x00`
    })

    const rawParts = []
    let last = 0
    for (const m of noBlocks.matchAll(MATH_INLINE_RE)) {
      if (m.index > last) rawParts.push({ type: 'text', content: noBlocks.slice(last, m.index) })
      rawParts.push({ type: 'math', content: m[1] })
      last = m.index + m[0].length
    }
    if (last < noBlocks.length) rawParts.push({ type: 'text', content: noBlocks.slice(last) })

    const parts = []
    for (const p of rawParts) {
      if (p.type === 'text') parts.push(...expandBlocks(p.content, blocks))
      else parts.push(p)
    }
    return parts.length ? parts : [{ type: 'text', content: text }]
  }

  // ── 无 $ 分隔符 → 自动探测数学公式 ──
  return autoDetectMath(text)
})

/** 展开 block 占位符 */
function expandBlocks(str, blocks) {
  const out = []
  let last = 0
  const re = /\x00BLOCK(\d+)\x00/g
  for (const m of str.matchAll(re)) {
    if (m.index > last) out.push({ type: 'text', content: str.slice(last, m.index) })
    out.push({ type: 'block', content: blocks[+m[1]] })
    last = m.index + m[0].length
  }
  if (last < str.length) out.push({ type: 'text', content: str.slice(last) })
  return out
}

/**
 * 自动探测文本中的数学公式片段并包裹 $...$
 * 仅对 纯公式文本（无中文字符） 做自动包裹，避免误伤混合文本
 */
function autoDetectMath(text) {
  // 如果包含中文，说明是混合文本，不自动检测（需要用户/模型显式用 $...$）
  if (/[\u4e00-\u9fff]/.test(text)) {
    return [{ type: 'text', content: text }]
  }
  // 纯公式文本（如 "x^2 + 2x + 1" "E = mc^2"）→ 整体渲染为行内公式
  if (hasMathFeatures(text)) {
    return [{ type: 'math', content: text }]
  }
  return [{ type: 'text', content: text }]
}

/** 检测字符串是否包含数学特征 */
function hasMathFeatures(str) {
  return MATH_FEATURES.some(re => re.test(str))
}
</script>
