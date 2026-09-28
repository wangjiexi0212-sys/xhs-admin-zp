<template>
  <div class="counselor-product-detail">
    <!-- 头部操作栏 -->
    <div class="page-header">
      <a-button @click="$router.back()" style="margin-right: 12px">← 返回</a-button>
      <h2 class="page-title">高校岗位详情</h2>
      <a-button type="primary" style="margin-left: auto" @click="$router.push(`/counselor-product/edit/${id}`)">编辑</a-button>
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

        <!-- <AiContentCenter v-if="id" :product-id="id" :disk-path="product.disk_path" /> -->

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
            <a-badge :count="pdfImageList.length" :offset="[-4, 4]" style="margin-left: auto">
              <a-button size="small" type="primary" @click="imageListDrawerOpen = true">🖼 图片列表</a-button>
            </a-badge>
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
                <a-button
                  size="small"
                  :disabled="pdfState.rendering"
                  @click="addCurrentPageToList"
                >➕ 添加到列表</a-button>
                <a-divider type="vertical" style="height:20px" />
                <a-switch
                  v-model:checked="autoMosaicEnabled"
                  size="small"
                  :disabled="pdfState.rendering"
                  @change="rerenderCurrentPdfPage"
                />
                <span class="auto-mosaic-label">自动遮盖敏感词</span>
                <span v-if="ocrMosaicLoading" class="ocr-mosaic-status">OCR识别中...</span>
                <a-tooltip v-if="autoMosaicEnabled" title="切换后会重新渲染当前页，下载和添加到列表都会使用打码后的图片">
                  <span class="auto-mosaic-help">(?)</span>
                </a-tooltip>
                <a-divider type="vertical" style="height:20px" />
                <a-button
                  :type="manualMosaicEnabled ? 'primary' : 'default'"
                  size="small"
                  :disabled="pdfState.rendering || !pdfCanvas"
                  @click="toggleManualMosaic"
                >手动打码{{ manualMosaicEnabled ? '（开启）' : '' }}</a-button>
                <template v-if="manualMosaicEnabled">
                  <span class="manual-mosaic-label">笔触</span>
                  <input
                    v-model.number="manualMosaicBlockSize"
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    class="manual-mosaic-range"
                  />
                  <span class="manual-mosaic-size">{{ manualMosaicBlockSize }}px</span>
                </template>
                <a-button
                  v-if="manualMosaicHasPaint"
                  size="small"
                  danger
                  :disabled="pdfState.rendering"
                  @click="clearManualMosaic"
                >清除手动打码</a-button>
                <a-divider type="vertical" style="height:20px" />
                <a-textarea
                  v-model:value="pdfTextOverlay.text"
                  placeholder="输入叠加文字"
                  size="small"
                  class="pdf-text-input"
                  :auto-size="{ minRows: 1, maxRows: 3 }"
                  allow-clear
                  @change="redrawPdfTextOverlay"
                />
                <input v-model="pdfTextOverlay.color" type="color" class="pdf-text-color" title="字体颜色" @input="redrawPdfTextOverlay" />
                <a-select
                  v-model:value="pdfTextOverlay.style"
                  size="small"
                  class="pdf-text-style"
                  @change="redrawPdfTextOverlay"
                >
                  <a-select-option value="sticker">贴纸字</a-select-option>
                  <a-select-option value="shadow">阴影字</a-select-option>
                  <a-select-option value="stroke">描边字</a-select-option>
                  <a-select-option value="gradient">渐变字</a-select-option>
                  <a-select-option value="stamp">印章字</a-select-option>
                </a-select>
                <span class="pdf-text-control-label">字号</span>
                <input v-model.number="pdfTextOverlay.size" type="range" min="24" max="96" step="2" class="pdf-text-range" @input="redrawPdfTextOverlay" />
                <span class="pdf-text-control-label">X</span>
                <input v-model.number="pdfTextOverlay.x" type="range" min="0" max="100" step="1" class="pdf-text-range" @input="redrawPdfTextOverlay" />
                <span class="pdf-text-control-label">Y</span>
                <input v-model.number="pdfTextOverlay.y" type="range" min="0" max="100" step="1" class="pdf-text-range" @input="redrawPdfTextOverlay" />
                <a-button size="small" type="primary" :disabled="pdfState.rendering || !pdfTextOverlay.text.trim()" @click="applyPdfTextOverlay">应用文字</a-button>
                <a-button v-if="pdfTextOverlay.visible" size="small" danger :disabled="pdfState.rendering" @click="clearPdfTextOverlay">清除文字</a-button>
              </div>
              <!-- 画布 -->
              <div class="canvas-wrapper">
                <canvas
                  ref="pdfCanvas"
                  class="pdf-canvas"
                  :class="{
                    'pdf-canvas-mosaic': manualMosaicEnabled,
                    'pdf-canvas-text-draggable': !manualMosaicEnabled && pdfTextOverlay.visible
                  }"
                  @mousedown="onPdfCanvasMouseDown"
                  @mousemove="onPdfCanvasMouseMove"
                  @mouseup="onPdfCanvasMouseUp"
                  @mouseleave="onPdfCanvasMouseUp"
                ></canvas>
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

    <!-- 图片列表 & AI 二创 Drawer -->
    <a-drawer
      v-model:open="imageListDrawerOpen"
      title="图片列表 & AI 二创"
      placement="right"
      :width="540"
      :body-style="{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }"
    >
      <!-- 空状态 -->
      <a-empty
        v-if="!pdfImageList.length && !pdfAiImages.length"
        description="暂无图片，请在 PDF 预览中点击「添加到列表」"
        style="padding: 40px 0"
      />

      <!-- 图片列表 -->
      <template v-if="pdfImageList.length">
        <div class="ai-drawer-section-title">📷 已添加图片（{{ pdfImageList.length }} 张）</div>
        <div class="pdf-list-grid">
          <div v-for="item in pdfImageList" :key="item.id" class="pdf-list-item">
            <img
              :src="item.dataUrl"
              class="pdf-list-thumb"
              style="cursor:zoom-in"
              @click="previewDrawerImg(item.dataUrl)"
            />
            <div class="pdf-list-name">{{ item.filename }}</div>
            <a-button
              danger
              size="small"
              class="pdf-list-del"
              title="从列表中删除"
              @click="removeFromImageList(item.id)"
            >
              <DeleteOutlined />
            </a-button>
          </div>
        </div>

        <!-- AI 二创配置 -->
        <a-divider style="margin: 4px 0" />
        <div class="ai-drawer-section-title">✨ AI 二创配置</div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <a-switch v-model:checked="pdfAiTextRewrite" size="small" />
          <span style="font-size:13px; color:#555">图片文字二创</span>
        </div>
        <a-textarea
          v-model:value="pdfAiCustomPrompt"
          placeholder="自定义提示词（留空则使用默认风格：小红书清新自然重绘）"
          :rows="3"
          :maxlength="500"
          show-count
          allow-clear
        />
        <a-button
          type="primary"
          block
          :loading="pdfAiGenerating"
          :disabled="pdfAiGenerating"
          @click="startPdfAiRewrite"
        >
          <ThunderboltOutlined /> AI 二创全部图片（{{ pdfImageList.length }} 张）
        </a-button>
      </template>

      <!-- AI 二创结果 -->
      <template v-if="pdfAiImages.length">
        <a-divider style="margin: 4px 0" />
        <div class="ai-drawer-section-title">
          🎨 二创结果（{{ pdfAiImages.filter(i => i.status === 'done').length }} / {{ pdfAiImages.length }} 张完成）
        </div>
        <div class="pdf-list-grid">
          <div v-for="(img, ii) in pdfAiImages" :key="img.id" class="pdf-list-item">
            <!-- 排队 / 生成中 -->
            <div v-if="img.status === 'pending' || img.status === 'running'" class="pdf-ai-placeholder">
              <a-spin size="small" />
              <span>{{ img.status === 'pending' ? '排队中' : '生成中…' }}</span>
            </div>
            <!-- 失败 -->
            <div v-else-if="img.status === 'error'" class="pdf-ai-error">
              <ExclamationCircleOutlined style="font-size:18px" />
              <span>{{ img.errMsg || '生成失败' }}</span>
              <a-button size="small" @click="retryPdfAiImage(img)">
                <ReloadOutlined /> 重试
              </a-button>
            </div>
            <!-- 完成 -->
            <template v-else>
              <img
                :src="img.url"
                class="pdf-list-thumb"
                style="cursor:zoom-in"
                @click="previewDrawerImg(img.url)"
              />
              <div class="pdf-list-name">{{ img.filename }}</div>
              <a-button
                size="small"
                type="primary"
                ghost
                :loading="img.downloading"
                @click="downloadPdfAiImage(img, ii)"
              >
                <DownloadOutlined /> 下载
              </a-button>
            </template>
          </div>
        </div>
        <a-button
          v-if="pdfAiImages.some(i => i.status === 'done')"
          block
          :loading="pdfAiBatchDownloading"
          :disabled="pdfAiBatchDownloading"
          style="margin-top: 4px"
          @click="downloadAllPdfAiImages"
        >
          <DownloadOutlined /> 一键下载全部 AI 图（{{ pdfAiImages.filter(i => i.status === 'done').length }} 张）
        </a-button>
      </template>
    </a-drawer>

    <!-- 大图预览 Modal（抽屉内图片点击） -->
    <a-modal
      v-model:open="drawerPreviewImg.visible"
      :footer="null"
      :body-style="{ padding: 0, lineHeight: 0, background: '#000' }"
      centered
      width="auto"
    >
      <img
        v-if="drawerPreviewImg.visible"
        :src="drawerPreviewImg.url"
        style="max-width:90vw; max-height:90vh; display:block; object-fit:contain"
      />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DeleteOutlined, ThunderboltOutlined, DownloadOutlined,
  ExclamationCircleOutlined, ReloadOutlined,
} from '@ant-design/icons-vue'
import { getCounselorProductDetail } from '@/api/counselorProducts'
import { request, getToken } from '@/api/request'
import { rewriteImage, proxyImageForDownload, getSensitiveOcrBoxes } from '@/api/xhsRewrite'
import { processImageForDownload, triggerBlobDownload } from '@/utils/imageProcess'
import AiContentCenter from './components/AiContentCenter.vue'

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
    product.value = await getCounselorProductDetail(id.value)
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

