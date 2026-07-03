<template>
  <template v-for="(part, i) in parts" :key="i">
    <span
      v-if="part.matched"
      :class="['hl', `hl-${styleId}`]"
      :style="highlightColor ? { '--hl-color': highlightColor } : undefined"
    >{{ part.text }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  target: { type: String, default: '' },
  styleId: { type: String, default: 'underline-red' },
  highlightColor: { type: String, default: '' },
})

const targets = computed(() =>
  props.target
    .split(/[\n,，]/)
    .map(t => t.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length),
)

const parts = computed(() => {
  const text = props.text || ''
  const ts = targets.value
  if (!ts.length) return [{ text, matched: false }]
  const escaped = ts.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(escaped.join('|'), 'g')
  const out = []
  let lastIdx = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) out.push({ text: text.slice(lastIdx, m.index), matched: false })
    out.push({ text: m[0], matched: true })
    lastIdx = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (lastIdx < text.length) out.push({ text: text.slice(lastIdx), matched: false })
  return out
})
</script>

<style scoped>
.hl {
  display: inline;
  padding: 0 2px;
  font-weight: bold;
}
.hl-bg-yellow {
  background: linear-gradient(transparent 55%, var(--hl-color, #ffea7a) 55%);
  padding: 0;
}
.hl-bg-yellow-soft {
  background: linear-gradient(transparent 62%, var(--hl-color, #fff1a8) 62%);
  padding: 0;
}
.hl-bg-pink {
  background: var(--hl-color, #ffd6e8);
  border-radius: 6px;
}
.hl-bg-blue {
  background: var(--hl-color, #cfe7ff);
  border-radius: 6px;
}
.hl-bg-green {
  background: var(--hl-color, #c8efc8);
  border-radius: 6px;
}
.hl-strike-red {
  text-decoration: line-through;
  text-decoration-color: var(--hl-color, #ff4d4f);
  text-decoration-thickness: 2px;
  padding: 0;
}
.hl-underline-red {
  text-decoration: underline;
  text-decoration-color: var(--hl-color, #ff4d4f);
  text-decoration-thickness: 3px;
  text-underline-offset: 4px;
  padding: 0;
}
.hl-underline-green {
  text-decoration: underline;
  text-decoration-color: var(--hl-color, #52c41a);
  text-decoration-thickness: 3px;
  text-underline-offset: 4px;
  padding: 0;
}
.hl-underline-blue-wave {
  text-decoration: underline wavy;
  text-decoration-color: var(--hl-color, #1677ff);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  padding: 0;
}
.hl-underline-pink-wave {
  text-decoration: underline wavy;
  text-decoration-color: var(--hl-color, #eb2f96);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  padding: 0;
}
.hl-bold-color {
  color: var(--hl-color, #ff4d4f);
  font-weight: 800;
  padding: 0;
}
</style>
