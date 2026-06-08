<script setup>
import { SelectLabel } from 'radix-vue'

defineProps({ class: { type: String, default: '' } })
</script>
<template>
  <SelectLabel class="px-2 py-1.5 text-sm font-semibold" :class="$props.class"><slot /></SelectLabel>
</template>
