<template>
  <a-modal
    v-model:open="visible"
    :title="`图片脚本 — ${note?.title || '未命名笔记'}`"
    width="860px"
    :footer="null"
    destroy-on-close
  >
    <div class="scripts-toolbar">
      <a-space>
        <a-button :loading="loadingScripts" @click="loadScripts">刷新</a-button>
        <a-button type="primary" :loading="regenAll" @click="doRegenAll">整套重新生成</a-button>
        <a-button :loading="genAllImages" :disabled="!scripts.length" @click="doGenAllImages">
          生成全部图片
        </a-button>
        <a-button :loading="downloadingAll" :disabled="!downloadableImages.length" @click="downloadAllGeneratedImages">
          下载全部图片
        </a-button>
      </a-space>
      <span class="muted">拖拽卡片可重排序</span>
    </div>

    <a-spin :spinning="loadingScripts">
      <a-empty v-if="!scripts.length && !loadingScripts" description="暂无脚本，请点击「整套重新生成」" />
      <div v-else ref="scriptList" class="script-list">
        <div
          v-for="(script, idx) in scripts"
          :key="script.id"
          class="script-card"
          draggable="true"
          @dragstart="onDragStart(idx)"
          @dragover.prevent="onDragOver(idx)"
          @drop="onDrop"
        >
          <div class="script-card-head">
            <span class="drag-handle">⠿</span>
            <a-tag :color="pageTypeColor(script.page_type)">{{ pageTypeLabel(script.page_type) }}</a-tag>
            <span class="script-card-title">{{ script.title || '无标题' }}</span>
            <a-tag
              v-if="generatedImages[script.id]"
              :color="imageStatusColor(generatedImages[script.id].status)"
            >
              {{ imageStatusLabel(generatedImages[script.id]) }}
            </a-tag>
            <a-space style="margin-left: auto">
              <a-button
                size="small"
                :loading="regenSingleId === script.id"
                @click="doRegenSingle(script)"
              >重生成</a-button>
              <a-button
                size="small"
                type="primary"
                :loading="genImageId === script.id"
                @click="doGenImage(script)"
              >{{ generatedImages[script.id] ? '重新生成图片' : '生成图片' }}</a-button>
              <a-button
                v-if="canDownloadImage(script)"
                size="small"
                :loading="downloadImageId === script.id"
                @click="downloadGeneratedImage(script, idx)"
              >下载</a-button>
              <a-popconfirm title="确认删除此页？" ok-text="删除" cancel-text="取消" @confirm="doDelete(script)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </div>

          <div v-if="editingId === script.id" class="script-edit-form">
            <a-form layout="vertical" size="small">
              <a-form-item label="页面类型">
                <a-select v-model:value="editForm.page_type" style="width: 160px">
                  <a-select-option v-for="t in pageTypes" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="标题">
                <a-input v-model:value="editForm.title" />
              </a-form-item>
              <a-form-item label="模板">
                <a-select v-model:value="editForm.template" style="width: 160px" allow-clear>
                  <a-select-option value="tag_cards">卡片标签</a-select-option>
                  <a-select-option value="mind_map">思维导图</a-select-option>
                  <a-select-option value="exam_list">必背清单</a-select-option>
                  <a-select-option value="pink_note">考点长图</a-select-option>
                  <a-select-option value="notebook">笔记本</a-select-option>
                  <a-select-option value="highlight_note">荧光笔记</a-select-option>
                  <a-select-option value="minimal">极简</a-select-option>
                  <a-select-option value="checklist">清单</a-select-option>
                  <a-select-option value="error_book">错题本</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="绘图提示词">
                <a-textarea v-model:value="editForm.image_prompt" :rows="3" />
              </a-form-item>
              <a-form-item label="内容条目（每行一条）">
                <a-textarea v-model:value="editForm.contentText" :rows="4" />
              </a-form-item>
              <div style="display:flex;gap:8px">
                <a-button size="small" type="primary" :loading="savingId === script.id" @click="saveEdit(script)">保存</a-button>
                <a-button size="small" @click="editingId = 0">取消</a-button>
              </div>
            </a-form>
          </div>
          <div v-else class="script-preview" @click="startEdit(script)">
            <div v-if="script.image_prompt" class="script-prompt muted">{{ script.image_prompt }}</div>
            <div class="script-content-list">
              <div v-for="(line, li) in parseContent(script.content_json)" :key="li" class="content-line">
                {{ line }}
              </div>
            </div>
            <div v-if="generatedImages[script.id]" class="gen-image-preview">
              <img
                v-if="generatedImages[script.id].url"
                :src="generatedImages[script.id].url"
                class="gen-thumb"
              />
              <div
                v-else-if="generatedImages[script.id].render_mode === 'template'"
                class="template-preview"
                :class="`template-${script.template || script.page_type || 'minimal'}`"
              >
                <div class="template-preview-title">{{ script.title || '考点笔记' }}</div>
                <div class="template-preview-lines">
                  <div
                    v-for="(line, li) in templatePreviewLines(script)"
                    :key="li"
                    class="template-preview-line"
                  >
                    <span class="template-preview-index">{{ li + 1 }}</span>
                    <span>{{ line }}</span>
                  </div>
                </div>
              </div>
              <div v-else-if="generatedImages[script.id].status === 'failed'" class="gen-error">
                {{ generatedImages[script.id].error || '图片生成失败，可重新生成' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { proxyImageForDownload } from '@/api/xhsRewrite'
import { processImageForDownload, triggerBlobDownload } from '@/utils/imageProcess'
import {
  getImageScripts,
  updateImageScript,
  deleteImageScript,
  regenerateImageScript,
  generateImageScripts,
  reorderImageScripts,
  generateScriptImage,
  getGeneratedImages,
} from '@/api/aiContentCenter'
import { useLlmStore } from '@/stores/llm'

const props = defineProps({
  open: { type: Boolean, default: false },
  note: { type: Object, default: null },
  productId: { type: [Number, String], required: true },
})

const emit = defineEmits(['update:open'])

// 用可读写 computed 代理 prop，避免 v-model 直接绑定 prop
const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const llmStore = useLlmStore()

const loadingScripts = ref(false)
const scripts = ref([])
const generatedImages = ref({})
const regenAll = ref(false)
const genAllImages = ref(false)
const downloadingAll = ref(false)
const regenSingleId = ref(0)
const genImageId = ref(0)
const downloadImageId = ref(0)
const editingId = ref(0)
const savingId = ref(0)
const editForm = ref({})

let dragFrom = -1

const pageTypes = [
  { value: 'cover', label: '封面' },
  { value: 'mind_map', label: '思维导图' },
  { value: 'exam_list', label: '必背清单' },
  { value: 'note_long', label: '考点长图' },
  { value: 'knowledge_card', label: '知识卡片' },
  { value: 'comparison', label: '对比图' },
  { value: 'checklist', label: '清单' },
  { value: 'speed_review', label: '速记' },
  { value: 'self_test', label: '自测题' },
  { value: 'other', label: '其他' },
]

const downloadableImages = computed(() =>
  scripts.value.filter(script => canDownloadImage(script))
)

function pageTypeColor(t) {
  return { cover: 'red', mind_map: 'geekblue', exam_list: 'volcano', note_long: 'magenta',
    knowledge_card: 'blue', comparison: 'purple', checklist: 'green',
    speed_review: 'orange', self_test: 'cyan', other: 'default' }[t] || 'default'
}

function pageTypeLabel(t) {
  return pageTypes.find(p => p.value === t)?.label || t
}

function imageStatusColor(status) {
  return { done: 'green', failed: 'red', pending: 'gold' }[status] || 'default'
}

function imageStatusLabel(img) {
  if (!img) return ''
  if (img.status === 'done' && img.render_mode === 'template') return '模板图'
  return { done: '已生成', failed: '生成失败', pending: '生成中' }[img.status] || img.status
}

function parseContent(json) {
  try { const arr = JSON.parse(json || '[]'); return Array.isArray(arr) ? arr : [] } catch { return [] }
}

watch(() => props.open, async (val) => {
  if (val && props.note) {
    await loadScripts()
    await loadImages()
  }
})

async function loadScripts() {
  if (!props.note) return
  loadingScripts.value = true
  try {
    const res = await getImageScripts(props.note.id)
    scripts.value = res.scripts || []
  } catch (e) {
    message.error(e.message || '加载脚本失败')
  } finally {
    loadingScripts.value = false
  }
}

async function loadImages() {
  if (!props.note) return
  try {
    const res = await getGeneratedImages(props.note.id)
    const map = {}
    for (const img of res.images || []) {
      if (img.script_id && (!map[img.script_id] || Number(img.id) > Number(map[img.script_id].id))) {
        map[img.script_id] = img
      }
    }
    generatedImages.value = map
  } catch { /* non-critical */ }
}

function getLlm() {
  const active = llmStore.active
  if (!active) { message.warning('请先配置大模型'); return null }
  return { provider: active.provider, api_format: active.api_format,
    api_key: active.api_key, base_url: active.base_url || '', model: active.default_model }
}

async function doRegenAll() {
  const llm = getLlm(); if (!llm || !props.note) return
  regenAll.value = true
  try {
    const res = await generateImageScripts(props.note.id, llm)
    scripts.value = res.scripts || []
    generatedImages.value = {}
    message.success(`已生成 ${scripts.value.length} 页脚本`)
  } catch (e) { message.error(e.message || '生成失败') }
  finally { regenAll.value = false }
}

async function doRegenSingle(script) {
  const llm = getLlm(); if (!llm) return
  regenSingleId.value = script.id
  try {
    const res = await regenerateImageScript(script.id, llm)
    const idx = scripts.value.findIndex(s => s.id === script.id)
    if (idx >= 0) scripts.value[idx] = res.script
  } catch (e) { message.error(e.message || '重新生成失败') }
  finally { regenSingleId.value = 0 }
}

async function doDelete(script) {
  try {
    await deleteImageScript(script.id)
    scripts.value = scripts.value.filter(s => s.id !== script.id)
  } catch (e) { message.error(e.message || '删除失败') }
}

async function doGenImage(script) {
  genImageId.value = script.id
  try {
    const res = await generateScriptImage(script.id)
    generatedImages.value = { ...generatedImages.value, [script.id]: res }
    message.success(res.render_mode === 'template' ? '模板图已生成，可在下方预览' : '图片已生成')
  } catch (e) {
    await loadImages()
    message.error(e.message || '生成图片失败')
  }
  finally { genImageId.value = 0 }
}

async function doGenAllImages() {
  genAllImages.value = true
  const pending = scripts.value.filter(s => generatedImages.value[s.id]?.status !== 'done')
  let ok = 0
  for (const s of pending) {
    try {
      const res = await generateScriptImage(s.id)
      generatedImages.value = { ...generatedImages.value, [s.id]: res }
      ok++
    } catch {
      await loadImages()
    }
  }
  genAllImages.value = false
  message.success(`已生成 ${ok}/${pending.length} 张图片`)
}

function startEdit(script) {
  editingId.value = script.id
  editForm.value = {
    page_type: script.page_type,
    title: script.title || '',
    template: script.template || '',
    image_prompt: script.image_prompt || '',
    contentText: parseContent(script.content_json).join('\n'),
  }
}

function templatePreviewLines(script) {
  const lines = parseContent(script.content_json)
  const limit = script.page_type === 'mind_map' ? 8 : 10
  return lines.slice(0, limit)
}

function canDownloadImage(script) {
  const img = generatedImages.value[script.id]
  return Boolean(img && img.status === 'done' && (img.url || img.render_mode === 'template'))
}

async function getProcessedRemoteBlob(url) {
  try {
    return await processImageForDownload(url)
  } catch {
    const proxied = await proxyImageForDownload(url)
    return await processImageForDownload(proxied.url)
  }
}

function safeFileName(name) {
  return String(name || 'ai-content-image')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60)
}

async function downloadGeneratedImage(script, idx) {
  const img = generatedImages.value[script.id]
  if (!img || downloadImageId.value) return
  downloadImageId.value = script.id
  try {
    const blob = img.url
      ? await getProcessedRemoteBlob(img.url)
      : await renderTemplateImageBlob(script)
    triggerBlobDownload(blob, `${safeFileName(script.title || props.note?.title)}_${idx + 1}.png`)
    message.success(img.url ? '下载成功（已处理去重指纹）' : '模板图下载成功')
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    downloadImageId.value = 0
  }
}

async function downloadAllGeneratedImages() {
  const list = downloadableImages.value
  if (!list.length || downloadingAll.value) return
  downloadingAll.value = true
  const hide = message.loading(`下载 ${list.length} 张图片中…`, 0)
  let ok = 0
  for (let i = 0; i < list.length; i++) {
    try {
      const script = list[i]
      const img = generatedImages.value[script.id]
      const blob = img.url
        ? await getProcessedRemoteBlob(img.url)
        : await renderTemplateImageBlob(script)
      triggerBlobDownload(blob, `${safeFileName(script.title || props.note?.title)}_${i + 1}.png`)
      ok++
      if (i < list.length - 1) await new Promise(r => setTimeout(r, 600))
    } catch { /* 单张失败不中断 */ }
  }
  hide()
  downloadingAll.value = false
  message.success(`已下载 ${ok} / ${list.length} 张${list.some(s => generatedImages.value[s.id]?.url) ? '（AI 图已处理去重指纹）' : ''}`)
}

function renderTemplateImageBlob(script) {
  const W = 900
  const H = 1200
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  drawTemplateImage(ctx, script, W, H)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败')), 'image/png')
  })
}

