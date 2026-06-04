<template>
  <div class="card" :style="{ background: scheme.bg }">
    <div class="accent-bar" :style="{ background: scheme.accent }"></div>
    <div
      class="text"
      :style="{ color: scheme.text, fontSize: fontSize + 'px', fontFamily: fontFamily || undefined, transform: `translate(${textX}px, ${textY}px)` }"
    ><HighlightText :text="text" :target="highlightText" :style-id="highlightStyle" /></div>
    <div class="footer" :style="{ color: scheme.accent }">— —</div>
  </div>
</template>

<script setup>
import HighlightText from './HighlightText.vue'

defineProps({
  text: { type: String, default: '' },
  fontSize: { type: Number, default: 22 },
  scheme: {
    type: Object,
    default: () => ({ bg: '#f8f9fa', text: '#1a1a1a', accent: '#1677ff' }),
  },
  textX: { type: Number, default: 0 },
  textY: { type: Number, default: 0 },
  fontFamily: { type: String, default: '' },
  highlightText: { type: String, default: '' },
  highlightStyle: { type: String, default: 'underline-red' },
})
</script>

<style scoped>
.card {
  width: 360px;
  height: 480px;
  padding: 48px 40px;
  box-sizing: border-box;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.accent-bar {
  width: 32px;
  height: 3px;
  border-radius: 2px;
  margin-bottom: 28px;
  flex-shrink: 0;
}
.text {
  flex: 1;
  line-height: 1.8;
  font-weight: 500;
  white-space: pre-wrap;
  word-break: break-word;
}
.footer {
  font-size: 18px;
  letter-spacing: 4px;
  flex-shrink: 0;
  margin-top: 24px;
  opacity: 0.6;
}
</style>
