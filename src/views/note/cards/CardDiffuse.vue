<template>
  <div class="card" :style="{ background: scheme.gradient }">
    <div class="circle c1" :style="{ background: scheme.circle }"></div>
    <div class="circle c2" :style="{ background: scheme.circle }"></div>
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
    default: () => ({
      gradient: 'radial-gradient(ellipse at 30% 30%, #ffffff 0%, #c8e6c9 100%)',
      circle: 'rgba(200,230,201,0.6)',
      text: '#1b5e20',
    }),
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
  padding: 56px 40px;
  box-sizing: border-box;
  border-radius: 24px;
  position: relative;
  overflow: hidden;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(8px);
}
.c1 {
  width: 220px;
  height: 220px;
  top: -60px;
  right: -50px;
}
.c2 {
  width: 160px;
  height: 160px;
  bottom: -40px;
  left: -40px;
}
.text {
  line-height: 1.75;
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
  z-index: 1;
}
</style>
