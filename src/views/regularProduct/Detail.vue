<template>
  <div class="regular-product-detail">
    <!-- 头部操作栏 -->
    <div class="page-header">
      <a-button @click="$router.back()" style="margin-right: 12px">← 返回</a-button>
      <h2 class="page-title">常规商品详情</h2>
      <a-button type="primary" style="margin-left: auto" @click="$router.push(`/regular-product/edit/${id}`)">编辑</a-button>
    </div>

    <!-- 加载中 -->
    <a-spin :spinning="loading" tip="加载中...">
      <div v-if="product" class="content-area">
        <!-- 基本信息 -->
        <div class="info-card">
          <a-descriptions :column="2" bordered size="middle">
            <a-descriptions-item label="标题" :span="2">{{ product.title }}</a-descriptions-item>
            <a-descriptions-item label="网盘路径" :span="2">
              <div class="disk-path-row">
                <code class="disk-path-code">{{ product.disk_path }}</code>
                <a-button
                  type="primary"
                  size="small"
                  :loading="treeLoading"
                  @click="toggleFileBrowser"
                  style="margin-left: 12px"
                >
                  {{ showFileBrowser ? '收起文件目录' : '查看网盘文件' }}
                </a-button>
              </div>
            </a-descriptions-item>
            <a-descriptions-item label="标签">
              <a-tag v-if="product.tags">{{ product.tags }}</a-tag>
              <span v-else class="text-gray">—</span>
            </a-descriptions-item>
            <a-descriptions-item label="笔记标题" :span="2">
              <div v-if="product.note_title" class="note-title-preview">
                <span class="note-title-text">{{ notePreview }}</span>
                <a-button type="link" size="small" @click="drawerOpen = true">展开查看</a-button>
              </div>
              <span v-else class="text-gray">—</span>
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">{{ formatTime(product.created_at) }}</a-descriptions-item>
            <a-descriptions-item label="创建人">{{ product.created_by_name || '—' }}</a-descriptions-item>
            <a-descriptions-item label="更新时间">{{ formatTime(product.updated_at) }}</a-descriptions-item>
          </a-descriptions>
        </div>

        <!-- 文件树区域 -->
        <div v-if="showFileBrowser" class="file-browser-section">
          <div class="section-title">
            📂 网盘文件目录
            <template v-if="treeData.length > 0">
              <label class="color-picker-label" title="边框颜色">
                <span class="color-swatch" :style="{ background: dirImgBorderColor }"></span>
                边框色
                <input type="color" v-model="dirImgBorderColor" class="color-input" />
              </label>
              <a-button
                size="small"
                type="primary"
                :loading="dirImgGenerating"
                @click="generateAndDownloadDirImage"
              >📥 生成目录图并下载</a-button>
            </template>
          </div>
          <a-spin :spinning="treeLoading" tip="加载文件列表...">
            <div v-if="treeData.length === 0 && !treeLoading" class="empty-tip">
              目录为空或加载失败
            </div>
            <a-tree
              v-else
              :tree-data="treeData"
              :load-data="onLoadData"
              block-node
              @select="onTreeSelect"
            >
              <template #title="node">
                <span class="tree-node-row">
                  <span
                    :class="{ 'pdf-node': node.isLeaf && isPdf(node.title) }"
                    @click.stop="node.isLeaf && isPdf(node.title) ? openPdf({ name: node.title, path: node.key }) : null"
                  >
                    <span class="tree-icon">{{ node.isLeaf ? '📄' : '📁' }}</span>
                    {{ node.title }}
                    <a-tag v-if="node.isLeaf && isPdf(node.title)" color="red" style="margin-left: 6px; font-size: 11px">PDF</a-tag>
                  </span>
                  <a-button
                    v-if="!node.isLeaf"
                    size="small"
                    type="text"
                    class="node-dir-img-btn"
                    :loading="generatingNodeKey === node.key"
                    title="生成该文件夹目录图"
                    @click.stop="generateNodeDirImage(node)"
                  >📥</a-button>
                </span>
              </template>
            </a-tree>
          </a-spin>
        </div>

        <!-- PDF 预览区域 -->
        <div v-if="pdfState.visible" class="pdf-section">
          <div class="section-title">
            📄 PDF 预览：{{ pdfState.filename }}
            <a-button size="small" style="margin-left: 12px" @click="closePdf">关闭</a-button>
          </div>
          <a-spin :spinning="pdfState.loading" tip="加载 PDF 中...">
            <div v-if="pdfState.error" class="pdf-error">{{ pdfState.error }}</div>
            <div v-else class="pdf-viewer">
              <!-- 翻页控件 -->
              <div class="pdf-toolbar">
                <a-button
                  size="small"
                  :disabled="pdfState.currentPage <= 1 || pdfState.rendering"
                  @click="changePage(-1)"
                >上一页</a-button>
                <span class="page-info">
                  第 {{ pdfState.currentPage }} 页 / 共 {{ pdfState.totalPages }} 页
                </span>
                <a-button
                  size="small"
                  :disabled="pdfState.currentPage >= pdfState.totalPages || pdfState.rendering"
                  @click="changePage(1)"
                >下一页</a-button>
                <span class="jump-label">跳转</span>
                <a-input-number
                  v-model:value="jumpPage"
                  :min="1"
                  :max="pdfState.totalPages"
                  :disabled="pdfState.rendering"
                  size="small"
                  style="width: 70px"
                  @pressEnter="handleJump"
                />
                <a-button size="small" :disabled="pdfState.rendering" @click="handleJump">GO</a-button>
                <a-button size="small" type="primary" :disabled="pdfState.rendering" @click="downloadSnapshot">📥 下载截图</a-button>
              </div>
              <!-- 画布 -->
              <div class="canvas-wrapper">
                <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
              </div>
            </div>
          </a-spin>
        </div>
      </div>
    </a-spin>

    <!-- 笔记标题 Drawer -->
    <a-drawer
      v-model:open="drawerOpen"
      title="笔记标题"
      placement="right"
      :width="480"
      :body-style="{ padding: '20px', overflowY: 'auto' }"
    >
      <pre class="drawer-note-content">{{ product?.note_title }}</pre>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { getRegularProductDetail } from '@/api/regularProducts'
