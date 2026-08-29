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
      <a-space>
        <a-badge :count="expiredCount" :offset="[-4, 4]">
          <a-button @click="expiredDrawerVisible = true; fetchExpiredProducts()">
            <BellOutlined /> 消息
          </a-button>
        </a-badge>
        <a-button type="primary" @click="goCreate">+ 新增商品</a-button>
      </a-space>
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

    <!-- 批量生成目录图 · 设置弹窗 -->
    <a-modal
      v-model:open="dirBatchSettingsVisible"
      title="批量生成目录图"
      :footer="null"
      width="520px"
    >
      <div style="margin-bottom: 16px">
        <div style="font-size: 13px; font-weight: 500; color: #555; margin-bottom: 8px">生成方式</div>
        <a-radio-group v-model:value="dirBatchOnlyDir" style="display: flex; flex-direction: column; gap: 6px">
          <a-radio :value="false">完整生成（目录图 + 笔记内容 + 卡片图）</a-radio>
          <a-radio :value="true">只生成目录图（仅真题 / 模拟题目录图）</a-radio>
        </a-radio-group>
      </div>
      <a-divider style="margin: 12px 0" />
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px">
        <span style="font-size: 13px; font-weight: 500; color: #555">飞书多维表格</span>
        <a-switch v-model:checked="feishuEnabled" size="small" />
        <span style="font-size: 12px; color: #999">{{ feishuEnabled ? '开启，生成完成后同步到飞书多维表格' : '关闭' }}</span>
      </div>
      <template v-if="feishuEnabled">
        <div style="padding: 10px 12px; background: #f0f9ff; border: 1px solid #bae0ff; border-radius: 6px; font-size: 12px; color: #555; line-height: 1.8; margin-bottom: 12px">
          生成完成后将自动把每条笔记的<b>标题、正文、话题、状态</b>写入飞书多维表格。<br />
          请确保已在「系统设置 → 飞书配置」中填写了多维表格 App Token 和 Table ID。
        </div>
      </template>
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px">
        <a-button @click="dirBatchSettingsVisible = false">取消</a-button>
        <a-button
          type="primary"
          @click="onConfirmBatchDirSettings"
        >开始生成</a-button>
      </div>
    </a-modal>

    <!-- 批量生成目录图 · 进度弹窗 -->
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

    <!-- 报名截止跟进 Drawer -->
    <a-drawer
      v-model:open="expiredDrawerVisible"
      title="报名已截止 · 待跟进笔试"
      placement="right"
      width="780"
    >
      <div style="margin-bottom: 12px; color: #999; font-size: 13px;">
        共 {{ expiredCount }} 条报名截止商品，按截止时间从久到近排列
      </div>
      <a-table
        :columns="expiredColumns"
        :data-source="expiredList"
        :loading="expiredLoading"
        :pagination="{ pageSize: 50, showTotal: t => `共 ${t} 条` }"
        row-key="id"
        size="small"
        :scroll="{ x: 660 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'daysAgo'">
            <a-tag :color="record.daysAgo >= 30 ? 'red' : record.daysAgo >= 14 ? 'orange' : 'default'">
              已截止 {{ record.daysAgo }} 天
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="goDetail(record.id)">详情</a-button>
          </template>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { getProductList, deleteProduct, getProductDetail } from '@/api/products'
import { getJobTypeList } from '@/api/jobTypes'
import { buildRandomGradient, triggerBlobDownload } from '@/utils/imageProcess'
import { getBaiduFiles } from '@/api/baidu'
import { getToken } from '@/api/request'
import { BellOutlined } from '@ant-design/icons-vue'
import { chatLlm } from '@/api/llm'
import { getPromptList } from '@/api/prompts'
import { getContentTemplateList } from '@/api/contentTemplates'
import { useLlmStore } from '@/stores/llm'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { writeFeishuBitableRecords, uploadFeishuBitableImage } from '@/api/feishuConfig'

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

