<template>
  <div class="card" :style="{ borderColor: scheme.border, background: scheme.bg }">
    <div
      class="text"
      :style="{ color: fontColor || scheme.text, fontSize: fontSize + 'px', fontFamily: fontFamily || undefined, transform: `translate(${textX}px, ${textY}px)` }"
    ><HighlightText :text="text" :target="highlightText" :style-id="highlightStyle" :highlight-color="highlightColor" /></div>
  </div>
</template>

<script setup>
import HighlightText from './HighlightText.vue'

defineProps({
  text: { type: String, default: '' },
  fontSize: { type: Number, default: 22 },
  scheme: {
    type: Object,
    default: () => ({ border: '#ff7043', bg: '#ffffff', text: '#1a1a1a' }),
  },
  textX: { type: Number, default: 0 },
  textY: { type: Number, default: 0 },
  fontFamily: { type: String, default: '' },
  highlightText: { type: String, default: '' },
  highlightStyle: { type: String, default: 'underline-red' },
  fontColor: { type: String, default: '' },
  highlightColor: { type: String, default: '' },
})
</script>

<style scoped>
.card {
  width: 360px;
  height: 480px;
  border: 10px solid;
  border-radius: 12px;
  box-sizing: border-box;
  padding: 36px 32px;
  overflow: hidden;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text {
  line-height: 1.75;
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: center;
}
</style>
