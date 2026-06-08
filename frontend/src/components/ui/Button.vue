<script setup>
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'default' },
  class: { type: String, default: '' },
})

const klass = computed(() => cn(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    'bg-primary text-primary-foreground shadow hover:bg-primary/90': props.variant === 'default',
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90': props.variant === 'destructive',
    'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground': props.variant === 'outline',
    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80': props.variant === 'secondary',
    'hover:bg-accent hover:text-accent-foreground': props.variant === 'ghost',
    'text-primary underline-offset-4 hover:underline': props.variant === 'link',
  },
  {
    'h-7 px-2.5 text-xs': props.size === 'xs',
    'h-8 px-3 text-xs': props.size === 'sm',
    'h-9 px-4 py-2': props.size === 'default',
    'h-10 px-6 text-base': props.size === 'lg',
    'h-9 w-9': props.size === 'icon',
  },
  props.class,
))
</script>

<template>
  <button :class="klass">
    <slot />
  </button>
</template>
