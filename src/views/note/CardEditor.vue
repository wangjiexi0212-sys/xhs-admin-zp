<template>
  <div class="card-editor">
    <div class="main">
      <div class="preview-col">
        <div class="card-wrapper">
          <div class="card-stack">
            <component
              :is="activeStyle.component"
              :text="displayText"
              :font-size="fontSize"
              :scheme="activeScheme"
              :text-x="textX"
              :text-y="textY"
              :font-family="fontFamily"
              :highlight-text="highlightText"
              :highlight-style="highlightStyle"
            />
            <div
              v-if="emoji"
              class="emoji-layer"
              :style="{ left: emojiX + 'px', top: emojiY + 'px', fontSize: emojiSize + 'px' }"
            >{{ emoji }}</div>
          </div>
        </div>
        <div class="font-size-row">
          <span class="font-size-label">字体</span>
          <a-select
            v-model:value="fontFamily"
            class="font-family-select"
            :options="FONT_OPTIONS"
          />
        </div>
        <div class="font-size-row">
          <span class="font-size-label">字体大小</span>
          <a-button size="small" :disabled="fontSize <= FONT_MIN" @click="decFont">
            <template #icon><MinusOutlined /></template>
          </a-button>
          <a-slider
            v-model:value="fontSize"
            :min="FONT_MIN"
            :max="FONT_MAX"
            :step="1"
            class="font-size-slider"
          />
          <a-button size="small" :disabled="fontSize >= FONT_MAX" @click="incFont">
            <template #icon><PlusOutlined /></template>
          </a-button>
          <span class="font-size-value">{{ fontSize }}px</span>
        </div>
        <div class="font-size-row">
          <span class="font-size-label">横向位置</span>
          <a-button size="small" @click="textX -= 1">
            <template #icon><MinusOutlined /></template>
          </a-button>
          <a-slider
            v-model:value="textX"
            :min="POS_MIN"
            :max="POS_MAX"
            :step="1"
            class="font-size-slider"
          />
          <a-button size="small" @click="textX += 1">
            <template #icon><PlusOutlined /></template>
          </a-button>
          <span class="font-size-value">{{ textX }}px</span>
        </div>
        <div class="font-size-row">
          <span class="font-size-label">纵向位置</span>
          <a-button size="small" @click="textY -= 1">
            <template #icon><MinusOutlined /></template>
          </a-button>
          <a-slider
            v-model:value="textY"
            :min="POS_MIN"
            :max="POS_MAX"
            :step="1"
            class="font-size-slider"
          />
          <a-button size="small" @click="textY += 1">
            <template #icon><PlusOutlined /></template>
          </a-button>
          <span class="font-size-value">{{ textY }}px</span>
        </div>
        <div class="font-size-row">
          <span class="font-size-label">划重点</span>
          <a-input
            v-model:value="highlightText"
            placeholder="输入要划重点的文字（多个用空格、逗号或换行分隔）"
            allow-clear
            class="font-family-select"
          />
        </div>
        <div class="hl-style-row">
          <span class="font-size-label">重点样式</span>
          <div class="hl-style-grid">
            <div
              v-for="s in HL_STYLES"
              :key="s.id"
              class="hl-style-item"
              :class="{ active: highlightStyle === s.id }"
              @click="highlightStyle = s.id"
              :title="s.name"
            >
              <HighlightText text="Abc示例" target="Abc示例" :style-id="s.id" />
            </div>
          </div>
        </div>
        <div class="hl-style-row">
          <span class="font-size-label">表情</span>
          <div class="emoji-grid">
            <div
              v-for="e in EMOJI_LIST"
              :key="e"
              class="emoji-item"
              :class="{ active: emoji === e }"
              @click="selectEmoji(e)"
            >{{ e }}</div>
          </div>
        </div>
        <div v-if="emoji" class="font-size-row">
          <span class="font-size-label">表情大小</span>
          <a-button size="small" :disabled="emojiSize <= 24" @click="emojiSize = Math.max(24, emojiSize - 2)">
            <template #icon><MinusOutlined /></template>
          </a-button>
          <a-slider v-model:value="emojiSize" :min="24" :max="160" :step="1" class="font-size-slider" />
          <a-button size="small" :disabled="emojiSize >= 160" @click="emojiSize = Math.min(160, emojiSize + 2)">
            <template #icon><PlusOutlined /></template>
          </a-button>
          <span class="font-size-value">{{ emojiSize }}px</span>
        </div>
        <div v-if="emoji" class="font-size-row">
          <span class="font-size-label">表情横向</span>
          <a-button size="small" @click="emojiX -= 2">
            <template #icon><MinusOutlined /></template>
          </a-button>
          <a-slider v-model:value="emojiX" :min="-40" :max="340" :step="1" class="font-size-slider" />
          <a-button size="small" @click="emojiX += 2">
            <template #icon><PlusOutlined /></template>
          </a-button>
          <span class="font-size-value">{{ emojiX }}px</span>
        </div>
        <div v-if="emoji" class="font-size-row">
          <span class="font-size-label">表情纵向</span>
          <a-button size="small" @click="emojiY -= 2">
            <template #icon><MinusOutlined /></template>
          </a-button>
          <a-slider v-model:value="emojiY" :min="-40" :max="460" :step="1" class="font-size-slider" />
          <a-button size="small" @click="emojiY += 2">
            <template #icon><PlusOutlined /></template>
          </a-button>
          <span class="font-size-value">{{ emojiY }}px</span>
        </div>
        <div class="preview-actions">
          <a-button @click="changeColor">
            <template #icon><SyncOutlined /></template>
            换配色
          </a-button>
          <a-button @click="resetFont">
            <template #icon><RedoOutlined /></template>
            重置字号
          </a-button>
          <a-button @click="resetPosition">
            <template #icon><RedoOutlined /></template>
            重置位置
          </a-button>
          <a-button v-if="emoji" @click="clearEmoji">移除表情</a-button>
          <a-button v-if="emoji" @click="resetEmoji">
            <template #icon><RedoOutlined /></template>
            重置表情
          </a-button>
          <a-button type="primary" :loading="exporting" @click="doExport">
            <template #icon><DownloadOutlined /></template>
            导出图片
          </a-button>
        </div>
        <div class="tip">导出尺寸：1080 × 1440（小红书竖版）</div>
      </div>

      <div class="style-col">
        <div class="col-label">选择卡片风格</div>
        <div class="style-grid">
          <div
            v-for="s in STYLES"
            :key="s.id"
            class="style-item"
            :class="{ active: activeStyleId === s.id }"
            @click="selectStyle(s.id)"
          >
            <div class="thumb-outer">
              <div class="thumb-inner">
                <component
                  :is="s.component"
                  :text="displayText"
                  :font-size="30"
                  :scheme="s.schemes[0]"
                />
              </div>
            </div>
            <div class="style-name">{{ s.name }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="export-hidden">
      <div ref="exportRef">
        <div class="card-stack">
          <component
            :is="activeStyle.component"
            :text="displayText"
            :font-size="fontSize"
            :scheme="activeScheme"
            :text-x="textX"
            :text-y="textY"
            :font-family="fontFamily"
            :highlight-text="highlightText"
            :highlight-style="highlightStyle"
          />
          <div
            v-if="emoji"
            class="emoji-layer"
            :style="{ left: emojiX + 'px', top: emojiY + 'px', fontSize: emojiSize + 'px' }"
          >{{ emoji }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  SyncOutlined,
  DownloadOutlined,
  PlusOutlined,
  MinusOutlined,
  RedoOutlined,
} from '@ant-design/icons-vue'
import { toPng } from 'html-to-image'
import CardBasic from './cards/CardBasic.vue'
import CardBorder from './cards/CardBorder.vue'
import CardMinimal from './cards/CardMinimal.vue'
import CardNote from './cards/CardNote.vue'
import CardGeometric from './cards/CardGeometric.vue'
import CardDiffuse from './cards/CardDiffuse.vue'
import CardKraft from './cards/CardKraft.vue'
import HighlightText from './cards/HighlightText.vue'

const props = defineProps({
  text: { type: String, default: '' },
  placeholder: { type: String, default: '真诚分享经验或咨询\n提个问题也不错\n聚焦、利他' },
  fileNamePrefix: { type: String, default: 'xhs-card' },
})

const FONT_MIN = 12
const FONT_MAX = 48
const POS_MIN = -200
const POS_MAX = 200

const FONT_OPTIONS = [
  { value: '', label: '默认（苹方/系统）' },
  { value: '"Microsoft YaHei", "微软雅黑", sans-serif', label: '微软雅黑' },
  { value: '"SimHei", "黑体", sans-serif', label: '黑体' },
  { value: '"SimSun", "宋体", serif', label: '宋体' },
  { value: '"KaiTi", "STKaiti", "楷体", serif', label: '楷体' },
  { value: '"FangSong", "STFangsong", "仿宋", serif', label: '仿宋' },
  { value: '"STXihei", "华文细黑", sans-serif', label: '华文细黑' },
  { value: '"STSong", "华文宋体", serif', label: '华文宋体' },
  { value: '"STKaiti", "华文楷体", serif', label: '华文楷体' },
  { value: '"YouYuan", "幼圆", sans-serif', label: '幼圆' },
  { value: 'Georgia, serif', label: 'Georgia（衬线）' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica / Arial' },
  { value: '"Courier New", monospace', label: '等宽 Courier New' },
]

const HL_STYLES = [
  { id: 'underline-red', name: '红色下划线' },
  { id: 'underline-green', name: '绿色下划线' },
  { id: 'underline-blue-wave', name: '蓝色波浪线' },
  { id: 'underline-pink-wave', name: '粉色波浪线' },
  { id: 'bg-yellow', name: '黄色荧光' },
  { id: 'bg-yellow-soft', name: '浅黄荧光' },
  { id: 'bg-pink', name: '粉色圈圈' },
  { id: 'bg-blue', name: '蓝色圈圈' },
  { id: 'bg-green', name: '绿色圈圈' },
  { id: 'strike-red', name: '红色删除线' },
  { id: 'bold-color', name: '红色加粗' },
]

const STYLES = [
  {
    id: 'basic',
    name: '基础',
    component: CardBasic,
    schemes: [
      { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' },
      { bg: '#fff3cd', text: '#5a3a00', accent: '#f5a623' },
      { bg: '#dde8ff', text: '#1a2f6e', accent: '#4472ca' },
      { bg: '#ede0ff', text: '#3d1a6e', accent: '#8b5cf6' },
      { bg: '#fce8e8', text: '#6e1a1a', accent: '#e53e3e' },
    ],
  },
  {
    id: 'border',
    name: '边框',
    component: CardBorder,
    schemes: [
      { border: '#ff7043', bg: '#ffffff', text: '#1a1a1a' },
      { border: '#4caf50', bg: '#f6fbf6', text: '#1a1a1a' },
      { border: '#2196f3', bg: '#f4f8ff', text: '#1a1a1a' },
      { border: '#9c27b0', bg: '#fcf5ff', text: '#1a1a1a' },
      { border: '#ff9800', bg: '#fffaf2', text: '#1a1a1a' },
    ],
  },
  {
    id: 'minimal',
    name: '简约',
    component: CardMinimal,
    schemes: [
      { bg: '#f8f9fa', text: '#1a1a1a', accent: '#1677ff' },
      { bg: '#ffffff', text: '#1a1a1a', accent: '#52c41a' },
      { bg: '#f8f9fa', text: '#1a1a1a', accent: '#eb2f96' },
      { bg: '#f0f5ff', text: '#1a1a1a', accent: '#722ed1' },
      { bg: '#fff9e6', text: '#1a1a1a', accent: '#fa8c16' },
    ],
  },
  {
    id: 'note',
    name: '便签',
    component: CardNote,
    schemes: [
      { bg: '#fffde7', tape: 'rgba(255,255,255,0.7)', text: '#3a3000' },
      { bg: '#e8f5e9', tape: 'rgba(255,255,255,0.7)', text: '#1b5e20' },
      { bg: '#e3f2fd', tape: 'rgba(255,255,255,0.7)', text: '#0d47a1' },
      { bg: '#fce4ec', tape: 'rgba(255,255,255,0.7)', text: '#880e4f' },
      { bg: '#f3e5f5', tape: 'rgba(255,255,255,0.7)', text: '#4a148c' },
    ],
  },
  {
    id: 'geometric',
    name: '几何',
    component: CardGeometric,
    schemes: [
      { bg: '#42b983', text: '#ffffff', quoteColor: 'rgba(255,255,255,0.18)' },
      { bg: '#ff7043', text: '#ffffff', quoteColor: 'rgba(255,255,255,0.18)' },
      { bg: '#1e88e5', text: '#ffffff', quoteColor: 'rgba(255,255,255,0.18)' },
      { bg: '#8b5cf6', text: '#ffffff', quoteColor: 'rgba(255,255,255,0.18)' },
      { bg: '#1a1a2e', text: '#ffffff', quoteColor: 'rgba(255,255,255,0.12)' },
    ],
  },
  {
    id: 'diffuse',
    name: '弥散',
    component: CardDiffuse,
    schemes: [
      {
        gradient: 'radial-gradient(ellipse at 30% 30%, #ffffff 0%, #c8e6c9 100%)',
        circle: 'rgba(200,230,201,0.7)',
        text: '#1b5e20',
      },
      {
        gradient: 'radial-gradient(ellipse at 70% 30%, #ffffff 0%, #bbdefb 100%)',
        circle: 'rgba(187,222,251,0.7)',
        text: '#0d47a1',
      },
      {
        gradient: 'radial-gradient(ellipse at 30% 70%, #ffffff 0%, #f8bbd0 100%)',
        circle: 'rgba(248,187,208,0.7)',
        text: '#880e4f',
      },
      {
        gradient: 'radial-gradient(ellipse at 60% 40%, #ffffff 0%, #e1bee7 100%)',
        circle: 'rgba(225,190,231,0.7)',
        text: '#4a148c',
      },
      {
        gradient: 'radial-gradient(ellipse at 40% 60%, #ffffff 0%, #ffe0b2 100%)',
        circle: 'rgba(255,224,178,0.7)',
        text: '#e65100',
      },
    ],
  },
  {
    id: 'kraft',
    name: '手账纸质',
    component: CardKraft,
    schemes: [
      {
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
      },
      {
        bg: '#efe6cf',
        text: '#23303a',
        ribbon: '#7fb3d5',
        shadow: 'rgba(0,0,0,0.06)',
        deskTop: '#c98e57',
        deskSide: '#a87241',
        lineDark: '#2c2a26',
        suit: '#2f4858',
        shirt: '#f1ede4',
        tie: '#3a8fb7',
        badge: '#f3d36a',
        skin: '#f0cba6',
        hairDark: '#26201c',
        hairLight: '#6e4a30',
        blouse: '#d49bb0',
      },
      {
        bg: '#f6e7d8',
        text: '#3a2418',
        ribbon: '#c98a6b',
        shadow: 'rgba(0,0,0,0.07)',
        deskTop: '#b97b4a',
        deskSide: '#8f5d36',
        lineDark: '#2a1f18',
        suit: '#4a3a2e',
        shirt: '#f1ece2',
        tie: '#a04a3a',
        badge: '#f3c64a',
        skin: '#f1cba4',
        hairDark: '#1f1812',
        hairLight: '#5a3c25',
        blouse: '#b6926e',
      },
      {
        bg: '#eef0e0',
        text: '#243024',
        ribbon: '#8fb487',
        shadow: 'rgba(0,0,0,0.06)',
        deskTop: '#cfa46a',
        deskSide: '#a07a48',
        lineDark: '#222a22',
        suit: '#34463a',
        shirt: '#f1f1ea',
        tie: '#c0533a',
        badge: '#f3d36a',
        skin: '#f3d2af',
        hairDark: '#251f1a',
        hairLight: '#6f4f33',
        blouse: '#e0b86a',
      },
      {
        bg: '#fdebe2',
        text: '#3a2230',
        ribbon: '#d76b91',
        shadow: 'rgba(0,0,0,0.06)',
        deskTop: '#d99c7c',
        deskSide: '#b1745a',
        lineDark: '#36202b',
        suit: '#3d2f4a',
        shirt: '#f4eef1',
        tie: '#c33c6a',
        badge: '#f3c84a',
        skin: '#f4d2b4',
        hairDark: '#221820',
        hairLight: '#6a3f4a',
        blouse: '#b9d6ad',
      },
    ],
  },
]

const activeStyleId = ref('basic')
const schemeIdx = ref(0)
const fontSize = ref(30)
const textX = ref(0)
const textY = ref(0)
const fontFamily = ref('')
const highlightText = ref('')
const highlightStyle = ref('underline-red')
const emoji = ref('')
const emojiSize = ref(64)
const emojiX = ref(300)
const emojiY = ref(410)
const exporting = ref(false)
const exportRef = ref(null)

const EMOJI_LIST = [
  '✨', '🌟', '⭐', '🌈', '☀️', '🌸', '🌷', '🌻',
  '🍀', '🌿', '🎉', '🎊', '🎁', '🎯', '🏆', '🥇',
  '💯', '🔥', '🚀', '💪', '👍', '👏', '🙌', '🤝',
  '❤️', '💖', '💗', '💝', '😄', '😊', '🥳', '🤩',
  '📚', '📖', '✏️', '📝', '🎓', '💡', '🌅', '🦋',
]

const displayText = computed(() => props.text?.trim() || props.placeholder)
const activeStyle = computed(() =>
  STYLES.find(s => s.id === activeStyleId.value) || STYLES[0],
)
const activeScheme = computed(() => {
  const s = activeStyle.value
  return s.schemes[schemeIdx.value % s.schemes.length]
})

function selectStyle(id) {
  activeStyleId.value = id
  schemeIdx.value = 0
}

function changeColor() {
  schemeIdx.value++
}

function incFont() {
  if (fontSize.value < FONT_MAX) fontSize.value += 1
}

function decFont() {
  if (fontSize.value > FONT_MIN) fontSize.value -= 1
}

function resetFont() {
  fontSize.value = 30
}

function resetPosition() {
  textX.value = 0
  textY.value = 0
}

function selectEmoji(e) {
  emoji.value = emoji.value === e ? '' : e
}

function clearEmoji() {
  emoji.value = ''
}

function resetEmoji() {
  emojiSize.value = 64
  emojiX.value = 300
  emojiY.value = 410
}

async function doExport() {
  const wrap = exportRef.value
  if (!wrap || !wrap.firstElementChild) return
  exporting.value = true
  try {
    const dataUrl = await toPng(wrap.firstElementChild, {
      pixelRatio: 3,
      cacheBust: true,
    })
    const a = document.createElement('a')
    a.download = `${props.fileNamePrefix}-${Date.now()}.png`
    a.href = dataUrl
    a.click()
    message.success('导出成功（1080 × 1440）')
  } catch (e) {
    message.error('导出失败：' + (e?.message || e))
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.card-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.main {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.preview-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.col-label {
  font-size: 13px;
  color: #555;
  font-weight: 500;
}
.card-wrapper {
  width: 360px;
  height: 480px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
.card-stack {
  position: relative;
  width: 360px;
  height: 480px;
}
.emoji-layer {
  position: absolute;
  z-index: 5;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  transform: translate(-50%, -50%);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.emoji-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
}
.emoji-item {
  border: 1px solid #eee;
  background: #fafafa;
  border-radius: 6px;
  padding: 2px 0;
  text-align: center;
  font-size: 18px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}
.emoji-item:hover {
  border-color: #1677ff;
}
.emoji-item.active {
  border-color: #ff4d4f;
  background: #fff;
}
.preview-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.font-size-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 360px;
}
.font-size-label {
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}
.font-size-slider {
  flex: 1;
  margin: 0 4px;
}
.font-family-select {
  flex: 1;
}
.hl-style-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 360px;
}
.hl-style-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.hl-style-item {
  border: 1px solid #eee;
  background: #fafafa;
  border-radius: 6px;
  padding: 6px 4px;
  text-align: center;
  font-size: 13px;
  color: #222;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
  overflow: hidden;
}
.hl-style-item:hover {
  border-color: #1677ff;
}
.hl-style-item.active {
  border-color: #ff4d4f;
  background: #fff;
}
.font-size-value {
  font-size: 12px;
  color: #1677ff;
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  text-align: right;
}
.tip {
  font-size: 12px;
  color: #999;
}
.style-col {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 108px);
  gap: 16px 20px;
}
.style-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.thumb-outer {
  width: 108px;
  height: 144px;
  overflow: hidden;
  border-radius: 8px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition: box-shadow 0.15s;
}
.style-item:hover .thumb-outer {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.style-item.active .thumb-outer {
  outline: 2px solid #ff4d4f;
  outline-offset: 2px;
}
.thumb-inner {
  position: absolute;
  top: 0;
  left: 0;
  transform: scale(0.3);
  transform-origin: top left;
  pointer-events: none;
}
.style-name {
  font-size: 12px;
  color: #666;
}
.style-item.active .style-name {
  color: #ff4d4f;
  font-weight: 500;
}
.export-hidden {
  position: fixed;
  left: -9999px;
  top: -9999px;
  pointer-events: none;
}
</style>
