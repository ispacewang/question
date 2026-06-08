<script setup>
import { computed } from 'vue'
import { SelectItem, SelectItemText } from 'radix-vue'
import { Check } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps({
  value: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: '' },
})

const itemClass = computed(() => cn(
  'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  props.class,
))
</script>

<template>
  <SelectItem :value="value" :disabled="disabled" :class="itemClass">
    <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <Check class="h-4 w-4" />
    </span>
    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>
