<script setup>
import { DialogDescription } from 'radix-vue'

defineProps({ class: { type: String, default: '' } })
</script>
<template>
  <DialogDescription class="text-sm text-muted-foreground" :class="$props.class"><slot /></DialogDescription>
</template>