// ── PDF 敏感词自动打码 ─────────────────────────────────────
const SENSITIVE_WORD_LIST = [
  '习近平', '毛泽东', '邓小平', '江泽民', '胡锦涛', '李克强',
  '赵乐际', '王沪宁', '丁薛祥', '李希',
  '中国共产党', '中共中央', '党中央', '中央', '共产党', '政治局', '总书记',
  '国家主席', '国家副主席', '中央军委', '人民解放军', '武警部队',
  '国务院', '全国人大', '全国政协', '人民代表大会', '人民代表',
  '中华人民共和国', '共和国', '中国', '中华民族', '中华', '政府', '党', '宪法',
  '社会主义', '全会', '国家', '法律', '法规', '政治',
]
const autoMosaicEnabled = ref(true)
const ocrMosaicLoading = ref(false)
const manualMosaicEnabled = ref(false)
const manualMosaicBlockSize = ref(10)
const manualMosaicHasPaint = ref(false)
let manualMosaicDrawing = false
let manualMosaicBaseDataUrl = ''

const pdfTextOverlay = reactive({
  text: '',
  color: '#ff2d55',
  style: 'sticker',
  size: 48,
  x: 50,
  y: 14,
  visible: false,
})
let pdfTextOverlayBaseDataUrl = ''
let pdfTextOverlayDragging = false
let pdfTextOverlayDragOffset = { x: 0, y: 0 }