async function buildDirImageForBatch(path, type, title, onlyDir = false) {
  const res = await getBaiduFilesWithRetry(path)
  const files = res.files || []
  if (!files.length) throw new Error('目录为空')
  files.sort((a, b) => b.isdir - a.isdir)
  if (type === 'history' || type === 'mock') {
    if (!onlyDir) {
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
    }
    return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
  }
  if (type === 'custom') {
    if (!onlyDir) {
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

const TITLE_POOL = [
  '碎片时间刷题',
  '通勤间隙悄悄提分',
  '课间摸鱼学考点',
  '短时备考效率拉满',
  '零散时间巧利用',
  '不用全天埋头苦学',
  '碎片化速记考点',
  '轻松挤出备考时长',
  '抽空学核心考点',
  '零基础也无备考压力',
  '碎片化速练题库',
  '不用整块时间复习',
  '日常碎片积累知识点',
  '备考毫不费力',
  '碎片时段专攻高频题',
  '低分快速逆袭',
  '通勤碎片化复盘',
  '日积月累稳提分',
  '碎片轻量化学习',
  '告别长时间苦读',
  '零碎时间攻克重难点',
  '备考省时省力',
  '碎片化记忆口诀',
  '背诵不用费大脑',
  '抽空梳理核心考点',
  '备考轻松无负担',
  '碎片化专项刷题',
  '零散时间冲高分',
  '利用碎片吃透考题',
  '零基础轻松备考',
  '考前全套复盘笔记',
  '避开九成考场失分坑',
  '考前易错考点合集',
  '进考场少丢冤枉分',
  '冲刺终极复盘清单',
  '高频错题一次性扫清',
  '考前梳理易混考点',
  '考场做题不再踩雷',
  '冲刺复盘核心难点',
  '规避各类答题误区',
  '考前错题集中复盘',
  '减少考场失误失分',
  '终极冲刺复盘手册',
  '直击全部易错题型',
  '考前汇总易丢分考点',
  '答题正确率飙升',
  '考前系统复盘重难点',
  '避开出题人陷阱',
  '冲刺专属复盘素材',
  '考场答题少走弯路',
  '考前梳理高频坑点',
  '做题不再频频出错',
  '全套考前复盘干货',
  '轻松规避答题漏洞',
  '冲刺复盘易混淆知识点',
  '做题思路清晰',
  '考前整理经典错题',
  '考场直接规避失分',
  '终极考前复盘攻略',
  '避开所有考题陷阱',
  '科学备考新思路',
  '告别无意义海量刷题',
  '精准锁定得分核心',
  '拒绝盲目题海战术',
  '高效备考底层心法',
  '刷题只刷必考题',
  '抓准核心得分考点',
  '不用盲目大量刷题',
  '备考精简学习思路',
  '摒弃低效重复刷题',
  '高分备考核心技巧',
  '精准拿捏采分要点',
  '高效提分学习逻辑',
  '不做无用刷题消耗',
  '直击试卷核心得分点',
  '告别盲目死刷题',
  '实用备考提分心法',
  '精准攻克必考题型',
  '精简高效复习方案',
  '拒绝无目标刷题',
  '找准考题得分命脉',
  '不用盲目刷整套卷',
  '高分备考实用思路',
  '刷题直击分值考点',
  '科学提分备考法则',
  '远离低效盲目刷题',
  '精准对标得分要点',
  '省去海量无用刷题',
  '备考极简高效心法',
  '刷题只练高频考题',
  '深挖历年真题套路',
  '摸透考官出题思路',
  '拆解真题底层逻辑',
  '一眼看透命题方向',
  '深度剖析历年真题',
  '掌握固定出题规律',
  '吃透真题核心套路',
  '考场答题举一反三',
  '逐道拆解真题考点',
  '摸清全部命题逻辑',
  '深挖真题隐藏考点',
  '精准预判考试题型',
  '研究历年真题规律',
  '读懂出题人侧重点',
  '吃透全套历年真题',
  '掌握稳定出题框架',
  '深度拆解真题题型',
  '抓住核心命题逻辑',
  '深挖真题答题思路',
  '轻松拿捏考试命题',
  '逐套剖析历年真题',
  '摸清每年出题走向',
  '吃透真题底层规律',
  '考场做题游刃有余',
  '深挖真题高频命题点',
  '精准预判考题走向',
  '拆解真题内在逻辑',
  '不用瞎猜考试重点',
  '深耕历年真题题库',
  '吃透整套命题思路',
  '分模块专项精准训练',
  '各科分数稳步上涨',
  '薄弱项针对性专项突破',
  '短板快速补齐',
  '分题型专项强化练习',
  '各科分值持续提升',
  '弱项专项集中攻克',
  '稳步拉高笔试总分',
  '分科专项精准刷题',
  '低分稳步冲到高分',
  '针对性攻克薄弱模块',
  '成绩持续稳步提升',
  '高频题型专项特训',
  '分值一路稳步上涨',
  '短板专项集中突破',
  '各科分数稳步提升',
  '分考点专项针对性练习',
  '笔试稳涨分',
  '重难点专项集中攻坚',
  '总分稳步往上走',
  '小白零基础上岸攻略',
  '拒绝长篇死记硬背',
  '零基础速成通关技巧',
  '背诵不用死磕书本',
  '纯小白懒人备考秘籍',
  '轻松一战顺利上岸',
  '零基础极简通关方法',
  '不用大量背诵记忆',
  '零基础速成提分套路',
  '告别枯燥死记硬背',
  '懒人专属上岸干货',
  '少背书也能稳通关',
  '零基础简易备考思路',
  '不用死背厚厚教材',
  '小白速成上岸心法',
  '轻松学习不用硬背',
  '零基础懒人通关指南',
  '短时复习顺利上岸',
  '零基础速通备考技巧',
  '摆脱死记硬背模式',
  '最新官方考情深度解读',
  '找准考试核心重点',
  '全新年度考情分析',
  '摸清每年分值侧重点',
  '最新考情完整拆解',
  '复习备考绝不走弯路',
  '年度考情全面剖析',
  '精准锁定高频考点',
  '全新考势完整解读',
  '避开无用复习内容',
  '最新考试趋势拆解',
  '备考精准直击重点',
  '深度解读本年度考情',
  '复习方向不跑偏',
  '最新考情完整梳理',
  '精准把握出题侧重点',
  '考前不用死啃教材',
  '吃透题库轻松通关',
  '临时备考不用背书',
  '刷透真题稳过笔试',
  '短期冲刺不用啃厚书',
  '专攻题库就够用',
  '考前无需通篇背书',
  '吃透题型轻松上岸',
  '懒人极简备考方案',
  '少背书多刷题稳过',
  '临时突击不用苦背书',
  '吃透考题轻松进面',
  '这套高频题库刷熟练',
  '考场答题少失分',
  '考前别盲目啃全书',
  '吃透核心题库足矣',
  '千万别纯裸考',
  '吃透核心考点轻松突围',
  '短期备考听劝',
  '少啃书本多刷真题',
  '刷完这套核心题库',
  '笔试高分稳稳拿捏',
  '拒绝盲目裸考',
  '吃透考题侧重点稳进面',
]

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// 为单个商品生成标题 + 正文，返回 { title, body }，失败抛出异常
async function generateNoteForProduct(detail) {
  const active = llmStore.active
  if (!active) throw new Error('未配置使用中的模型')

  // --- 生成标题：从 TITLE_POOL 随机取一条拼接单位名称，不调大模型 ---
  const randomTitle = TITLE_POOL[Math.floor(Math.random() * TITLE_POOL.length)]
  const title = `${detail.company_name || ''}笔试，${randomTitle}`

  // --- 生成正文：随机取一条正文模版，结合标题发给大模型生成 ---
  const params = { page: 1, pageSize: 100 }
  if (detail.job_type_id) params.job_type_id = detail.job_type_id
  const tplRes = await getContentTemplateList(params)
  const tpl = pickRandom(tplRes.list || [])
  if (!tpl) throw new Error(`未找到「${detail.job_type_name || '该类型'}」内容模板，无法生成正文`)

  const bodyPromptRes = await getPromptList({ scene: 'content', page: 1, pageSize: 1 })
  const bodyPrompt = bodyPromptRes.list?.[0]
  if (!bodyPrompt) throw new Error('未找到「生成正文」场景的提示词')

  const bodyUserContent = [
    '以下是一段小红书正文模版，请严格保留其结构、分段方式和写作风格，',
    '将模版中的企业名称和考试内容替换为下方商品信息，重新创作一条全新的小红书正文。',
    '',
    '【参考模版】',
    tpl.content,
    '',
    '【商品信息】',
    `企业名称：${detail.company_name || ''}`,
    `笔试内容：${detail.job_type_name || ''}`,
    `笔记标题：${title}`,
    '',
    '要求：只输出正文，不重复标题，不含任何引流内容（关注我、加微信、私信等），数字和表情符号的使用风格与模版保持一致。',
    '禁止使用网络口头禅或夸张感叹句，例如"谁懂啊家人们"、"后台被问麻了"、"救命"、"真的绷不住"等，语气保持实用、亲切即可。',
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

// --- 卡片图（CardBasic 风格，与 Detail.vue CardEditor 保持一致）---

const CARD_BASIC_SCHEMES = [
  { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' },
  { bg: '#fff3cd', text: '#5a3a00', accent: '#f5a623' },
  { bg: '#dde8ff', text: '#1a2f6e', accent: '#4472ca' },
  { bg: '#ede0ff', text: '#3d1a6e', accent: '#8b5cf6' },
  { bg: '#fce8e8', text: '#6e1a1a', accent: '#e53e3e' },
]

function wrapTextLines(ctx, text, maxWidth) {
  const result = []
  const paragraphs = String(text || '').split('\n')
  for (const para of paragraphs) {
    if (!para) { result.push(''); continue }
    let current = ''
    for (const char of para) {
      const test = current + char
      if (ctx.measureText(test).width > maxWidth) {
        if (current) result.push(current)
        current = char
      } else {
        current = test
      }
    }
    if (current) result.push(current)
  }
  return result
}

// 拆分卡片文字：逗号前（高亮）/ 逗号及之后（普通）
function splitAtFirstComma(text) {
  const idx = String(text || '').search(/[，,]/)
  if (idx === -1) return { hlText: text, restText: '' }
  return { hlText: text.slice(0, idx), restText: text.slice(idx) }
}

function renderCardBasicImage(text, scheme) {
  // CardBasic 基础尺寸 360×480，pixelRatio=3 导出 → 1080×1440
  const SCALE = 3
  const W = 360 * SCALE   // 1080
  const H = 480 * SCALE   // 1440
  const PAD_L = 40 * SCALE
  const PAD_R = 40 * SCALE
  const PAD_T = 44 * SCALE
  const PAD_B = 36 * SCALE
  const RADIUS = 20 * SCALE

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // 圆角背景
  ctx.fillStyle = scheme.bg
  ctx.beginPath()
  ctx.roundRect(0, 0, W, H, RADIUS)
  ctx.fill()

  // 大引号（" ）
  const QUOTE_FONT_SIZE = 72 * SCALE
  ctx.save()
  ctx.globalAlpha = 0.75
  ctx.fillStyle = scheme.accent
  ctx.font = `bold ${QUOTE_FONT_SIZE}px Georgia, serif`
  ctx.textBaseline = 'top'
  ctx.fillText('\u201C', PAD_L, PAD_T)
  ctx.restore()

  // 文字区域（引号下方）
  const FONT_SIZE = 36 * SCALE
  const LINE_HEIGHT = FONT_SIZE * 1.75
  const QUOTE_RENDERED_H = QUOTE_FONT_SIZE * 0.8  // line-height: 0.8
  const QUOTE_MB = 16 * SCALE
  const TEXT_TOP = PAD_T + QUOTE_RENDERED_H + QUOTE_MB
  const TEXT_WIDTH = W - PAD_L - PAD_R
  const BAR_H = 4 * SCALE
  const TEXT_BOTTOM = H - PAD_B - BAR_H - 8 * SCALE

  // bg-yellow 高亮色（对应 HL_STYLES 第5个：黄色荧光）
  const HL_COLOR = '#ffea7a'

  // 拆分高亮部分（逗号前）与普通部分
  const { hlText } = splitAtFirstComma(text)
  let hlCharsLeft = hlText.length  // 剩余需要高亮的字符数

  const FONT_NORMAL = `600 ${FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`
  const FONT_BOLD = `bold ${FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`

  ctx.font = FONT_NORMAL
  ctx.textBaseline = 'top'

  const lines = wrapTextLines(ctx, text, TEXT_WIDTH)
  let y = TEXT_TOP

  for (const line of lines) {
    if (y + FONT_SIZE > TEXT_BOTTOM) break

    // 当前行中需要高亮的部分和普通部分
    const hlLen = Math.min(hlCharsLeft, line.length)
    const hlPart = line.slice(0, hlLen)
    const normalPart = line.slice(hlLen)
    hlCharsLeft -= hlLen

    let x = PAD_L

    // 高亮段：bg-yellow 效果（底部 45% 区域填黄色 + 加粗文字）
    if (hlPart) {
      ctx.font = FONT_BOLD
      const hlW = ctx.measureText(hlPart).width
      // linear-gradient(transparent 55%, #ffea7a 55%) → 从 55% 处开始到底部
      const stripY = y + FONT_SIZE * 0.55
      const stripH = FONT_SIZE * 0.47  // 留少许余量覆盖 45%
      ctx.fillStyle = HL_COLOR
      ctx.fillRect(x, stripY, hlW, stripH)
      // 文字绘制于高亮色之上
      ctx.fillStyle = scheme.text
      ctx.fillText(hlPart, x, y)
      x += hlW
    }

    // 普通段
    if (normalPart) {
      ctx.font = FONT_NORMAL
      ctx.fillStyle = scheme.text
      ctx.fillText(normalPart, x, y)
    }

    y += LINE_HEIGHT
  }

  // 底部装饰条
  const BAR_W = 40 * SCALE
  ctx.fillStyle = scheme.accent
  ctx.beginPath()
  ctx.roundRect(PAD_L, H - PAD_B - BAR_H, BAR_W, BAR_H, 2 * SCALE)
  ctx.fill()

  return canvas.toDataURL('image/png')
}

// --- 批量生成目录图状态 ---
const dirBatchSettingsVisible = ref(false)  // 设置弹窗
const dirBatchOnlyDir = ref(false)          // 只生成目录图模式
const feishuEnabled = ref(false)            // 飞书文档开关
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
  dirBatchSettingsVisible.value = true
}

function onConfirmBatchDirSettings() {
  dirBatchSettingsVisible.value = false
  runBatchDirImages(dirBatchOnlyDir.value)
}

async function runBatchDirImages(onlyDirImages) {
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
  const feishuRecords = []   // 收集飞书多维表格行

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
    const productImages = []  // 收集本商品所有生成图片，用于同步到飞书附件
    for (const task of tasks) {
      try {
        let dataUrl
        if (task.type === 'culture') {
          const res = await getBaiduFilesWithRetry(task.path)
          const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
          // 企业文化始终生成 PDF 合成图
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
          dataUrl = await buildDirImageForBatch(task.path, task.type, task.title, onlyDirImages)
        }
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        folder.file(`${task.label}.png`, base64, { base64: true })
        imgDone++
        totalImages++
        dirBatchLogs.value.push({ text: `  └ ${task.label} ✓`, type: 'success' })
        productImages.push({ dataUrl, filename: `${task.label}.png` })
      } catch (e) {
        dirBatchLogs.value.push({ text: `  └ ${task.label} 失败：${e.message}`, type: 'error' })
      }
    }
    if (!imgDone) {
      dirBatchLogs.value.push({ text: `  └ 该商品无图片生成`, type: 'warn' })
    }

    // 生成笔记内容并写入 Word
    dirBatchLogs.value.push({ text: `  └ 生成笔记内容中...`, type: 'info' })
    let noteResult = null
    try {
      const { title, body } = await generateNoteForProduct(detail)
      noteResult = { title, body }
      const doc = buildNoteDocx(title, body, detail.xhs_tags)
      const docBlob = await Packer.toBlob(doc)
      folder.file('笔记内容.docx', docBlob)
      totalNotes++
      dirBatchLogs.value.push({ text: `  └ 笔记内容 ✓`, type: 'success' })
    } catch (e) {
      dirBatchLogs.value.push({ text: `  └ 笔记内容失败：${e.message}`, type: 'error' })
    }

    // 生成卡片图（CardBasic 风格，随机配色 + 随机文案）
    dirBatchLogs.value.push({ text: `  └ 生成卡片图中...`, type: 'info' })
    try {
      const cardScheme = CARD_BASIC_SCHEMES[Math.floor(Math.random() * CARD_BASIC_SCHEMES.length)]
      const cardTitleRandom = TITLE_POOL[Math.floor(Math.random() * TITLE_POOL.length)]
      const cardText = `${detail.company_name || ''}笔试，${cardTitleRandom}`
      const cardDataUrl = renderCardBasicImage(cardText, cardScheme)
      const cardBase64 = cardDataUrl.replace(/^data:image\/png;base64,/, '')
      folder.file('卡片图.png', cardBase64, { base64: true })
      totalImages++
      dirBatchLogs.value.push({ text: `  └ 卡片图 ✓`, type: 'success' })
      productImages.push({ dataUrl: cardDataUrl, filename: '卡片图.png' })
    } catch (e) {
      dirBatchLogs.value.push({ text: `  └ 卡片图失败：${e.message}`, type: 'error' })
    }

    // 写入飞书多维表格（含图片附件）
    if (feishuEnabled.value && noteResult) {
      const nowTs = Date.now()
      // 先将本商品所有图片上传到飞书素材库，获取 file_token
      const fileTokens = []
      for (const { dataUrl, filename } of productImages) {
        try {
          const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
          const res = await uploadFeishuBitableImage({ base64, filename })
          if (res?.data?.file_token) fileTokens.push(res.data.file_token)
        } catch (e) {
          dirBatchLogs.value.push({ text: `  └ 图片上传飞书失败（${filename}）：${e.message}`, type: 'warn' })
        }
      }
      feishuRecords.push({
        title: noteResult.title,
        body: noteResult.body,
        tags: Array.isArray(detail.xhs_tags) ? detail.xhs_tags.join('，') : (detail.xhs_tags || ''),
        status: '待制作',
        error_info: '',
        created_at: nowTs,
        updated_at: nowTs,
        file_tokens: fileTokens,
      })
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

  // 飞书多维表格同步
  if (feishuEnabled.value && feishuRecords.length) {
    dirBatchLogs.value.push({ text: `同步飞书多维表格（${feishuRecords.length} 条）...`, type: 'info' })
    try {
      await writeFeishuBitableRecords(feishuRecords)
      dirBatchLogs.value.push({ text: `✓ 飞书多维表格写入成功，共 ${feishuRecords.length} 条`, type: 'success' })
    } catch (e) {
      dirBatchLogs.value.push({ text: `飞书写入失败：${e.message}`, type: 'error' })
    }
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

// ---- 报名截止跟进 ----

/**
 * 从 apply_time 文本中提取截止日期（取最后一个 XX月XX日）
 * 支持：
 *   "06月05日 - 06月15日"  → 06月15日
 *   "06月07日截止"         → 06月07日
 *   "公告发布日 - 07月31日" → 07月31日
 */
function parseApplyEndDate(applyTime) {
  if (!applyTime) return null
  const matches = applyTime.match(/(\d{1,2})月(\d{1,2})日/g)
  if (!matches || matches.length === 0) return null
  const last = matches[matches.length - 1].match(/(\d{1,2})月(\d{1,2})日/)
  const month = parseInt(last[1])
  const day = parseInt(last[2])
  const now = new Date()
  let year = now.getFullYear()
  // 如果推算出来的日期比今天晚超过 180 天，说明是上一年的
  const candidate = new Date(year, month - 1, day)
  if (candidate - now > 180 * 24 * 60 * 60 * 1000) year -= 1
  return new Date(year, month - 1, day)
}

const expiredDrawerVisible = ref(false)
const expiredLoading = ref(false)
const expiredList = ref([])   // [{ ...product, endDate, daysAgo }]

const expiredCount = computed(() => expiredList.value.length)

async function fetchExpiredProducts() {
  expiredLoading.value = true
  try {
    // 拉全量（最多 2000 条），在前端解析截止日期
    const res = await getProductList({ page: 1, pageSize: 2000 })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result = []
    for (const p of res.list) {
      const endDate = parseApplyEndDate(p.apply_time)
      if (!endDate) continue
      endDate.setHours(0, 0, 0, 0)
      if (endDate < today) {
        const daysAgo = Math.round((today - endDate) / (24 * 60 * 60 * 1000))
        result.push({ ...p, endDate, daysAgo })
      }
    }
    // 截止越久排越前
    result.sort((a, b) => b.daysAgo - a.daysAgo)
    expiredList.value = result
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    expiredLoading.value = false
  }
}

const expiredColumns = [
  { title: '单位', dataIndex: 'company_name', width: 160, ellipsis: true },
  { title: '报名截止', dataIndex: 'apply_time', width: 160 },
  { title: '已截止天数', key: 'daysAgo', width: 110 },
  { title: '笔试时间', dataIndex: 'written_exam_time', width: 140 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' },
]

onMounted(() => {
  fetchJobTypes()
  fetchList()
  fetchExpiredProducts()
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
