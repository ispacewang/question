<script setup>
defineProps({ class: { type: String, default: '' } })
</script>
<template>
  <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2" :class="$props.class"><slot /></div>
</template>