function drawTemplateImage(ctx, script, W, H) {
  const template = script.template || script.page_type || 'minimal'
  const lines = parseContent(script.content_json)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  const bgGradient = ctx.createLinearGradient(0, 0, 0, H)
  bgGradient.addColorStop(0, '#ffffff')
  bgGradient.addColorStop(1, '#f1f5f9')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 54px sans-serif'
  drawWrappedText(ctx, script.title || '考点笔记', 70, 92, W - 140, 64, 2)

  drawTagCardsTemplate(ctx, script, lines, W, H)
}

function drawTagCardsTemplate(ctx, script, lines, W, H) {
  const groups = groupMindMapLines(lines)
  const colors = [
    { bg: '#fff7ed', border: '#fed7aa', title: '#c2410c', chip: '#ffedd5' },
    { bg: '#eff6ff', border: '#bfdbfe', title: '#1d4ed8', chip: '#dbeafe' },
    { bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', chip: '#dcfce7' },
    { bg: '#fdf2f8', border: '#fbcfe8', title: '#be185d', chip: '#fce7f3' },
    { bg: '#f5f3ff', border: '#ddd6fe', title: '#6d28d9', chip: '#ede9fe' },
  ]
  const startY = 228
  const gap = 22
  const groupCount = Math.min(groups.length, 6)
  const cols = 2
  const rows = Math.ceil(groupCount / cols)
  const cardW = 370
  const cardH = Math.min(260, Math.floor((H - startY - 80 - (rows - 1) * gap) / rows))
  const totalW = cols * cardW + (cols - 1) * gap
  const x0 = (W - totalW) / 2

  ctx.fillStyle = '#e0f2fe'
  roundRect(ctx, 70, 174, W - 140, 42, 21)
  ctx.fill()
  ctx.fillStyle = '#075985'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(script.page_type === 'mind_map' ? '按模块抓重点，复习更快' : '高频考点卡片速记', 292, 202)

  groups.slice(0, 6).forEach((group, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = x0 + col * (cardW + gap)
    const y = startY + row * (cardH + gap)
    const theme = colors[i % colors.length]
    drawTagCardGroup(ctx, group, x, y, cardW, cardH, theme)
  })
}

function groupMindMapLines(lines) {
  const map = new Map()
  for (const raw of lines.slice(0, 16)) {
    const text = String(raw || '').trim()
    if (!text) continue
    const parts = text.split(/\s*(?:--|—|：|:)\s*/)
    const key = (parts[0] || '核心').trim()
    const val = parts.length > 1 ? parts.slice(1).join('：').trim() : text
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(val)
  }
  const groups = Array.from(map.entries()).map(([title, items]) => ({ title, items: items.slice(0, 6) }))
  return groups.length ? groups : [{ title: '核心框架', items: lines.slice(0, 8) }]
}

function drawTagCardGroup(ctx, group, x, y, w, h, theme) {
  ctx.fillStyle = theme.bg
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 3
  roundRect(ctx, x, y, w, h, 18)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  roundRect(ctx, x + 18, y + 18, Math.min(w - 36, 190), 42, 21)
  ctx.fill()
  ctx.fillStyle = theme.title
  ctx.font = 'bold 27px sans-serif'
  drawWrappedText(ctx, group.title, x + 34, y + 18, Math.min(w - 68, 170), 34, 1)

  let itemY = y + 82
  ctx.font = '22px sans-serif'
  group.items.forEach((item, idx) => {
    if (itemY > y + h - 42) return
    ctx.fillStyle = theme.chip
    roundRect(ctx, x + 22, itemY, 42, 34, 17)
    ctx.fill()
    ctx.fillStyle = theme.title
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(`${idx + 1}`, x + 37, itemY + 23)
    ctx.fillStyle = '#1f2937'
    ctx.font = '21px sans-serif'
    drawWrappedText(ctx, item, x + 76, itemY - 1, w - 104, 28, 2)
    itemY += 54
  })
}

function drawListTemplate(ctx, lines, W) {
  let y = 210
  ctx.font = '28px sans-serif'
  lines.slice(0, 18).forEach((line, i) => {
    ctx.fillStyle = '#b91c1c'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText(`${i + 1}.`, 72, y)
    ctx.fillStyle = '#111827'
    ctx.font = '28px sans-serif'
    y = drawWrappedText(ctx, line, 125, y - 28, W - 190, 42, 3) + 26
  })
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const chars = String(text || '').split('')
  let line = ''
  let lineCount = 0
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineHeight)
      y += lineHeight
      line = ch
      lineCount++
      if (lineCount >= maxLines) return y
    } else {
      line = test
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineHeight)
    y += lineHeight
  }
  return y
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function saveEdit(script) {
  savingId.value = script.id
  try {
    await updateImageScript(script.id, {
      page_type: editForm.value.page_type,
      title: editForm.value.title,
      template: editForm.value.template,
      image_prompt: editForm.value.image_prompt,
      content: editForm.value.contentText.split('\n').map(s => s.trim()).filter(Boolean),
    })
    const idx = scripts.value.findIndex(s => s.id === script.id)
    if (idx >= 0) {
      scripts.value[idx] = {
        ...scripts.value[idx],
        page_type: editForm.value.page_type,
        title: editForm.value.title,
        template: editForm.value.template,
        image_prompt: editForm.value.image_prompt,
        content_json: JSON.stringify(editForm.value.contentText.split('\n').map(s => s.trim()).filter(Boolean)),
      }
    }
    editingId.value = 0
  } catch (e) { message.error(e.message || '保存失败') }
  finally { savingId.value = 0 }
}