import { request, getToken } from '@/api/request'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const route = useRoute()
const id = computed(() => route.params.id)

// ── 商品数据 ─────────────────────────────────────────────
const loading = ref(true)
const product = ref(null)
const drawerOpen = ref(false)
const notePreview = computed(() => {
  const t = product.value?.note_title || ''
  return t.length > 80 ? t.slice(0, 80) + '…' : t
})

async function loadDetail() {
  loading.value = true
  try {
    product.value = await getRegularProductDetail(id.value)
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

// ── 文件树 ───────────────────────────────────────────────
const showFileBrowser = ref(false)
const treeLoading = ref(false)
const treeData = ref([])

// ── 目录图生成（复用 batchDirGen.worker 算法，主线程 canvas 版）────
const BG_COLOR_POOL = [
  '#a8c8f0','#f0a8b4','#a8e0c8','#f0d0a8','#c8b4f0','#a8d8f0','#f0e0a8','#b4f0d0',
  '#f0b4c8','#b4c8f0','#d0f0a8','#f0c8a8','#ffd6d6','#d6f0ff','#d6ffd6','#fff0d6',
]
const pickBgColor = () => BG_COLOR_POOL[Math.floor(Math.random() * BG_COLOR_POOL.length)]

function _drawGridBg(ctx, x, y, w, h, color, opacity, cellSize = 28) {
  if (opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let cx = x; cx <= x + w; cx += cellSize) { ctx.moveTo(cx, y); ctx.lineTo(cx, y + h) }
  for (let cy = y; cy <= y + h; cy += cellSize) { ctx.moveTo(x, cy); ctx.lineTo(x + w, cy) }
  ctx.stroke(); ctx.restore()
}

function _drawFolderIcon(ctx, x, y, size) {
  ctx.fillStyle = '#F5A623'
  ctx.beginPath(); ctx.roundRect(x, y, size * 0.45, size * 0.22, 3); ctx.fill()
  ctx.beginPath(); ctx.roundRect(x, y + size * 0.18, size, size * 0.74, 4); ctx.fill()
}

function _drawPdfIcon(ctx, x, y, size) {
  ctx.fillStyle = '#FF6B6B'
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 5); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(size * 0.38)}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('PDF', x + size / 2, y + size / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

const dirImgGenerating = ref(false)
const dirImgBorderColor = ref('#F9863B')  // 边框颜色，默认橙色
const generatingNodeKey = ref(null)       // 正在生成目录图的文件夹 key

// 递归收集所有当前已加载的可见节点（包含展开的子目录内容），带深度信息
function collectVisibleNodes(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    result.push({ name: node.title, isdir: node.isLeaf ? 0 : 1, depth })
    if (node.children?.length) {
      collectVisibleNodes(node.children, depth + 1, result)
    }
  }
  return result
}

// ── 公共画布逻辑 ─────────────────────────────────────────
async function _doGenerateDirImage(files, title) {
  const DPR = 2, W = 600
  const BORDER = 10, PADDING = 28, ICON_SIZE = 26, ROW_H = 48, TITLE_H = 88
  const INDENT = 18
  const H = BORDER + TITLE_H + ROW_H * files.length + PADDING + BORDER

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)

  // 背景
  ctx.fillStyle = dirImgBorderColor.value; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2)
  _drawGridBg(ctx, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, pickBgColor(), 0.35)

  // 标题
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold 34px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(title, W / 2, BORDER + TITLE_H / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

  // 分隔线
  ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(BORDER + PADDING, BORDER + TITLE_H)
  ctx.lineTo(W - BORDER - PADDING, BORDER + TITLE_H)
  ctx.stroke()

  // 文件列表
  const listTop = BORDER + TITLE_H
  files.forEach((file, i) => {
    const y = listTop + i * ROW_H
    const iconY = y + (ROW_H - ICON_SIZE) / 2
    const indentX = BORDER + PADDING + file.depth * INDENT
    file.isdir === 1
      ? _drawFolderIcon(ctx, indentX, iconY, ICON_SIZE)
      : _drawPdfIcon(ctx, indentX, iconY, ICON_SIZE)

    ctx.fillStyle = file.depth === 0 ? '#222222' : '#444444'
    ctx.font = file.depth === 0
      ? `bold 15px "PingFang SC", "Microsoft YaHei", sans-serif`
      : `14px "PingFang SC", "Microsoft YaHei", sans-serif`
    const textX = indentX + ICON_SIZE + 10
    const maxWidth = W - BORDER - PADDING - textX
    let name = file.name
    while (ctx.measureText(name).width > maxWidth && name.length > 1) name = name.slice(0, -1)
    if (name !== file.name) name = name.slice(0, -1) + '...'
    ctx.fillText(name, textX, y + ROW_H / 2 + 5)

    if (i < files.length - 1) {
      ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(BORDER + PADDING, y + ROW_H)
      ctx.lineTo(W - BORDER - PADDING, y + ROW_H)
      ctx.stroke()
    }
  })

  // 下载
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `目录图_${title}.png`
  a.click()
}