function _findSensitiveRanges(text) {
  const ranges = []
  for (const word of SENSITIVE_WORD_LIST) {
    let from = 0
    while (true) {
      const start = text.indexOf(word, from)
      if (start < 0) break
      ranges.push({ start, end: start + word.length })
      from = start + 1
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const merged = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

function _findSensitiveRangesInChars(chars) {
  const normalizedChars = []
  const originalIndexes = []
  chars.forEach((char, index) => {
    if (/[\s\u200B-\u200D\uFEFF·•・、,，.。;；:：\-_/\\|()[\]{}<>《》【】"'“”‘’]+/.test(char.ch)) return
    normalizedChars.push(char.ch)
    originalIndexes.push(index)
  })

  return _findSensitiveRanges(normalizedChars.join('')).map(range => ({
    start: originalIndexes[range.start],
    end: originalIndexes[range.end - 1] + 1,
  })).filter(range => Number.isInteger(range.start) && Number.isInteger(range.end))
}

async function applyPdfSensitiveMosaic(canvas, page, viewport) {
  if (!autoMosaicEnabled.value) return 0
  let textContent
  try {
    textContent = await page.getTextContent()
  } catch {
    return 0
  }

  const ctx = canvas.getContext('2d')
  const CW = canvas.width
  const CH = canvas.height
  const BLOCK = 20
  const pdfjs = pdfjsLib || window.pdfjsLib
  const transform = pdfjs?.Util?.transform
    ? (a, b) => pdfjs.Util.transform(a, b)
    : ((a, b) => [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5],
      ])

  const items = textContent.items.filter(item => item.str).map(item => {
    const textMatrix = transform(viewport.transform, item.transform)
    const fontSizePx = Math.hypot(textMatrix[2], textMatrix[3]) || Math.hypot(textMatrix[0], textMatrix[1])
    const widthPx = Math.max((item.width || 0) * viewport.scale, fontSizePx * 0.6 * item.str.length)
    return {
      str: item.str,
      cx: textMatrix[4],
      cy: textMatrix[5],
      widthPx,
      fontSizePx,
    }
  })

  const lines = []
  for (const item of items) {
    let line = lines.find(row => Math.abs(row.baseCy - item.cy) <= 8)
    if (!line) {
      line = { baseCy: item.cy, cySum: item.cy, cyCount: 1, items: [] }
      lines.push(line)
    } else {
      line.cySum += item.cy
      line.cyCount += 1
      line.baseCy = line.cySum / line.cyCount
    }
    line.items.push(item)
  }

  let hitCount = 0
  for (const line of lines) {
    line.items.sort((a, b) => a.cx - b.cx)
    const chars = []
    for (const item of line.items) {
      const count = item.str.length || 1
      for (let i = 0; i < item.str.length; i++) {
        chars.push({
          ch: item.str[i],
          x0: item.cx + i / count * item.widthPx,
          x1: item.cx + (i + 1) / count * item.widthPx,
          fontSizePx: item.fontSizePx,
        })
      }
    }
    const ranges = _findSensitiveRangesInChars(chars)
    for (const { start, end } of ranges) {
      if (end > chars.length) continue
      const rx = Math.floor(chars[start].x0) - 3
      const rx1 = Math.ceil(chars[end - 1].x1) + 3
      const fontHeight = chars[start].fontSizePx
      const ry = Math.floor(line.baseCy - fontHeight * 1.05) - 3
      const rh = Math.ceil(fontHeight * 1.4) + 6
      const x0 = Math.max(0, rx)
      const y0 = Math.max(0, ry)
      const x1 = Math.min(CW, rx1)
      const y1 = Math.min(CH, ry + rh)
      for (let by = y0; by < y1; by += BLOCK) {
        for (let bx = x0; bx < x1; bx += BLOCK) {
          const bw = Math.min(BLOCK, x1 - bx)
          const bh = Math.min(BLOCK, y1 - by)
          if (bw <= 0 || bh <= 0) continue
          const px = ctx.getImageData(
            Math.min(bx + (bw >> 1), CW - 1),
            Math.min(by + (bh >> 1), CH - 1),
            1,
            1
          ).data
          ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
          ctx.fillRect(bx, by, bw, bh)
        }
      }
      hitCount += 1
    }
  }
  return hitCount
}

function applyNormalizedMosaicBoxes(canvas, boxes, blockSize = 20) {
  if (!Array.isArray(boxes) || !boxes.length) return 0
  const ctx = canvas.getContext('2d')
  const CW = canvas.width
  const CH = canvas.height
  let count = 0
  for (const box of boxes) {
    const rx = Math.floor(Number(box.x || 0) * CW) - 4
    const ry = Math.floor(Number(box.y || 0) * CH) - 4
    const rw = Math.ceil(Number(box.w || 0) * CW) + 8
    const rh = Math.ceil(Number(box.h || 0) * CH) + 8
    const x0 = Math.max(0, rx)
    const y0 = Math.max(0, ry)
    const x1 = Math.min(CW, rx + rw)
    const y1 = Math.min(CH, ry + rh)
    if (x1 <= x0 || y1 <= y0) continue
    for (let by = y0; by < y1; by += blockSize) {
      for (let bx = x0; bx < x1; bx += blockSize) {
        const bw = Math.min(blockSize, x1 - bx)
        const bh = Math.min(blockSize, y1 - by)
        if (bw <= 0 || bh <= 0) continue
        const px = ctx.getImageData(
          Math.min(bx + (bw >> 1), CW - 1),
          Math.min(by + (bh >> 1), CH - 1),
          1,
          1
        ).data
        ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
        ctx.fillRect(bx, by, bw, bh)
      }
    }
    count += 1
  }
  return count
}

async function applyOcrSensitiveMosaicFallback(canvas) {
  if (!autoMosaicEnabled.value || ocrMosaicLoading.value) return 0
  ocrMosaicLoading.value = true
  try {
    const dataUrl = canvas.toDataURL('image/png')
    const uploaded = await _uploadDataUrlToR2(dataUrl)
    const res = await getSensitiveOcrBoxes({
      image_url: uploaded.url,
      sensitive_words: SENSITIVE_WORD_LIST,
    })
    return applyNormalizedMosaicBoxes(canvas, res?.boxes || [], 20)
  } catch (e) {
    console.warn('OCR 敏感词打码失败', e)
    return 0
  } finally {
    ocrMosaicLoading.value = false
  }
}

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
    manualMosaicDrawing = false
    manualMosaicHasPaint.value = false
    manualMosaicBaseDataUrl = ''
    pdfTextOverlay.visible = false
    pdfTextOverlayBaseDataUrl = ''
    const page = await _pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = pdfCanvas.value
    const ctx = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    const pdfTextHitCount = await applyPdfSensitiveMosaic(canvas, page, viewport)
    if (autoMosaicEnabled.value && pdfTextHitCount === 0) {
      await applyOcrSensitiveMosaicFallback(canvas)
    }
    manualMosaicBaseDataUrl = canvas.toDataURL('image/png')
    pdfState.currentPage = pageNum
  } catch (e) {
    message.error('页面渲染失败：' + e.message)
  } finally {
    pdfState.rendering = false
  }
}

async function rerenderCurrentPdfPage() {
  if (!_pdfDoc || !pdfCanvas.value || pdfState.rendering) return
  await renderPage(pdfState.currentPage)
}

function toggleManualMosaic() {
  manualMosaicEnabled.value = !manualMosaicEnabled.value
  if (!manualMosaicEnabled.value) manualMosaicDrawing = false
}

function getManualMosaicPoint(event) {
  const canvas = pdfCanvas.value
  if (!canvas || !manualMosaicEnabled.value || pdfState.rendering) return null
  return getPdfCanvasPoint(event)
}

function getPdfCanvasPoint(event) {
  const canvas = pdfCanvas.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: Math.round((event.clientX - rect.left) * canvas.width / rect.width),
    y: Math.round((event.clientY - rect.top) * canvas.height / rect.height),
  }
}

function applyManualMosaicAt(x, y) {
  const canvas = pdfCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const block = manualMosaicBlockSize.value
  const radius = block * 2
  const x0 = Math.max(0, Math.floor((x - radius) / block) * block)
  const y0 = Math.max(0, Math.floor((y - radius) / block) * block)
  const x1 = Math.min(canvas.width, Math.ceil((x + radius) / block) * block)
  const y1 = Math.min(canvas.height, Math.ceil((y + radius) / block) * block)

  for (let by = y0; by < y1; by += block) {
    for (let bx = x0; bx < x1; bx += block) {
      const bw = Math.min(block, canvas.width - bx)
      const bh = Math.min(block, canvas.height - by)
      if (bw <= 0 || bh <= 0) continue
      const px = ctx.getImageData(
        Math.min(bx + (bw >> 1), canvas.width - 1),
        Math.min(by + (bh >> 1), canvas.height - 1),
        1,
        1
      ).data
      ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
      ctx.fillRect(bx, by, bw, bh)
    }
  }
  manualMosaicHasPaint.value = true
}

function onManualMosaicStart(event) {
  const point = getManualMosaicPoint(event)
  if (!point) return
  event.preventDefault()
  manualMosaicDrawing = true
  applyManualMosaicAt(point.x, point.y)
}

function onManualMosaicMove(event) {
  if (!manualMosaicDrawing) return
  const point = getManualMosaicPoint(event)
  if (!point) return
  event.preventDefault()
  applyManualMosaicAt(point.x, point.y)
}

function onManualMosaicEnd() {
  manualMosaicDrawing = false
}

function onPdfCanvasMouseDown(event) {
  if (manualMosaicEnabled.value) {
    onManualMosaicStart(event)
    return
  }
  startPdfTextOverlayDrag(event)
}

function onPdfCanvasMouseMove(event) {
  if (manualMosaicEnabled.value) {
    onManualMosaicMove(event)
    return
  }
  movePdfTextOverlayDrag(event)
}

function onPdfCanvasMouseUp() {
  onManualMosaicEnd()
  pdfTextOverlayDragging = false
}

function clearManualMosaic() {
  if (!manualMosaicBaseDataUrl || !pdfCanvas.value) return
  const img = new Image()
  img.onload = () => {
    const canvas = pdfCanvas.value
    if (!canvas) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    manualMosaicHasPaint.value = false
    manualMosaicDrawing = false
  }
  img.src = manualMosaicBaseDataUrl
}

function _roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawPdfTextOverlayOnCanvas() {
  const canvas = pdfCanvas.value
  const text = pdfTextOverlay.text.trim()
  if (!canvas || !text) return
  const ctx = canvas.getContext('2d')
  const fontSize = pdfTextOverlay.size
  const color = pdfTextOverlay.color
  const x = canvas.width * pdfTextOverlay.x / 100
  const y = canvas.height * pdfTextOverlay.y / 100
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
  const layout = getPdfTextOverlayLayout(ctx)
  if (!layout) { ctx.restore(); return }
  const { lines, lineHeight, textHeight, tw } = layout

  const drawLines = (draw) => {
    const firstY = y - (textHeight - lineHeight) / 2
    lines.forEach((line, index) => draw(line, x, firstY + index * lineHeight))
  }

  if (pdfTextOverlay.style === 'sticker') {
    const padX = fontSize * 0.6
    const padY = fontSize * 0.38
    ctx.shadowColor = 'rgba(0,0,0,0.2)'
    ctx.shadowBlur = fontSize * 0.16
    ctx.shadowOffsetY = fontSize * 0.08
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    _roundRectPath(ctx, x - tw / 2 - padX, y - textHeight / 2 - padY, tw + padX * 2, textHeight + padY * 2, fontSize * 0.35)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = Math.max(4, fontSize * 0.08)
    ctx.strokeStyle = '#ffffff'
    drawLines((line, tx, ty) => ctx.strokeText(line, tx, ty))
    ctx.fillStyle = color
    drawLines((line, tx, ty) => ctx.fillText(line, tx, ty))
  } else if (pdfTextOverlay.style === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = fontSize * 0.14
    ctx.shadowOffsetX = fontSize * 0.08
    ctx.shadowOffsetY = fontSize * 0.1
    ctx.fillStyle = color
    drawLines((line, tx, ty) => ctx.fillText(line, tx, ty))
  } else if (pdfTextOverlay.style === 'stroke') {
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(6, fontSize * 0.13)
    ctx.strokeStyle = '#111827'
    drawLines((line, tx, ty) => ctx.strokeText(line, tx, ty))
    ctx.lineWidth = Math.max(3, fontSize * 0.06)
    ctx.strokeStyle = '#ffffff'
    drawLines((line, tx, ty) => ctx.strokeText(line, tx, ty))
    ctx.fillStyle = color
    drawLines((line, tx, ty) => ctx.fillText(line, tx, ty))
  } else if (pdfTextOverlay.style === 'gradient') {
    const grad = ctx.createLinearGradient(x - tw / 2, y - textHeight / 2, x + tw / 2, y + textHeight / 2)
    grad.addColorStop(0, color)
    grad.addColorStop(0.5, '#ffdd00')
    grad.addColorStop(1, '#7c3aed')
    ctx.lineWidth = Math.max(5, fontSize * 0.1)
    ctx.strokeStyle = '#ffffff'
    drawLines((line, tx, ty) => ctx.strokeText(line, tx, ty))
    ctx.fillStyle = grad
    drawLines((line, tx, ty) => ctx.fillText(line, tx, ty))
  } else if (pdfTextOverlay.style === 'stamp') {
    const padX = fontSize * 0.5
    const padY = fontSize * 0.32
    const bx = x - tw / 2 - padX
    const by = y - textHeight / 2 - padY
    const bw = tw + padX * 2
    const bh = textHeight + padY * 2
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(4, fontSize * 0.07)
    _roundRectPath(ctx, bx, by, bw, bh, fontSize * 0.12)
    ctx.stroke()
    ctx.lineWidth = Math.max(2, fontSize * 0.035)
    _roundRectPath(ctx, bx + fontSize * 0.12, by + fontSize * 0.12, bw - fontSize * 0.24, bh - fontSize * 0.24, fontSize * 0.08)
    ctx.stroke()
    ctx.fillStyle = color
    drawLines((line, tx, ty) => ctx.fillText(line, tx, ty))
  }
  ctx.restore()
}

function getPdfTextOverlayLayout(ctx) {
  const text = pdfTextOverlay.text.trim()
  if (!text) return null
  const fontSize = pdfTextOverlay.size
  ctx.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) return null
  const lineHeight = fontSize * 1.18
  const textHeight = lineHeight * lines.length
  const tw = Math.max(...lines.map(line => ctx.measureText(line).width))
  let padX = fontSize * 0.25
  let padY = fontSize * 0.25
  if (pdfTextOverlay.style === 'sticker') {
    padX = fontSize * 0.6
    padY = fontSize * 0.38
  } else if (pdfTextOverlay.style === 'stamp') {
    padX = fontSize * 0.5
    padY = fontSize * 0.32
  } else if (pdfTextOverlay.style === 'stroke' || pdfTextOverlay.style === 'gradient') {
    padX = fontSize * 0.35
    padY = fontSize * 0.3
  }
  const x = ctx.canvas.width * pdfTextOverlay.x / 100
  const y = ctx.canvas.height * pdfTextOverlay.y / 100
  return {
    lines,
    lineHeight,
    textHeight,
    tw,
    x,
    y,
    left: x - tw / 2 - padX,
    right: x + tw / 2 + padX,
    top: y - textHeight / 2 - padY,
    bottom: y + textHeight / 2 + padY,
  }
}

