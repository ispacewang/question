<!-- src/components/AiChatPanel.vue — AI 答疑滑动面板 -->
<template>
  <Teleport to="body">
    <Transition name="ai-slide">
      <div v-if="visible" class="fixed inset-y-0 right-0 z-[60] w-[380px] flex flex-col bg-background border-l border-border shadow-2xl">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-primary">
              <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"/>
              <path d="M12 16c-3.3 0-6 2-6 4.5V22h12v-1.5c0-2.5-2.7-4.5-6-4.5z"/>
              <circle cx="12" cy="22" r="2" fill="currentColor"/>
            </svg>
            <span class="text-sm font-semibold">AI 答疑</span>
          </div>
          <button @click="close" class="flex items-center justify-center w-7 h-7 hover:bg-muted transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 题目预览 -->
        <div v-if="questionContext" class="px-4 py-2.5 border-b border-border bg-muted/10 text-xs leading-relaxed">
          <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">当前题目</span>
          <p class="mt-1 text-foreground/80 line-clamp-2">{{ questionContext.question }}</p>
          <p v-if="questionContext.type" class="mt-0.5 text-muted-foreground">{{ questionContext.type }} · 你的答案: {{ questionContext.userAnswer || '未答' }}</p>
        </div>

        <!-- 消息列表 -->
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3" ref="msgContainer">
          <!-- 加载进度 -->
          <div v-if="progressMsg && messages.length === 0" class="flex items-center justify-center py-8">
            <div class="text-xs text-muted-foreground text-center">
              <div class="w-6 h-6 border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
              {{ progressMsg }}
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!progressMsg && messages.length === 0 && !loading" class="flex flex-col items-center justify-center py-12 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" class="text-muted-foreground/40 mb-3">
              <circle cx="12" cy="12" r="10"/><path d="M8 9h.01M16 9h.01"/><path d="M8 13c0 2 2 3 4 3s4-1 4-3"/>
            </svg>
            <p class="text-xs text-muted-foreground">对这道题有疑问？<br/>输入你的问题，我来解答</p>
          </div>

          <!-- 消息 -->
          <div v-for="(msg, i) in messages" :key="i" class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
            <div
              class="max-w-[85%] px-3 py-2 text-sm leading-relaxed"
              :class="msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'"
            >{{ msg.content }}</div>
          </div>

          <!-- 加载动画 -->
          <div v-if="loading" class="flex justify-start">
            <div class="flex items-center gap-1.5 px-3 py-2 bg-muted">
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>

          <!-- 错误 -->
          <div v-if="error" class="px-3 py-2 text-xs text-destructive bg-destructive/10 border-l-2 border-destructive">
            {{ error }}
            <button @click="$emit('clear-error')" class="ml-2 underline hover:no-underline">关闭</button>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="px-3 py-2.5 border-t border-border bg-muted/20">
          <div class="flex items-end gap-2">
            <textarea
              :value="input"
              @input="$emit('update:input', $event.target.value)"
              @keydown.enter.exact.prevent="send"
              placeholder="输入你的问题…"
              rows="1"
              class="flex-1 resize-none bg-background border border-border px-3 py-2 text-sm placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
              :disabled="loading"
            />
            <button
              @click="send"
              :disabled="!canSend"
              class="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m5 12 7-7 7 7M12 19V5"/></svg>
            </button>
          </div>
          <p class="mt-1 text-[10px] text-muted-foreground/60">Enter 发送，Shift+Enter 换行</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, nextTick, ref } from 'vue'

const props = defineProps({
  visible: Boolean,
  messages: { type: Array, default: () => [] },
  loading: Boolean,
  progressMsg: { type: String, default: '' },
  error: { type: String, default: '' },
  input: { type: String, default: '' },
  canSend: Boolean,
  questionContext: Object,
})

const emit = defineEmits(['update:input', 'send', 'close', 'clear-error'])

const msgContainer = ref(null)

// 自动滚到底部
watch(() => [props.messages.length, props.loading], async () => {
  await nextTick()
  if (msgContainer.value) {
    msgContainer.value.scrollTop = msgContainer.value.scrollHeight
  }
})

function send() {
  emit('send')
}

function close() {
  emit('close')
}
</script>

<style scoped>
.ai-slide-enter-active,
.ai-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.ai-slide-enter-from,
.ai-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.ai-slide-enter-to,
.ai-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>