// 整棵树的目录图（顶部工具栏按钮）
async function generateAndDownloadDirImage() {
  if (!treeData.value.length) return
  dirImgGenerating.value = true
  try {
    const files = collectVisibleNodes(treeData.value)
    await _doGenerateDirImage(files, product.value.title || '文件目录')
    message.success('目录图已下载')
  } catch (e) {
    message.error('生成失败：' + e.message)
  } finally {
    dirImgGenerating.value = false
  }
}

// 指定文件夹的目录图（节点行内按钮）
async function generateNodeDirImage(node) {
  const targetNode = findNode(treeData.value, node.key)
  if (!targetNode) return

  if (!targetNode.children) {
    message.info('请先展开该文件夹以加载子目录，再生成目录图')
    return
  }
  if (targetNode.children.length === 0) {
    message.warning('该文件夹为空，无内容可生成')
    return
  }

  generatingNodeKey.value = node.key
  try {
    const files = collectVisibleNodes(targetNode.children, 0)
    await _doGenerateDirImage(files, node.title)
    message.success('目录图已下载')
  } catch (e) {
    message.error('生成失败：' + e.message)
  } finally {
    generatingNodeKey.value = null
  }
}

async function toggleFileBrowser() {
  if (showFileBrowser.value) {
    showFileBrowser.value = false
    return
  }
  showFileBrowser.value = true
  if (treeData.value.length > 0) return  // 已加载过
  await loadRootFiles()
}