function isPointInPdfTextOverlay(point) {
  const canvas = pdfCanvas.value
  if (!canvas || !pdfTextOverlay.visible || !pdfTextOverlay.text.trim() || !point) return false
  const ctx = canvas.getContext('2d')
  const layout = getPdfTextOverlayLayout(ctx)
  if (!layout) return false
  return point.x >= layout.left && point.x <= layout.right && point.y >= layout.top && point.y <= layout.bottom
}

function startPdfTextOverlayDrag(event) {
  const point = getPdfCanvasPoint(event)
  if (!isPointInPdfTextOverlay(point)) return
  event.preventDefault()
  const canvas = pdfCanvas.value
  pdfTextOverlayDragging = true
  pdfTextOverlayDragOffset = {
    x: point.x - canvas.width * pdfTextOverlay.x / 100,
    y: point.y - canvas.height * pdfTextOverlay.y / 100,
  }
}

function movePdfTextOverlayDrag(event) {
  if (!pdfTextOverlayDragging || pdfState.rendering) return
  const point = getPdfCanvasPoint(event)
  const canvas = pdfCanvas.value
  if (!point || !canvas) return
  event.preventDefault()
  pdfTextOverlay.x = Math.max(0, Math.min(100, ((point.x - pdfTextOverlayDragOffset.x) / canvas.width) * 100))
  pdfTextOverlay.y = Math.max(0, Math.min(100, ((point.y - pdfTextOverlayDragOffset.y) / canvas.height) * 100))
  redrawPdfTextOverlay()
}

