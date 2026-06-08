<!-- DiagramBoard.vue — 数学图形渲染：JSXGraph 配置 或 SVG 兜底 -->
<template>
  <div v-if="hasContent" class="diagram-board-wrapper">
    <!-- SVG 直出 -->
    <div v-if="svgContent" v-html="sanitizedSvg" class="diagram-svg" />
    <!-- JSXGraph 画布 -->
    <div v-else ref="boardEl" class="diagram-jsx" :style="{ width: width + 'px', maxWidth: '100%' }" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import JXG from 'jsxgraph'

const props = defineProps({
  config: { type: Object, default: null },
  svg: { type: String, default: '' },
  width: { type: Number, default: 440 },
  height: { type: Number, default: 280 },
})

const boardEl = ref(null)
let boardInstance = null

const hasContent = computed(() => !!(props.config || props.svg))
const svgContent = computed(() => props.svg || '')
const sanitizedSvg = computed(() => {
  if (!props.svg) return ''
  return props.svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
})

function initBoard() {
  if (!props.config || svgContent.value) return
  if (!boardEl.value) return

  // 销毁旧实例
  if (boardInstance) {
    try { JXG.JSXGraph.freeBoard(boardInstance) } catch {}
    boardInstance = null
  }

  const cfg = props.config
  const bb = cfg.boundingbox || [-5, 5, 5, -5]
  const aspectW = bb[2] - bb[0]  // x 范围
  const aspectH = bb[1] - bb[3]  // y 范围
  const ratio = aspectW / (aspectH || 1)
  // 用 boundingbox 长宽比计算实际高度
  const actualHeight = Math.round(props.width / ratio)

  // 给容器设明确高度，防止 JSXGraph 绝对定位导致塌陷
  boardEl.value.style.height = actualHeight + 'px'

  try {
    boardInstance = JXG.JSXGraph.initBoard(boardEl.value, {
      boundingbox: bb,
      axis: cfg.axis !== false,
      grid: cfg.grid || false,
      showCopyright: false,
      showNavigation: false,
      keepaspectratio: true,
    })

    for (const el of (cfg.elements || [])) {
      try {
        boardInstance.create(el.type, el.attrs || [], el.opts || {})
      } catch (e) {
        console.warn('[DiagramBoard] element failed:', el.type, e.message)
      }
    }
  } catch (e) {
    console.error('[DiagramBoard] init failed:', e.message)
  }
}

onMounted(() => nextTick(() => setTimeout(initBoard, 200)))
watch(() => props.config, () => nextTick(() => setTimeout(initBoard, 250)))
onBeforeUnmount(() => {
  if (boardInstance) {
    try { JXG.JSXGraph.freeBoard(boardInstance) } catch {}
    boardInstance = null
  }
})
</script>

<style>
/* ── DiagramBoard wrapper ── */
.diagram-board-wrapper {
  margin: 1.25rem 0;
  border: 1px solid var(--color-border, rgba(0,0,0,0.08));
  overflow: hidden;
  background: var(--color-background, #fafaf9);
}
.diagram-jsx {
  max-width: 100%;
}
.diagram-svg {
  display: flex;
  justify-content: center;
  padding: 16px;
}
.diagram-svg svg {
  max-width: 100%;
  height: auto;
}

/* ── JSXGraph core styles (inlined from jsxgraph.css) ── */
.diagram-jsx .jxgbox {
  position: relative;
  overflow: hidden;
  background-color: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  margin: 0;
  width: 100% !important;
  height: 100% !important;
}
.diagram-jsx .jxgbox svg text {
  cursor: default;
  -webkit-user-select: none;
  user-select: none;
}
.diagram-jsx .jxgbox svg {
  overflow: hidden;
}
</style>