async function loadRootFiles() {
  treeLoading.value = true
  try {
    const res = await request(`/api/baidu/files?path=${encodeURIComponent(product.value.disk_path)}`)
    const files = (res?.files || []).sort((a, b) => b.isdir - a.isdir)
    treeData.value = files.map(f => fileToNode(f))
  } catch (e) {
    message.error('加载文件列表失败：' + (e.message || '未知错误'))
  } finally {
    treeLoading.value = false
  }
}

function fileToNode(f) {
  return {
    title: f.name,
    key: f.path,
    isLeaf: f.isdir !== 1,
  }
}

// 递归在 treeData 中找到 key 对应节点并写入 children
function injectChildren(nodes, key, children) {
  for (const node of nodes) {
    if (node.key === key) { node.children = children; return true }
    if (node.children?.length && injectChildren(node.children, key, children)) return true
  }
  return false
}

function onLoadData(treeNode) {
  return new Promise((resolve) => {
    // 已有子节点则直接完成
    const existing = findNode(treeData.value, treeNode.key)
    if (existing?.children?.length) { resolve(); return }

    request(`/api/baidu/files?path=${encodeURIComponent(treeNode.key)}`)
      .then(res => {
        const files = (res?.files || []).sort((a, b) => b.isdir - a.isdir)
        const children = files.map(f => fileToNode(f))
        injectChildren(treeData.value, treeNode.key, children)
        treeData.value = [...treeData.value]  // 触发重渲染
        resolve()
      })
      .catch(e => {
        message.error('加载子目录失败：' + (e.message || '未知错误'))
        resolve()
      })
  })
}

function findNode(nodes, key) {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children?.length) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

function onTreeSelect(keys, { node }) {
  if (node.isLeaf && isPdf(node.title)) {
    openPdf({ name: node.title, path: node.key })
  }
}

function isPdf(name) {
  return /\.pdf$/i.test(name || '')
}

// ── PDF 预览 ─────────────────────────────────────────────
const pdfCanvas = ref(null)

// pdfDoc 用普通变量存储，不放入 reactive —— 避免 Vue Proxy 包裹后
// PDF.js 访问私有字段 #d 失败（Cannot read private member #d）
let _pdfDoc = null

const pdfState = reactive({
  visible: false,
  loading: false,
  error: '',
  filename: '',
  path: '',
  currentPage: 1,
  totalPages: 0,
  rendering: false,
})

let pdfjsLib = null

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdfjs]')
    if (existing) {
      // 已注入，等待全局变量就绪
      const check = setInterval(() => {
        if (window.pdfjsLib) { pdfjsLib = window.pdfjsLib; clearInterval(check); resolve(pdfjsLib) }
      }, 50)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.setAttribute('data-pdfjs', '1')
    script.onload = () => {
      // 禁用 PDF.js 子 Worker（避免跨域类实例私有成员不匹配错误）
      // 与 batchDirGen.worker.js 保持一致，在当前线程内解析 PDF
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = ''
      pdfjsLib = window.pdfjsLib
      resolve(pdfjsLib)
    }
    script.onerror = () => reject(new Error('PDF.js 加载失败'))
    document.head.appendChild(script)
  })
}

