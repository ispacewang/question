<script setup>
import { computed } from 'vue'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  variant: { type: String, default: 'default' },
  class: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'confirm', 'cancel'])

const contentClass = computed(() => cn(
  'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  props.class,
))

const actionClass = computed(() => cn(
  'inline-flex items-center justify-center h-9 px-4 py-2 text-sm font-medium rounded-none bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
  props.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : '',
))

const cancelClass = computed(() => cn(
  'inline-flex items-center justify-center h-9 px-4 py-2 text-sm font-medium rounded-none border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors',
))
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <AlertDialogContent :class="contentClass">
        <div class="flex flex-col space-y-2 text-center sm:text-left">
          <AlertDialogTitle>{{ title }}</AlertDialogTitle>
          <AlertDialogDescription v-if="description">{{ description }}</AlertDialogDescription>
        </div>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2">
          <AlertDialogCancel :class="cancelClass" @click="emit('cancel')">{{ cancelText }}</AlertDialogCancel>
          <AlertDialogAction :class="actionClass" @click="emit('confirm')">{{ confirmText }}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