function restoreCanvasFromDataUrl(dataUrl, afterDraw) {
  const canvas = pdfCanvas.value
  if (!canvas || !dataUrl) return
  const img = new Image()
  img.onload = () => {
    const currentCanvas = pdfCanvas.value
    if (!currentCanvas) return
    currentCanvas.width = img.naturalWidth
    currentCanvas.height = img.naturalHeight
    currentCanvas.getContext('2d').drawImage(img, 0, 0)
    afterDraw?.()
  }
  img.src = dataUrl
}

function applyPdfTextOverlay() {
  if (!pdfCanvas.value || !pdfTextOverlay.text.trim()) return
  if (!pdfTextOverlay.visible) {
    pdfTextOverlayBaseDataUrl = pdfCanvas.value.toDataURL('image/png')
  }
  pdfTextOverlay.visible = true
  restoreCanvasFromDataUrl(pdfTextOverlayBaseDataUrl, drawPdfTextOverlayOnCanvas)
}

function redrawPdfTextOverlay() {
  if (!pdfTextOverlay.visible || !pdfTextOverlayBaseDataUrl) return
  if (!pdfTextOverlay.text.trim()) {
    clearPdfTextOverlay()
    return
  }
  restoreCanvasFromDataUrl(pdfTextOverlayBaseDataUrl, drawPdfTextOverlayOnCanvas)
}

