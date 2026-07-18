<template>
  <div>
    <div class="toolbar">
      <a-space wrap>
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索公告名称/单位"
          allow-clear
          style="width: 240px"
          @search="onSearch"
        />
        <a-select
          v-model:value="filterJobTypeId"
          placeholder="商品类型"
          allow-clear
          style="width: 180px"
          :options="jobTypeOptions"
          @change="onSearch"
        />
        <a-select
          v-model:value="filterStatus"
          placeholder="状态"
          allow-clear
          style="width: 120px"
          :options="statusOptions"
          @change="onSearch"
        />
      </a-space>
      <a-button type="primary" @click="goCreate">+ 新增商品</a-button>
    </div>

    <div v-if="selectedRowKeys.length" class="selection-bar">
      已选 {{ selectedRowKeys.length }} 条
      <a-button type="primary" size="small" style="margin-left: 8px" :loading="batchGenerating" @click="onBatchGenerateNoteImages">
        批量生成笔记图
      </a-button>
      <a-button size="small" style="margin-left: 8px" :loading="dirBatchGenerating" @click="onBatchGenerateDirImages">
        批量生成目录图
      </a-button>
      <a-button size="small" style="margin-left: 8px" @click="clearSelection">取消选择</a-button>
    </div>

    <a-modal
      v-model:open="dirBatchVisible"
      title="批量生成目录图"
      :footer="null"
      :closable="!dirBatchGenerating"
      :mask-closable="!dirBatchGenerating"
      width="480px"
    >
      <a-progress :percent="dirBatchTotal ? Math.round(dirBatchDone / dirBatchTotal * 100) : 0" style="margin-bottom: 12px" />
      <div style="max-height: 320px; overflow-y: auto; font-size: 13px; line-height: 1.9">
        <div
          v-for="(log, i) in dirBatchLogs"
          :key="i"
          :style="{ color: log.type === 'error' ? '#ff4d4f' : log.type === 'success' ? '#52c41a' : log.type === 'warn' ? '#faad14' : '#555' }"
        >{{ log.text }}</div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="batchVisible"
      title="批量生成笔记图"
      :footer="null"
      :closable="!batchGenerating"
      :mask-closable="!batchGenerating"
      width="480px"
    >
      <a-progress :percent="batchTotal ? Math.round(batchDone / batchTotal * 100) : 0" style="margin-bottom: 12px" />
      <div style="max-height: 320px; overflow-y: auto; font-size: 13px; line-height: 1.9">
        <div
          v-for="(log, i) in batchLogs"
          :key="i"
          :style="{ color: log.type === 'error' ? '#ff4d4f' : log.type === 'success' ? '#52c41a' : log.type === 'warn' ? '#faad14' : '#555' }"
        >{{ log.text }}</div>
      </div>
    </a-modal>

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1400 }"
      :row-selection="rowSelection"
      row-key="id"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status ? 'green' : 'default'">
            {{ record.status ? '上架' : '下架' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'source_url'">
          <a v-if="record.source_url" :href="record.source_url" target="_blank" rel="noopener">查看</a>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'created_at'">
          {{ formatTime(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'updated_at'">
          {{ formatTime(record.updated_at) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" type="link" @click="goDetail(record.id)">详情</a-button>
            <a-button size="small" type="link" @click="goEdit(record.id)">编辑</a-button>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" type="link" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getProductList, deleteProduct, getProductDetail } from '@/api/products'
import { getJobTypeList } from '@/api/jobTypes'
import { buildRandomGradient, triggerBlobDownload } from '@/utils/imageProcess'
import { getBaiduFiles } from '@/api/baidu'
import { getToken } from '@/api/request'
import { chatLlm } from '@/api/llm'
import { getPromptList } from '@/api/prompts'
import { getContentTemplateList } from '@/api/contentTemplates'
import { getRandomTitleFormula } from '@/api/titleFormulas'
import { useLlmStore } from '@/stores/llm'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

const router = useRouter()
const llmStore = useLlmStore()

const keyword = ref('')
const filterJobTypeId = ref()
const filterStatus = ref()
const loading = ref(false)
const list = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })
const selectedRowKeys = ref([])
const rowSelection = {
  selectedRowKeys,
  onChange: keys => { selectedRowKeys.value = keys },
}

function clearSelection() {
  selectedRowKeys.value = []
}

const batchVisible = ref(false)
const batchGenerating = ref(false)
const batchLogs = ref([])
const batchDone = ref(0)
const batchTotal = ref(0)

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

function renderOne(srcUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const W = 1080, H = 1440, PAD = 50
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = buildRandomGradient(ctx, W, H)
      ctx.fillRect(0, 0, W, H)
      const img = await loadImage(srcUrl)
      const ratio = Math.min((W - PAD * 2) / img.width, (H - PAD * 2) / img.height)
      const drawW = img.width * ratio, drawH = img.height * ratio
      ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH)
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('生成失败'))
        resolve(blob)
      }, 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

let jsZipLib = null
async function ensureJSZip() {
  if (jsZipLib) return jsZipLib
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  jsZipLib = window.JSZip
  return jsZipLib
}

// --- 目录图辅助函数（与 Detail.vue 保持一致）---

const BG_COLOR_POOL = [
  '#a8c8f0', '#f0a8b4', '#a8e0c8', '#f0d0a8',
  '#c8b4f0', '#a8d8f0', '#f0e0a8', '#b4f0d0',
  '#f0b4c8', '#b4c8f0', '#d0f0a8', '#f0c8a8',
  '#ffd6d6', '#d6f0ff', '#d6ffd6', '#fff0d6',
  '#e8d6ff', '#d6ffe8', '#ffecd6', '#d6e8ff',
  '#ffe4f0', '#e4ffe4', '#fff4d6', '#d6f4ff',
  '#f0d6ff', '#d6ffee', '#ffd6ee', '#eeffd6',
  '#dce8ff', '#ffdce8', '#dcffee', '#ffeedd',
]
function pickRandomBgColor() {
  return BG_COLOR_POOL[Math.floor(Math.random() * BG_COLOR_POOL.length)]
}

const HISTORY_TITLE_POOL = [
  '刷真题，吃透核心考点', '研真题，洞悉考察方向', '析真题，总结答题套路',
  '品真题，掌握命题规律', '梳理真题，理清考察重点', '复盘真题，弥补知识短板',
  '深挖真题，抓住得分关键', '细读真题，熟悉题型结构', '拆解真题，归纳解题方法',
  '精读真题，找准出题侧重', '复盘真题，规避常见陷阱', '吃透真题，稳固知识体系',
  '揣摩真题，把握考察逻辑', '整理真题，汇总高频考点', '演算真题，提升做题速度',
  '回顾真题，强化记忆印象', '深究真题，摸清考察范围', '品读真题，规范答题话术',
  '深挖真题，梳理高频题型', '复盘真题，找准失分根源',
]
function pickRandomHistoryTitle() {
  return HISTORY_TITLE_POOL[Math.floor(Math.random() * HISTORY_TITLE_POOL.length)]
}

const MOCK_TITLE_POOL = [
  '刷模拟题，查漏补缺', '练模拟题，把控时限', '研模拟题，适应题型',
  '做模拟题，夯实功底', '复盘模拟题，补齐短板', '吃透模拟题，稳定发挥',
  '梳理模拟题，熟记考点', '拆解模拟题，总结思路', '演算模拟题，提升速度',
  '精读模拟题，规避陷阱', '背诵模拟题，巩固要点', '深究模拟题，找准失分点',
  '勤做模拟题，锻炼心态', '整理模拟题，归纳技巧', '细品模拟题，规范作答',
  '反复模拟题，强化记忆', '深挖模拟题，抓住得分点', '整套模拟题，全真演练',
  '回看模拟题，梳理框架', '吃透模拟题，从容应考',
]
function pickRandomMockTitle() {
  return MOCK_TITLE_POOL[Math.floor(Math.random() * MOCK_TITLE_POOL.length)]
}

function drawGridBg(ctx, x, y, w, h, color, opacity, cellSize = 28) {
  if (opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let cx = x; cx <= x + w; cx += cellSize) {
    ctx.moveTo(cx, y)
    ctx.lineTo(cx, y + h)
  }
  for (let cy = y; cy <= y + h; cy += cellSize) {
    ctx.moveTo(x, cy)
    ctx.lineTo(x + w, cy)
  }
  ctx.stroke()
  ctx.restore()
}

function drawFolderIcon(ctx, x, y, size) {
  const s = size
  ctx.fillStyle = '#F5A623'
  ctx.beginPath()
  ctx.roundRect(x, y, s * 0.45, s * 0.22, 3)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(x, y + s * 0.18, s, s * 0.74, 4)
  ctx.fill()
}

function drawPdfIcon(ctx, x, y, size) {
  const s = size
  ctx.fillStyle = '#FF6B6B'
  ctx.beginPath()
  ctx.roundRect(x, y, s, s, 5)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(s * 0.38)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PDF', x + s / 2, y + s / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity) {
  const DPR = 2
  const W = 600
  const BORDER = 10
  const PADDING = 28
  const ICON_SIZE = 30
  const ROW_H = 52
  const TITLE_H = 88
  const H = BORDER + TITLE_H + ROW_H * files.length + PADDING + BORDER
  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2)
  drawGridBg(ctx, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, bgColor, bgOpacity)
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold 34px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, W / 2, BORDER + TITLE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = '#eeeeee'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(BORDER + PADDING, BORDER + TITLE_H)
  ctx.lineTo(W - BORDER - PADDING, BORDER + TITLE_H)
  ctx.stroke()
  const listTop = BORDER + TITLE_H
  files.forEach((file, i) => {
    const y = listTop + i * ROW_H
    const iconY = y + (ROW_H - ICON_SIZE) / 2
    if (file.isdir === 1) {
      drawFolderIcon(ctx, BORDER + PADDING, iconY, ICON_SIZE)
    } else {
      drawPdfIcon(ctx, BORDER + PADDING, iconY, ICON_SIZE)
    }
    ctx.fillStyle = '#333333'
    ctx.font = `15px "PingFang SC", "Microsoft YaHei", sans-serif`
    const maxWidth = W - BORDER * 2 - PADDING * 2 - ICON_SIZE - 12
    let name = file.name
    while (ctx.measureText(name).width > maxWidth && name.length > 1) {
      name = name.slice(0, -1)
    }
    if (name !== file.name) name = name.slice(0, -1) + '...'
    ctx.fillText(name, BORDER + PADDING + ICON_SIZE + 12, y + ROW_H / 2 + 6)
    if (i < files.length - 1) {
      ctx.strokeStyle = '#f5f5f5'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(BORDER + PADDING, y + ROW_H)
      ctx.lineTo(W - BORDER - PADDING, y + ROW_H)
      ctx.stroke()
    }
  })
  return canvas.toDataURL('image/png')
}

async function buildHistoryComposite(pdfDataUrl, files, borderColor, title, bgColor, bgOpacity) {
  const pdfImg = await loadImage(pdfDataUrl)
  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const BORDER = 12
  const TITLE_H = 120
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  const innerX = BORDER, innerY = BORDER
  const innerW = CANVAS_W - BORDER * 2, innerH = CANVAS_H - BORDER * 2
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(innerX, innerY, innerW, innerH)
  drawGridBg(ctx, innerX, innerY, innerW, innerH, bgColor, bgOpacity, 36)
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold ${Math.round(TITLE_H * 0.5)}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, CANVAS_W / 2, innerY + TITLE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const pdfAreaX = innerX, pdfAreaY = innerY + TITLE_H
  const pdfAreaW = innerW, pdfAreaH = innerH - TITLE_H
  const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const cropL = rndInt(30, 70), cropR = rndInt(30, 70), cropT = rndInt(30, 70), cropB = rndInt(30, 70)
  const srcX = cropL, srcY = cropT
  const srcW = pdfImg.width - cropL - cropR, srcH = pdfImg.height - cropT - cropB
  const pdfMargin = rndInt(30, 80)
  const pdfMaxW = pdfAreaW - pdfMargin * 2, pdfMaxH = pdfAreaH - pdfMargin * 2
  const scale = Math.min(pdfMaxW / srcW, pdfMaxH / srcH)
  const pdfDrawW = srcW * scale, pdfDrawH = srcH * scale
  const scaleOffset = rndInt(-50, 50)
  const finalDrawW = pdfDrawW + scaleOffset
  const finalDrawH = pdfDrawH * (finalDrawW / pdfDrawW)
  const finalDrawX = pdfAreaX + (pdfAreaW - finalDrawW) / 2
  const finalDrawY = pdfAreaY + (pdfAreaH - finalDrawH) / 2
  ctx.drawImage(pdfImg, srcX, srcY, srcW, srcH, finalDrawX, finalDrawY, finalDrawW, finalDrawH)
  const ICON_SIZE = 36, ROW_H = 72, OVERLAY_PAD = 20, FONT_SIZE = 20
  const pdfFiles = files.filter(f => f.isdir === 0)
  ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
  const maxTextW = pdfFiles.reduce((max, f) => Math.max(max, ctx.measureText(f.name).width), 0)
  const OVERLAY_W = Math.max(400, Math.min(CANVAS_W - BORDER * 2 - 40, Math.ceil(maxTextW) + ICON_SIZE + OVERLAY_PAD * 2 + 10))
  const OVERLAY_H = pdfFiles.length * ROW_H + OVERLAY_PAD * 2
  const offsetRight = rndInt(30, 80), offsetBottom = rndInt(30, 80)
  const overlayX = CANVAS_W - BORDER - OVERLAY_W - offsetRight
  const overlayY = CANVAS_H - BORDER - OVERLAY_H - offsetBottom
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(overlayX, overlayY, OVERLAY_W, OVERLAY_H, 10)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  pdfFiles.forEach((file, i) => {
    const y = overlayY + OVERLAY_PAD + i * ROW_H
    drawPdfIcon(ctx, overlayX + OVERLAY_PAD, y + (ROW_H - ICON_SIZE) / 2, ICON_SIZE)
    ctx.fillStyle = '#333333'
    ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.fillText(file.name, overlayX + OVERLAY_PAD + ICON_SIZE + 10, y + ROW_H / 2 + 6)
    if (i < pdfFiles.length - 1) {
      ctx.strokeStyle = '#eeeeee'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(overlayX + OVERLAY_PAD, y + ROW_H)
      ctx.lineTo(overlayX + OVERLAY_W - OVERLAY_PAD, y + ROW_H)
      ctx.stroke()
    }
  })
  return canvas.toDataURL('image/png')
}

let pdfjsLib = null
async function ensurePdfjs() {
  if (pdfjsLib) return pdfjsLib
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  pdfjsLib = window.pdfjsLib
  return pdfjsLib
}

async function getBaiduFilesWithRetry(path, MAX_RETRY = 5) {
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await getBaiduFiles(path)
    } catch (e) {
      lastErr = e
      if (attempt < MAX_RETRY) await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw lastErr
}

async function buildDirImageForBatch(path, type, title) {
  const res = await getBaiduFilesWithRetry(path)
  const files = res.files || []
  if (!files.length) throw new Error('目录为空')
  files.sort((a, b) => b.isdir - a.isdir)
  if (type === 'history' || type === 'mock') {
    const keyword = type === 'mock' ? '2026' : '2025'
    const targetPdf = files.find(f => f.isdir === 0 && f.name.includes(keyword))
    if (targetPdf) {
      try {
        const lib = await ensurePdfjs()
        const pdfDoc = await lib.getDocument({
          url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(targetPdf.path)}`,
          httpHeaders: { Authorization: `Bearer ${getToken()}` },
        }).promise
        const page = await pdfDoc.getPage(1)
        const viewport = page.getViewport({ scale: 2 })
        const pdfCanvas = document.createElement('canvas')
        pdfCanvas.width = viewport.width
        pdfCanvas.height = viewport.height
        await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise
        return await buildHistoryComposite(pdfCanvas.toDataURL('image/png'), files, '#F9863B', title, pickRandomBgColor(), 0.35)
      } catch (_) {}
    }
    return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
  }
  if (type === 'custom') {
    const pdfFiles = files.filter(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
    if (pdfFiles.length) {
      try {
        const pdfFile = pdfFiles[Math.floor(Math.random() * pdfFiles.length)]
        const lib = await ensurePdfjs()
        const pdfDoc = await lib.getDocument({
          url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(pdfFile.path)}`,
          httpHeaders: { Authorization: `Bearer ${getToken()}` },
        }).promise
        const page = await pdfDoc.getPage(1)
        const viewport = page.getViewport({ scale: 2 })
        const pdfCanvas = document.createElement('canvas')
        pdfCanvas.width = viewport.width
        pdfCanvas.height = viewport.height
        await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise
        return await buildHistoryComposite(pdfCanvas.toDataURL('image/png'), files, '#F9863B', title, pickRandomBgColor(), 0.35)
      } catch (_) {}
    }
    return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
  }
  return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
}

// --- 笔记内容生成 + Word 导出 ---

const EMOJI_SPLIT = /(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/gu
const EMOJI_TEST = /^(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)$/u

function textToRuns(text, extraProps = {}) {
  if (!text) return [new TextRun({ text: '', ...extraProps })]
  return text.split(EMOJI_SPLIT).filter(Boolean).map(part =>
    EMOJI_TEST.test(part)
      ? new TextRun({ text: part, font: 'Segoe UI Emoji', ...extraProps })
      : new TextRun({ text: part, ...extraProps })
  )
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// 为单个商品生成标题 + 正文，返回 { title, body }，失败抛出异常
async function generateNoteForProduct(detail) {
  const active = llmStore.active
  if (!active) throw new Error('未配置使用中的模型')

  // --- 生成标题 ---
  const titlePromptRes = await getPromptList({ scene: 'title', page: 1, pageSize: 1 })
  const titlePrompt = titlePromptRes.list?.[0]
  if (!titlePrompt) throw new Error('未找到「生成标题」提示词')

  let formulaHint = ''
  if (detail.job_type_id) {
    try {
      const formulaRes = await getRandomTitleFormula(detail.job_type_id)
      if (formulaRes?.formula) {
        formulaHint = `\n\n请参考以下标题公式生成（将其中的 {单位} 替换为实际单位名称，风格、节奏与公式保持一致，不要照搬原句）：\n${formulaRes.formula}`
      }
    } catch (_) {}
  }

  const titleUserContent = [
    `单位名称：${detail.company_name || ''}`,
    `商品类型：${detail.job_type_name || ''}`,
    detail.written_exam_content ? `笔试内容：${detail.written_exam_content}` : '',
    detail.interview_content ? `面试内容：${detail.interview_content}` : '',
    '注意：标题字数不能超过20个字。',
  ].filter(Boolean).join('\n') + formulaHint

  const titleRes = await chatLlm({
    provider: active.provider,
    api_format: active.api_format,
    api_key: active.api_key,
    base_url: active.base_url || '',
    model: active.default_model,
    messages: [
      { role: 'system', content: titlePrompt.content },
      { role: 'user', content: titleUserContent },
    ],
    max_tokens: 512,
    temperature: 0.7,
  })
  let title = (titleRes.content || '').replace(/^["'「『]+|["'」』]+$/g, '').trim()
  if (!title) throw new Error('标题生成：模型未返回内容')
  if (title.length > 20) title = title.slice(0, 20)

  // --- 生成正文 ---
  let sourceText = ''
  let sourceFrom = ''
  const xhsList = detail.xhs_content
  if (Array.isArray(xhsList) && xhsList.length) {
    sourceText = pickRandom(xhsList) || ''
    sourceFrom = '小红书正文'
  }
  if (!sourceText) {
    if (!detail.job_type_id) throw new Error('未配置商品类型且无小红书正文，无法生成正文')
    const tplRes = await getContentTemplateList({ job_type_id: detail.job_type_id, page: 1, pageSize: 100 })
    const tpl = pickRandom(tplRes.list || [])
    if (!tpl) throw new Error(`未找到「${detail.job_type_name || '该类型'}」内容模板`)
    sourceText = tpl.content || ''
    sourceFrom = `内容模板「${tpl.title || tpl.id}」`
  }

  const bodyPromptRes = await getPromptList({ scene: 'content', page: 1, pageSize: 1 })
  const bodyPrompt = bodyPromptRes.list?.[0]
  if (!bodyPrompt) throw new Error('未找到「生成正文」提示词')

  const bodyUserContent = [
    `单位名称：${detail.company_name || ''}`,
    `商品类型：${detail.job_type_name || ''}`,
    `笔记标题：${title}`,
    `参考来源：${sourceFrom}`,
    '',
    '请参考以下文本，紧扣"笔记标题"，重新润色撰写一条小红书笔记正文：',
    sourceText,
    '',
    '只输出正文本身，不要重复标题，不要任何额外说明。',
    '注意：正文中不得出现任何诱导性内容或引流内容（如"关注我"、"添加微信"、"点击链接"、"私信我"、"加群"等），只需聚焦内容本身。',
  ].join('\n')

  const bodyRes = await chatLlm({
    provider: active.provider,
    api_format: active.api_format,
    api_key: active.api_key,
    base_url: active.base_url || '',
    model: active.default_model,
    messages: [
      { role: 'system', content: bodyPrompt.content },
      { role: 'user', content: bodyUserContent },
    ],
    max_tokens: 3000,
    temperature: 0.8,
  })
  const body = (bodyRes.content || '').trim()
  if (!body) throw new Error('正文生成：模型未返回内容')

  return { title, body }
}

function buildNoteDocx(title, body, tags) {
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: textToRuns(title || '（无标题）') }),
        ...String(body || '（无正文）').split('\n').map(line => new Paragraph({ children: textToRuns(line) })),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: textToRuns(Array.isArray(tags) && tags.length ? tags.join(' ') : '（无标签）', { color: 'FF6699' }),
        }),
      ],
    }],
  })
}