function onDragStart(idx) { dragFrom = idx }
function onDragOver(idx) {
  if (dragFrom === idx) return
  const arr = [...scripts.value]
  const [moved] = arr.splice(dragFrom, 1)
  arr.splice(idx, 0, moved)
  scripts.value = arr
  dragFrom = idx
}
async function onDrop() {
  if (!props.note) return
  try {
    await reorderImageScripts(props.note.id, scripts.value.map(s => s.id))
  } catch { /* non-critical */ }
}
</script>

<style scoped>
.scripts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.script-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}

.script-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fafafa;
  cursor: default;
}

.script-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.drag-handle {
  cursor: grab;
  color: #ccc;
  font-size: 16px;
  user-select: none;
}

.script-card-title {
  font-weight: 600;
  font-size: 13px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.script-preview {
  cursor: pointer;
}

.script-prompt {
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.script-content-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.content-line {
  font-size: 13px;
  color: #333;
  line-height: 1.6;
  padding-left: 8px;
  border-left: 2px solid #e8e8e8;
}

.gen-image-preview {
  margin-top: 8px;
}

.gen-thumb {
  height: 80px;
  border-radius: 4px;
  border: 1px solid #ebebeb;
  object-fit: cover;
}

.gen-error {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  max-width: 360px;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.gen-error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.template-preview {
  width: 180px;
  min-height: 240px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.template-preview-title {
  margin-bottom: 8px;
  color: #111827;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
}

.template-preview-lines {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.template-preview-line {
  display: flex;
  gap: 5px;
  color: #1f2937;
  font-size: 10px;
  line-height: 1.45;
  padding: 5px 6px;
  border-radius: 6px;
  background: #ffffff;
}

.template-preview-index {
  flex: 0 0 auto;
  color: #c62828;
  font-weight: 700;
}

.template-mind_map {
  background: #f8fafc;
}

.template-mind_map .template-preview-lines {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.template-exam_list {
  background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
}

.template-exam_list .template-preview-title {
  color: #b91c1c;
}

.template-pink_note,
.template-note_long,
.template-tag_cards {
  border: 1px solid #e5e7eb;
  background: #f8fafc;
}

.template-pink_note .template-preview-title,
.template-note_long .template-preview-title,
.template-tag_cards .template-preview-title {
  color: #0f172a;
}

.script-edit-form {
  border-top: 1px solid #f0f0f0;
  padding-top: 10px;
}

.muted {
  color: #999;
  font-size: 12px;
}
</style>
