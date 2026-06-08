<script setup>
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  variant: { type: String, default: 'default' },
  class: { type: String, default: '' },
})

const klass = computed(() => cn(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    'border-transparent bg-primary text-primary-foreground shadow': props.variant === 'default',
    'border-transparent bg-secondary text-secondary-foreground': props.variant === 'secondary',
    'border-transparent bg-destructive text-destructive-foreground': props.variant === 'destructive',
    'border-transparent bg-success/10 text-success': props.variant === 'success',
    'border-transparent bg-warning/10 text-warning': props.variant === 'warning',
    'text-foreground': props.variant === 'outline',
  },
  props.class,
))
</script>

<template>
  <span :class="klass">
    <slot />
  </span>
</template>