async function openPdf(fileRef) {
  pdfState.visible = true
  pdfState.loading = true
  pdfState.error = ''
  pdfState.filename = fileRef.name
  pdfState.path = fileRef.path
  _pdfDoc = null
  pdfState.currentPage = 1
  pdfState.totalPages = 0

  try {
    const lib = await loadPdfJs()

    const token = getToken()
    const url = `${API_BASE}/api/baidu/proxy-pdf?path=${encodeURIComponent(fileRef.path)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`PDF 加载失败 (${res.status})`)
    const buffer = await res.arrayBuffer()

    const doc = await lib.getDocument({ data: buffer }).promise
    _pdfDoc = doc          // 存入普通变量，不经过 Vue 响应式
    pdfState.totalPages = doc.numPages
    pdfState.currentPage = 1
    pdfState.loading = false

    await nextTick()
    await renderPage(1)
  } catch (e) {
    pdfState.loading = false
    pdfState.error = e.message || 'PDF 加载失败'
  }
}

async function renderPage(pageNum) {
  if (!_pdfDoc || !pdfCanvas.value) return
  pdfState.rendering = true
  try {
    const page = await _pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = pdfCanvas.value
    const ctx = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    pdfState.currentPage = pageNum
  } catch (e) {
    message.error('页面渲染失败：' + e.message)
  } finally {
    pdfState.rendering = false
  }
}

async function changePage(delta) {
  const next = pdfState.currentPage + delta
  if (next < 1 || next > pdfState.totalPages) return
  await renderPage(next)
}

const jumpPage = ref(1)
async function handleJump() {
  const target = Math.round(jumpPage.value)
  if (!target || target < 1 || target > pdfState.totalPages) return
  await renderPage(target)
}

function downloadSnapshot() {
  if (!pdfCanvas.value) return
  const canvas = pdfCanvas.value
  const dataUrl = canvas.toDataURL('image/png')
  const filename = `${pdfState.filename.replace(/\.pdf$/i, '')}_第${pdfState.currentPage}页.png`
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

function closePdf() {
  pdfState.visible = false
  _pdfDoc = null
}

onMounted(loadDetail)

onBeforeUnmount(() => {
  if (_pdfDoc) {
    _pdfDoc.destroy().catch(() => {})
    _pdfDoc = null
  }
})
</script>

<style scoped>
.regular-product-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.disk-path-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.disk-path-code {
  font-family: monospace;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
  color: #333;
}

.text-gray {
  color: #aaa;
}

/* 笔记标题高亮预览 */
.note-title-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #fffbe6;
  border-left: 3px solid #faad14;
  padding: 8px 12px;
  border-radius: 4px;
}
.note-title-text {
  flex: 1;
  color: #333;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Drawer 正文 */
.drawer-note-content {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.9;
  color: #222;
  margin: 0;
}

/* 文件树 */
.file-browser-section {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 颜色选择器 */
.color-picker-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 400;
  color: #555;
  cursor: pointer;
  padding: 2px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fafafa;
  user-select: none;
}
.color-picker-label:hover {
  border-color: #1677ff;
  color: #1677ff;
}
.color-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  flex-shrink: 0;
}
.color-input {
  width: 0;
  height: 0;
  opacity: 0;
  position: absolute;
  pointer-events: none;
}

.empty-tip {
  color: #aaa;
  text-align: center;
  padding: 24px 0;
}

.tree-node-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.node-dir-img-btn {
  opacity: 0;
  transition: opacity 0.15s;
  font-size: 13px;
  padding: 0 4px;
  height: 20px;
  line-height: 20px;
  flex-shrink: 0;
}

.tree-node-row:hover .node-dir-img-btn {
  opacity: 1;
}

.tree-icon {
  font-style: normal;
  margin-right: 4px;
}

.pdf-icon {
  color: #e63946;
}

.pdf-node {
  cursor: pointer;
  color: #e63946;
}

.pdf-node:hover {
  text-decoration: underline;
}

/* PDF 预览 */
.pdf-section {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
}

.pdf-error {
  color: #e63946;
  padding: 12px 0;
}

.pdf-viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.jump-label {
  font-size: 13px;
  color: #555;
  margin-left: 8px;
}

.page-info {
  font-size: 14px;
  color: #555;
  min-width: 120px;
  text-align: center;
}

.canvas-wrapper {
  width: 100%;
  overflow-x: auto;
  display: flex;
  justify-content: center;
}

.pdf-canvas {
  max-width: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}
</style>