function clearPdfTextOverlay() {
  if (!pdfTextOverlayBaseDataUrl) return
  restoreCanvasFromDataUrl(pdfTextOverlayBaseDataUrl, () => {
    pdfTextOverlay.visible = false
    pdfTextOverlayBaseDataUrl = ''
  })
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

// ── 图片收集列表 & AI 二创侧边抽屉 ──────────────────────────
let _listImgId = 0
const pdfImageList = ref([])          // [{ id, dataUrl, filename }]
const imageListDrawerOpen = ref(false)

// AI 二创状态
const pdfAiImages = ref([])           // [{ id, src, filename, url, status, downloading, errMsg, publicSrc }]
const pdfAiGenerating = ref(false)
const pdfAiBatchDownloading = ref(false)
const pdfAiTextRewrite = ref(false)
const pdfAiCustomPrompt = ref('')

// 大图预览（抽屉内）
const drawerPreviewImg = reactive({ visible: false, url: '' })
function previewDrawerImg(url) { drawerPreviewImg.url = url; drawerPreviewImg.visible = true }

/** 把当前 PDF 页追加到图片列表，并打开抽屉 */
function addCurrentPageToList() {
  if (!pdfCanvas.value || pdfState.rendering) return
  const dataUrl = pdfCanvas.value.toDataURL('image/png')
  const filename = `${pdfState.filename.replace(/\.pdf$/i, '')}_第${pdfState.currentPage}页.png`
  pdfImageList.value.push({ id: ++_listImgId, dataUrl, filename })
  pdfAiImages.value = []   // 列表变化时清空旧二创结果
  message.success(`已添加第 ${pdfState.currentPage} 页（共 ${pdfImageList.value.length} 张）`)
  imageListDrawerOpen.value = true
}

/** 从图片列表中删除一张 */
function removeFromImageList(id) {
  pdfImageList.value = pdfImageList.value.filter(i => i.id !== id)
  pdfAiImages.value = []
}

/** 上传 canvas dataUrl 到 R2，返回 { url } */
async function _uploadDataUrlToR2(dataUrl) {
  return request('/api/xhs-rewrite/upload-image', {
    method: 'POST',
    body: { dataUrl, mimeType: 'image/png' },
  })
}

const PDF_AI_TEXT_REWRITE_PROMPT = '保持图片整体构图和主体内容不变，对图片中出现的所有覆盖文字进行改写，更换措辞和表达方式，文字风格与原图保持一致，其余内容轻度重绘，风格清新自然，适合小红书发布。'

/** 并发受限执行器（复用 Rewrite.vue 相同实现） */
function runConcurrent(items, fn, limit = 3) {
  const queue = [...items]
  let active = 0
  return new Promise((resolve) => {
    function pump() {
      while (active < limit && queue.length) {
        active++
        const item = queue.shift()
        fn(item).finally(() => {
          active--
          if (queue.length > 0) pump()
          else if (active === 0) resolve()
        })
      }
      if (active === 0 && queue.length === 0) resolve()
    }
    pump()
  })
}

/** 对单张 imgObj 执行 AI 二创（上传 R2 → 调 AI 绘图） */
async function _doPdfAiOne(imgObj) {
  imgObj.status = 'running'
  imgObj.url = ''
  try {
    let publicSrc = imgObj.publicSrc
    if (!publicSrc) {
      const res = await _uploadDataUrlToR2(imgObj.src)
      publicSrc = res.url
      imgObj.publicSrc = publicSrc
    }
    const imagePrompt = pdfAiCustomPrompt.value.trim()
      || (pdfAiTextRewrite.value ? PDF_AI_TEXT_REWRITE_PROMPT : '')
    const res = await rewriteImage({ src: publicSrc, prompt: '', image_prompt: imagePrompt })
    imgObj.url = res.url
    imgObj.status = 'done'
  } catch (e) {
    imgObj.status = 'error'
    imgObj.errMsg = e.message || '绘图失败'
  }
}

/** 对图片列表全部图片发起 AI 二创 */
async function startPdfAiRewrite() {
  if (!pdfImageList.value.length) { message.warning('请先添加图片'); return }
  pdfAiGenerating.value = true

  pdfAiImages.value = pdfImageList.value.map(item => reactive({
    id: item.id,
    src: item.dataUrl,
    filename: item.filename,
    url: '',
    status: 'pending',
    downloading: false,
    errMsg: '',
    publicSrc: '',
  }))

  await runConcurrent(pdfAiImages.value, _doPdfAiOne, 3)

  pdfAiGenerating.value = false
  const done = pdfAiImages.value.filter(i => i.status === 'done').length
  message.success(`AI 二创完成：${done} / ${pdfAiImages.value.length} 张`)
}

/** 重试单张失败的 AI 二创 */
async function retryPdfAiImage(imgObj) {
  await _doPdfAiOne(imgObj)
}

/** 下载单张 AI 二创图片（与全能改写一致：去重指纹处理 + CORS 中转兜底） */
async function downloadPdfAiImage(img, idx) {
  if (img.downloading) return
  img.downloading = true
  try {
    let blob
    try {
      blob = await processImageForDownload(img.url)
    } catch {
      // AI CDN 不返回 CORS 头，先中转到 R2 再处理
      const proxied = await proxyImageForDownload(img.url)
      blob = await processImageForDownload(proxied.url)
    }
    triggerBlobDownload(blob, `ai_${img.filename || `ai_${idx + 1}.jpg`}`)
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    img.downloading = false
  }
}

/** 一键下载全部已完成的 AI 二创图片 */
async function downloadAllPdfAiImages() {
  const doneImgs = pdfAiImages.value.filter(i => i.status === 'done')
  if (!doneImgs.length) return
  pdfAiBatchDownloading.value = true
  const hide = message.loading(`下载 ${doneImgs.length} 张 AI 图中…`, 0)
  let ok = 0
  for (let i = 0; i < doneImgs.length; i++) {
    const img = doneImgs[i]
    img.downloading = true
    try {
      let blob
      try {
        blob = await processImageForDownload(img.url)
      } catch {
        const proxied = await proxyImageForDownload(img.url)
        blob = await processImageForDownload(proxied.url)
      }
      triggerBlobDownload(blob, `ai_${img.filename || `ai_${i + 1}.jpg`}`)
      ok++
      // 相邻下载间隔 600ms，避免浏览器弹窗被拦截
      if (i < doneImgs.length - 1) await new Promise(r => setTimeout(r, 600))
    } catch { /* 单张失败不中断 */ } finally {
      img.downloading = false
    }
  }
  hide()
  pdfAiBatchDownloading.value = false
  message.success(`已下载 ${ok} / ${doneImgs.length} 张（已处理去重指纹）`)
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
.counselor-product-detail {
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

.auto-mosaic-label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
}

.auto-mosaic-help {
  font-size: 12px;
  color: #1677ff;
  cursor: default;
  user-select: none;
}

.ocr-mosaic-status {
  font-size: 12px;
  color: #1677ff;
  white-space: nowrap;
}

.manual-mosaic-label,
.manual-mosaic-size {
  font-size: 12px;
  color: #555;
  white-space: nowrap;
}

.manual-mosaic-size {
  color: #999;
  min-width: 34px;
}

.manual-mosaic-range {
  width: 80px;
  accent-color: #1677ff;
  cursor: pointer;
}

.pdf-text-input {
  width: 180px;
}

.pdf-text-color {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.pdf-text-style {
  width: 92px;
}

.pdf-text-control-label {
  font-size: 12px;
  color: #555;
  white-space: nowrap;
}

.pdf-text-range {
  width: 72px;
  accent-color: #ff2d55;
  cursor: pointer;
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

.pdf-canvas-mosaic {
  cursor: crosshair;
}

.pdf-canvas-text-draggable {
  cursor: grab;
}

.pdf-canvas-text-draggable:active {
  cursor: grabbing;
}

/* ── 图片列表 & AI 二创抽屉 ───────────────────────────────── */
.ai-drawer-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.pdf-list-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.pdf-list-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 8px;
  position: relative;
  transition: box-shadow 0.15s;
}
.pdf-list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.pdf-list-thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ebebeb;
}

.pdf-list-name {
  font-size: 11px;
  color: #888;
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  width: 100%;
}

.pdf-list-del {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 0 4px;
  height: 22px;
  line-height: 22px;
}
.pdf-list-item:hover .pdf-list-del {
  opacity: 0.85;
}
.pdf-list-del:hover {
  opacity: 1 !important;
}

.pdf-ai-placeholder,
.pdf-ai-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 100px;
  color: #999;
  font-size: 12px;
  width: 100%;
  padding: 12px 0;
}
.pdf-ai-error {
  color: #e63946;
}
</style>
