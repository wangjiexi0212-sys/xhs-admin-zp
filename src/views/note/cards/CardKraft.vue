<template>
  <div class="card" :style="{ background: scheme.bg, color: scheme.text }">
    <svg class="ribbon" viewBox="0 0 140 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M8 38 C 22 14, 50 8, 70 22 C 84 32, 96 40, 116 36 C 128 33, 134 26, 132 18"
        fill="none"
        :stroke="scheme.ribbon"
        stroke-width="5"
        stroke-linecap="round"
      />
      <path
        d="M125 12 L 134 18 L 128 28"
        fill="none"
        :stroke="scheme.ribbon"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M14 48 C 30 30, 52 28, 64 38"
        fill="none"
        :stroke="scheme.ribbon"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.55"
      />
    </svg>

    <div
      class="text"
      :style="{
        fontSize: fontSize + 'px',
        fontFamily: fontFamily || undefined,
        transform: `translate(${textX}px, ${textY}px)`,
        color: fontColor || undefined,
      }"
    >
      <HighlightText :text="text" :target="highlightText" :style-id="highlightStyle" :highlight-color="highlightColor" />
    </div>

    <svg class="illus" viewBox="0 0 180 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="90" cy="128" rx="70" ry="6" :fill="scheme.shadow" />
      <rect x="42" y="92" width="96" height="28" rx="3" :fill="scheme.deskTop" />
      <rect x="46" y="116" width="88" height="14" rx="2" :fill="scheme.deskSide" />
      <rect x="58" y="96" width="28" height="20" rx="1.5" fill="#ffffff" :stroke="scheme.lineDark" stroke-width="1" />
      <line x1="62" y1="102" x2="82" y2="102" :stroke="scheme.lineDark" stroke-width="1" />
      <line x1="62" y1="106" x2="82" y2="106" :stroke="scheme.lineDark" stroke-width="1" />
      <line x1="62" y1="110" x2="78" y2="110" :stroke="scheme.lineDark" stroke-width="1" />
      <rect x="92" y="96" width="30" height="20" rx="1.5" fill="#ffffff" :stroke="scheme.lineDark" stroke-width="1" />
      <line x1="96" y1="102" x2="118" y2="102" :stroke="scheme.lineDark" stroke-width="1" />
      <line x1="96" y1="106" x2="118" y2="106" :stroke="scheme.lineDark" stroke-width="1" />
      <line x1="96" y1="110" x2="114" y2="110" :stroke="scheme.lineDark" stroke-width="1" />

      <path d="M50 92 L 60 60 L 86 60 L 92 92 Z" :fill="scheme.suit" />
      <rect x="64" y="62" width="18" height="20" :fill="scheme.shirt" />
      <path d="M73 62 L 78 70 L 73 78 L 68 70 Z" :fill="scheme.tie" />
      <rect x="76" y="74" width="6" height="8" rx="1" :fill="scheme.badge" :stroke="scheme.suit" stroke-width="0.8" />
      <circle cx="73" cy="50" r="11" :fill="scheme.skin" />
      <path d="M62 47 Q 73 36 84 47 L 84 52 Q 80 46 73 46 Q 66 46 62 52 Z" :fill="scheme.hairDark" />
      <circle cx="69" cy="51" r="1.1" :fill="scheme.lineDark" />
      <circle cx="77" cy="51" r="1.1" :fill="scheme.lineDark" />

      <path d="M96 92 L 102 62 L 130 62 L 136 92 Z" :fill="scheme.blouse" />
      <circle cx="116" cy="50" r="11" :fill="scheme.skin" />
      <path
        d="M105 50 Q 105 36 116 36 Q 128 36 128 52 L 128 62 Q 124 56 116 56 Q 108 56 105 62 Z"
        :fill="scheme.hairLight"
      />
      <path d="M105 56 Q 102 70 104 80" :fill="scheme.hairLight" />
      <path d="M127 56 Q 130 70 128 80" :fill="scheme.hairLight" />
      <circle cx="112" cy="52" r="1.1" :fill="scheme.lineDark" />
      <circle cx="120" cy="52" r="1.1" :fill="scheme.lineDark" />
      <path d="M113 56 Q 116 58 119 56" :stroke="scheme.lineDark" stroke-width="0.8" fill="none" stroke-linecap="round" />
    </svg>

    <svg class="corner" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M30 8 L 30 70" :stroke="scheme.ribbon" stroke-width="2" stroke-linecap="round" opacity="0.55" />
      <path d="M20 16 L 40 16" :stroke="scheme.ribbon" stroke-width="2" stroke-linecap="round" opacity="0.45" />
      <path d="M22 60 L 38 60" :stroke="scheme.ribbon" stroke-width="2" stroke-linecap="round" opacity="0.45" />
    </svg>
  </div>
</template>

<script setup>
import HighlightText from './HighlightText.vue'

defineProps({
  text: { type: String, default: '' },
  fontSize: { type: Number, default: 30 },
  scheme: {
    type: Object,
    default: () => ({
      bg: '#f4ead6',
      text: '#2a2723',
      ribbon: '#e89aa6',
      shadow: 'rgba(0,0,0,0.06)',
      deskTop: '#d9a26b',
      deskSide: '#b8814d',
      lineDark: '#3a322a',
      suit: '#3a3f4d',
      shirt: '#ecebe7',
      tie: '#c54a4a',
      badge: '#f3d36a',
      skin: '#f3d4b3',
      hairDark: '#2a2520',
      hairLight: '#7a5a3f',
      blouse: '#8fb487',
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
  padding: 70px 36px 36px;
  box-sizing: border-box;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  font-family: 'KaiTi', 'STKaiti', '楷体', 'PingFang SC', sans-serif;
  background-image:
    radial-gradient(circle at 20% 15%, rgba(255,255,255,0.35) 0, transparent 60%),
    radial-gradient(circle at 80% 85%, rgba(0,0,0,0.04) 0, transparent 55%);
}
.ribbon {
  position: absolute;
  top: 14px;
  left: 16px;
  width: 110px;
  height: 70px;
  z-index: 2;
}
.corner {
  position: absolute;
  top: 16px;
  right: 18px;
  width: 36px;
  height: 50px;
  z-index: 2;
  opacity: 0.7;
}
.text {
  position: relative;
  z-index: 1;
  line-height: 1.55;
  font-weight: 700;
  letter-spacing: 1px;
  white-space: pre-wrap;
  word-break: break-word;
}
.illus {
  position: absolute;
  right: 14px;
  bottom: 14px;
  width: 160px;
  height: 124px;
  z-index: 1;
}
</style>
