<template>
  <div class="card" :style="{ background: scheme.bg }">
    <div class="quote" :style="{ color: scheme.accent }">&ldquo;</div>
    <div
      class="text"
      :style="{ color: fontColor || scheme.text, fontSize: fontSize + 'px', fontFamily: fontFamily || undefined, transform: `translate(${textX}px, ${textY}px)` }"
    ><HighlightText :text="text" :target="highlightText" :style-id="highlightStyle" :highlight-color="highlightColor" /></div>
    <div class="bar" :style="{ background: scheme.accent }"></div>
  </div>
</template>

<script setup>
import HighlightText from './HighlightText.vue'

defineProps({
  text: { type: String, default: '' },
  fontSize: { type: Number, default: 22 },
  scheme: {
    type: Object,
    default: () => ({ bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' }),
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
  padding: 44px 40px 36px;
  box-sizing: border-box;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.quote {
  font-size: 72px;
  line-height: 0.8;
  font-family: Georgia, serif;
  font-weight: 700;
  margin-bottom: 16px;
  opacity: 0.75;
  flex-shrink: 0;
}
.text {
  flex: 1;
  line-height: 1.75;
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-word;
}
.bar {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>
