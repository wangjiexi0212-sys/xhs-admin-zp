<template>
  <div class="card" :style="{ background: scheme.bg }">
    <div class="tape" :style="{ background: scheme.tape }"></div>
    <div class="lines"></div>
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
  fontSize: { type: Number, default: 20 },
  scheme: {
    type: Object,
    default: () => ({ bg: '#fffde7', tape: 'rgba(255,255,255,0.65)', text: '#3a3000' }),
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
  padding: 50px 36px 36px;
  box-sizing: border-box;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.tape {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 22px;
  border-radius: 0 0 3px 3px;
  z-index: 2;
}
.lines {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 35px,
    rgba(0, 0, 0, 0.06) 35px,
    rgba(0, 0, 0, 0.06) 36px
  );
  pointer-events: none;
}
.text {
  position: relative;
  line-height: 1.8;
  font-weight: 500;
  white-space: pre-wrap;
  word-break: break-word;
  z-index: 1;
}
</style>