// --- 批量生成目录图状态 ---
const dirBatchVisible = ref(false)
const dirBatchGenerating = ref(false)
const dirBatchLogs = ref([])
const dirBatchDone = ref(0)
const dirBatchTotal = ref(0)

async function onBatchGenerateDirImages() {
  if (!selectedRowKeys.value.length) {
    message.warning('请先勾选商品')
    return
  }
  dirBatchLogs.value = []
  dirBatchDone.value = 0
  dirBatchTotal.value = selectedRowKeys.value.length
  dirBatchVisible.value = true
  dirBatchGenerating.value = true

  let JSZip
  try {
    JSZip = await ensureJSZip()
  } catch (e) {
    message.error('JSZip 加载失败，请检查网络')
    dirBatchGenerating.value = false
    return
  }

  const zip = new JSZip()
  let totalImages = 0
  let totalNotes = 0

  for (const id of selectedRowKeys.value) {
    const product = list.value.find(p => p.id === id)
    const company = product?.company_name || `product-${id}`
    dirBatchLogs.value.push({ text: `处理：${company}`, type: 'info' })

    let detail
    try {
      detail = await getProductDetail(id)
    } catch (e) {
      dirBatchLogs.value.push({ text: `  └ 加载失败：${e.message}`, type: 'error' })
      dirBatchDone.value++
      continue
    }

    const tasks = []
    if (detail.baidu_path_exam) {
      tasks.push({ path: detail.baidu_path_exam, type: 'exam', label: '笔试资料目录', title: '笔试资料完整目录' })
      tasks.push({ path: detail.baidu_path_exam, type: 'culture', label: '企业文化目录', title: '企业近况及文化' })
    }
    if (detail.baidu_path_history) {
      tasks.push({ path: detail.baidu_path_history, type: 'history', label: '真题目录', title: pickRandomHistoryTitle() })
    }
    if (detail.baidu_path_mock) {
      tasks.push({ path: detail.baidu_path_mock, type: 'mock', label: '模拟题目录', title: pickRandomMockTitle() })
    }
    if (detail.baidu_custom_dirs?.length) {
      detail.baidu_custom_dirs.forEach((item, idx) => {
        tasks.push({ path: item.path, type: 'custom', label: item.name || `自定义${idx + 1}`, title: item.name || '自定义' })
      })
    }

    if (!tasks.length) {
      dirBatchLogs.value.push({ text: `  └ 未配置百度网盘目录，跳过`, type: 'warn' })
      dirBatchDone.value++
      continue
    }

    const folder = zip.folder(company)
    let imgDone = 0
    for (const task of tasks) {
      try {
        let dataUrl
        if (task.type === 'culture') {
          const res = await getBaiduFilesWithRetry(task.path)
          const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
          const culturePdf = files.find(f => f.isdir === 0 && f.name.includes('企业文化'))
          if (!culturePdf) {
            dirBatchLogs.value.push({ text: `  └ ${task.label}：未找到"企业文化"PDF，跳过`, type: 'warn' })
            continue
          }
          const lib = await ensurePdfjs()
          const pdfDoc = await lib.getDocument({
            url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(culturePdf.path)}`,
            httpHeaders: { Authorization: `Bearer ${getToken()}` },
          }).promise
          const page = await pdfDoc.getPage(1)
          const viewport = page.getViewport({ scale: 2 })
          const pdfCanvas = document.createElement('canvas')
          pdfCanvas.width = viewport.width
          pdfCanvas.height = viewport.height
          await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise
          dataUrl = await buildHistoryComposite(pdfCanvas.toDataURL('image/png'), files, '#F9863B', task.title, pickRandomBgColor(), 0.35)
        } else {
          dataUrl = await buildDirImageForBatch(task.path, task.type, task.title)
        }
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        folder.file(`${task.label}.png`, base64, { base64: true })
        imgDone++
        totalImages++
        dirBatchLogs.value.push({ text: `  └ ${task.label} ✓`, type: 'success' })
      } catch (e) {
        dirBatchLogs.value.push({ text: `  └ ${task.label} 失败：${e.message}`, type: 'error' })
      }
    }
    if (!imgDone) {
      dirBatchLogs.value.push({ text: `  └ 该商品无图片生成`, type: 'warn' })
    }

    // 生成笔记内容并写入 Word
    dirBatchLogs.value.push({ text: `  └ 生成笔记内容中...`, type: 'info' })
    try {
      const { title, body } = await generateNoteForProduct(detail)
      const doc = buildNoteDocx(title, body, detail.xhs_tags)
      const docBlob = await Packer.toBlob(doc)
      folder.file('笔记内容.docx', docBlob)
      totalNotes++
      dirBatchLogs.value.push({ text: `  └ 笔记内容 ✓`, type: 'success' })
    } catch (e) {
      dirBatchLogs.value.push({ text: `  └ 笔记内容失败：${e.message}`, type: 'error' })
    }

    dirBatchDone.value++
  }

  if (totalImages > 0 || totalNotes > 0) {
    try {
      const blob = await zip.generateAsync({ type: 'blob' })
      triggerBlobDownload(blob, `批量目录图-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.zip`)
      const summary = [totalImages > 0 ? `${totalImages} 张图片` : '', totalNotes > 0 ? `${totalNotes} 份笔记` : ''].filter(Boolean).join('、')
      dirBatchLogs.value.push({ text: `✓ 已下载 ZIP，共 ${summary}`, type: 'success' })
    } catch (e) {
      dirBatchLogs.value.push({ text: `ZIP 生成失败：${e.message}`, type: 'error' })
    }
  } else {
    dirBatchLogs.value.push({ text: '无可生成的目录图或笔记内容', type: 'error' })
  }
  dirBatchGenerating.value = false
}

async function onBatchGenerateNoteImages() {
  if (!selectedRowKeys.value.length) {
    message.warning('请先勾选商品')
    return
  }
  batchLogs.value = []
  batchDone.value = 0
  batchTotal.value = selectedRowKeys.value.length
  batchVisible.value = true
  batchGenerating.value = true

  let JSZip
  try {
    JSZip = await ensureJSZip()
  } catch (e) {
    message.error('JSZip 加载失败，请检查网络')
    batchGenerating.value = false
    return
  }

  const zip = new JSZip()
  let totalImages = 0

  for (const id of selectedRowKeys.value) {
    const product = list.value.find(p => p.id === id)
    const name = product?.company_name || `product-${id}`
    batchLogs.value.push({ text: `处理：${name}`, type: 'info' })
    try {
      const detail = await getProductDetail(id)
      const images = detail.xhs_images || []
      if (!images.length) {
        batchLogs.value.push({ text: `  └ 无小红书图片，跳过`, type: 'warn' })
        batchDone.value++
        continue
      }
      const folder = zip.folder(name)
      let imgDone = 0
      for (const [idx, url] of images.entries()) {
        try {
          const blob = await renderOne(url)
          folder.file(`${idx + 1}.png`, blob)
          imgDone++
          totalImages++
        } catch (e) {
          batchLogs.value.push({ text: `  └ 第 ${idx + 1} 张失败：${e.message}`, type: 'error' })
        }
      }
      batchLogs.value.push({ text: `  └ 完成 ${imgDone}/${images.length} 张`, type: imgDone === images.length ? 'success' : 'warn' })
    } catch (e) {
      batchLogs.value.push({ text: `  └ 加载失败：${e.message}`, type: 'error' })
    }
    batchDone.value++
  }

  if (totalImages > 0) {
    try {
      const blob = await zip.generateAsync({ type: 'blob' })
      triggerBlobDownload(blob, `批量笔记图-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.zip`)
      batchLogs.value.push({ text: `✓ 已下载 ZIP，共 ${totalImages} 张`, type: 'success' })
    } catch (e) {
      batchLogs.value.push({ text: `ZIP 生成失败：${e.message}`, type: 'error' })
    }
  } else {
    batchLogs.value.push({ text: '无可生成的图片', type: 'error' })
  }
  batchGenerating.value = false
}

const statusOptions = [
  { label: '上架', value: 1 },
  { label: '下架', value: 0 },
]
const jobTypeOptions = ref([])

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70, fixed: 'left' },
  { title: '公告名称', dataIndex: 'title', width: 240, ellipsis: true },
  { title: '单位', dataIndex: 'company_name', width: 160, ellipsis: true },
  { title: '人数', dataIndex: 'recruit_count', width: 90 },
  { title: '类型', dataIndex: 'job_type_name', width: 120 },
  { title: '报名时间', dataIndex: 'apply_time', width: 160 },
  { title: '笔试时间', dataIndex: 'written_exam_time', width: 140 },
  { title: '面试时间', dataIndex: 'interview_time', width: 140 },
  { title: '原文', key: 'source_url', width: 70 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建人', dataIndex: 'created_by_name', width: 100 },
  { title: '创建时间', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await getProductList({
      keyword: keyword.value,
      job_type_id: filterJobTypeId.value,
      status: filterStatus.value,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    list.value = res.list
    pagination.total = res.total
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ pageSize: 100 })
    jobTypeOptions.value = (res.list || []).map(t => ({ label: t.name, value: t.id }))
  } catch {}
}

function onSearch() {
  pagination.current = 1
  fetchList()
}

function onTableChange(pag) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchList()
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function goCreate() {
  router.push('/product/create')
}

function goEdit(id) {
  router.push(`/product/edit/${id}`)
}

function goDetail(id) {
  router.push(`/product/detail/${id}`)
}

async function onDelete(id) {
  try {
    await deleteProduct(id)
    message.success('删除成功')
    if (list.value.length === 1 && pagination.current > 1) pagination.current--
    fetchList()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

onMounted(() => {
  fetchJobTypes()
  fetchList()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.selection-bar {
  margin-bottom: 8px;
  padding: 6px 12px;
  background: #e6f4ff;
  border-radius: 4px;
  font-size: 13px;
  color: #1677ff;
}
</style>
