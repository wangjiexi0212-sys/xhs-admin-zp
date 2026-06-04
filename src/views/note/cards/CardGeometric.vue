<template>
  <div class="card" :style="{ background: scheme.bg }">
    <div class="big-quote" :style="{ color: scheme.quoteColor }">&rdquo;</div>
    <div
      class="text"
      :style="{ color: scheme.text, fontSize: fontSize + 'px', fontFamily: fontFamily || undefined, transform: `translate(${textX}px, ${textY}px)` }"
    ><HighlightText :text="text" :target="highlightText" :style-id="highlightStyle" /></div>
  </div>
</template>

<script setup>
import HighlightText from './HighlightText.vue'

defineProps({
  text: { type: String, default: '' },
  fontSize: { type: Number, default: 24 },
  scheme: {
    type: Object,
    default: () => ({
      bg: '#42b983',
      text: '#ffffff',
      quoteColor: 'rgba(255,255,255,0.18)',
    }),
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
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.big-quote {
  position: absolute;
  bottom: -60px;
  right: 16px;
  font-size: 240px;
  line-height: 1;
  font-family: Georgia, serif;
  font-weight: 700;
  pointer-events: none;
  user-select: none;
}
.text {
  line-height: 1.7;
  font-weight: 700;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
  z-index: 1;
}
</style>
