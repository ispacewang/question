<!-- KatexMath.vue — 单条 LaTeX 公式渲染，支持 inline / block 两种模式 -->
<template>
  <span v-if="displayMode" v-html="rendered" class="katex-block-wrapper" />
  <span v-else v-html="rendered" class="katex-inline-wrapper" />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import katex from 'katex'

const props = defineProps({
  expr: { type: String, required: true },
  displayMode: { type: Boolean, default: false },
  throwOnError: { type: Boolean, default: false },
})

const rendered = ref('')

function renderMath() {
  if (!props.expr) { rendered.value = ''; return }
  try {
    rendered.value = katex.renderToString(props.expr.trim(), {
      displayMode: props.displayMode,
      throwOnError: props.throwOnError,
      strict: false,
      trust: true,
    })
  } catch (e) {
    rendered.value = `<span class="katex-error" title="${e.message}">${props.expr}</span>`
  }
}

onMounted(renderMath)
watch(() => [props.expr, props.displayMode], renderMath)
</script>

<style>
/* ═══════════ KaTeX inline style normalization ═══════════ */
.katex-inline-wrapper .katex { font-size: 1.05em; }

.katex-block-wrapper {
  display: block;
  margin: 0.75em 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}
.katex-block-wrapper .katex { font-size: 1.1em; }

/* 错误回退 */
.katex-error {
  color: var(--color-destructive);
  font-style: italic;
  background: rgba(194, 101, 90, 0.08);
  padding: 0 0.25em;
}
</style>
