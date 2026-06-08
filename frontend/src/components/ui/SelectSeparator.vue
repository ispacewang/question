<script setup>
import { SelectSeparator } from 'radix-vue'

defineProps({ class: { type: String, default: '' } })
</script>
<template>
  <SelectSeparator class="-mx-1 my-1 h-px bg-muted" :class="$props.class" />
</template>
