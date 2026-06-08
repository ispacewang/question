<script setup>
import { DialogTitle } from 'radix-vue'

defineProps({ class: { type: String, default: '' } })
</script>
<template>
  <DialogTitle class="text-lg font-semibold leading-none tracking-tight" :class="$props.class"><slot /></DialogTitle>
</template>
