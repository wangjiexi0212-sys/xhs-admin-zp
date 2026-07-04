<template>
  <div>
    <div class="toolbar">
      <span style="font-size:15px;font-weight:500;color:#222">组件列表</span>
    </div>

    <a-spin :spinning="loading">
      <div class="component-card" v-for="item in list" :key="item.id">
        <div class="component-header">
          <span class="component-name">{{ item.name }}</span>
        </div>
        <div class="component-body">
          <span style="font-size:13px;color:#555;white-space:nowrap;margin-right:8px">路径：</span>
          <a-input
            v-model:value="item._path"
            placeholder="请输入百度网盘路径"
            style="flex:1"
            allow-clear
          />
          <a-button :loading="item._saving" style="margin-left:8px" @click="save(item)">保存</a-button>
          <a-button
            type="primary"
            :loading="drawer.loading && drawer.componentId === item.id"
            style="margin-left:8px"
            :disabled="!item._path"
            @click="openDirDrawer(item)"
          >生成目录图</a-button>
        </div>
      </div>
    </a-spin>

    <!-- 目录图编辑抽屉 -->
    <a-drawer
      v-model:open="drawer.visible"
      title="目录图编辑"
      placement="right"
      :width="'95%'"
      :body-style="{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }"
    >
      <!-- 工具栏 -->
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-shrink:0; flex-wrap:wrap">
        <span style="font-size:13px;color:#555;white-space:nowrap">标题文案：</span>
        <a-input v-model:value="drawer.title" style="width:200px" @input="refreshPreview" />
        <span style="font-size:13px;color:#555;white-space:nowrap">边框颜色：</span>
        <input type="color" v-model="drawer.borderColor" @input="refreshPreview"
          style="width:40px;height:32px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;padding:2px" />
        <a-button @click="download" :disabled="!drawer.previewUrl">下载目录图</a-button>
        <a-button @click="downloadPdf" :disabled="!drawer.pdfPreviewUrl">下载PDF截图</a-button>
      </div>

      <!-- 两栏主区域 -->
      <div style="flex:1; display:flex; gap:16px; min-height:0; overflow:hidden">
        <!-- 左栏：合成图预览 -->
        <div style="width:60%; overflow:auto; display:flex; justify-content:center; align-items:flex-start; background:#f0f0f0; border-radius:8px; padding:20px">
          <a-spin v-if="drawer.loading" style="margin-top:60px" />
          <img
            v-else-if="drawer.previewUrl"
            :src="drawer.previewUrl"
            style="max-width:100%; box-shadow:0 4px 20px rgba(0,0,0,0.15); border-radius:4px; display:block"
          />
          <div v-else style="color:#999;margin-top:60px">暂无预览</div>
        </div>

        <!-- 右栏：PDF文件列表 + 截图预览 -->
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:10px">
          <div style="font-size:13px;font-weight:500;color:#333">
            PDF截图
            <span style="font-size:12px;color:#999;font-weight:400;margin-left:6px">（已随机选取，点击可切换）</span>
          </div>

          <div style="flex-shrink:0; max-height:200px; overflow-y:auto; border:1px solid #f0f0f0; border-radius:6px; background:#fafafa">
            <div
              v-for="f in drawer.files.filter(f => f.isdir === 0)"
              :key="f.fs_id"
              @click="pickPdf(f)"
              style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:13px; transition:background 0.15s"
              :style="{ background: drawer.pdfFsid === f.fs_id ? '#fff7e6' : '' }"
              @mouseenter="$event.currentTarget.style.background = drawer.pdfFsid === f.fs_id ? '#fff7e6' : '#f5f5f5'"
              @mouseleave="$event.currentTarget.style.background = drawer.pdfFsid === f.fs_id ? '#fff7e6' : ''"
            >
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:#333">📄 {{ f.name }}</span>
              <a-spin v-if="drawer.pdfLoading && drawer.pdfFsid === f.fs_id" size="small" style="margin-left:8px;flex-shrink:0" />
            </div>
            <div v-if="!drawer.files.filter(f => f.isdir === 0).length" style="padding:12px;color:#999;font-size:13px;text-align:center">无文件</div>
          </div>

          <div style="flex:1; overflow:auto; background:#f0f0f0; border-radius:8px; padding:12px; display:flex; justify-content:center; align-items:flex-start; min-height:0">
            <a-spin v-if="drawer.pdfLoading && !drawer.pdfPreviewUrl" style="margin-top:40px" />
            <img
              v-else-if="drawer.pdfPreviewUrl"
              :src="drawer.pdfPreviewUrl"
              style="max-width:100%; box-shadow:0 2px 12px rgba(0,0,0,0.12); border-radius:4px; display:block"
            />
            <div v-else style="color:#999;font-size:13px;margin-top:40px;text-align:center">点击上方文件截取随机一页</div>
          </div>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getComponents, updateComponent } from '@/api/components'
import { getBaiduFiles } from '@/api/baidu'
import { getToken } from '@/api/request'

const loading = ref(false)
const list = ref([])

const drawer = reactive({
  visible: false,
  componentId: null,
  title: '公共基础笔记',
  borderColor: '#F9863B',
  files: [],
  loading: false,
  previewUrl: '',
  pdfFsid: null,
  pdfLoading: false,
  pdfPreviewUrl: '',
  pdfPageDataUrl: '',
})

// ─── 数据加载 ────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await getComponents()
    list.value = (Array.isArray(data) ? data : []).map(item => ({
      ...item,
      _path: item.path || '',
      _saving: false,
    }))
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function save(item) {
  item._saving = true
  try {
    await updateComponent(item.id, item._path)
    item.path = item._path
    message.success('保存成功')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    item._saving = false
  }
}

// ─── 目录图生成 ───────────────────────────────────────────
async function openDirDrawer(item) {
  const path = (item._path || '').trim()
  if (!path) return

  drawer.componentId = item.id
  drawer.title = '公共基础笔记'
  drawer.borderColor = '#F9863B'
  drawer.files = []
  drawer.previewUrl = ''
  drawer.pdfPageDataUrl = ''
  drawer.pdfPreviewUrl = ''
  drawer.pdfFsid = null
  drawer.loading = true
  drawer.visible = true

  try {
    const res = await getBaiduFiles(path)
    const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
    if (!files.length) { message.warning('该目录下暂无文件'); return }
    drawer.files = files

    // 随机选一个 PDF
    const pdfs = files.filter(f => f.isdir === 0)
    if (!pdfs.length) { message.warning('该目录下无PDF文件'); return }
    const randomPdf = pdfs[Math.floor(Math.random() * pdfs.length)]

    await renderPdfRandomPage(randomPdf)
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    drawer.loading = false
  }
}

async function renderPdfRandomPage(file) {
  drawer.pdfFsid = file.fs_id
  drawer.pdfLoading = true
  try {
    const lib = await ensurePdfjs()
    const pdfDoc = await lib.getDocument({
      url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(file.path)}`,
      httpHeaders: { Authorization: `Bearer ${getToken()}` },
    }).promise

    const totalPages = pdfDoc.numPages
    const pageNum = Math.floor(Math.random() * totalPages) + 1
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2 })
    const pdfCanvas = document.createElement('canvas')
    pdfCanvas.width = viewport.width
    pdfCanvas.height = viewport.height
    await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise
    drawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
    drawer.pdfPreviewUrl = drawer.pdfPageDataUrl
    drawer.previewUrl = await buildPublicBasicComposite(drawer.pdfPageDataUrl, drawer.files, drawer.borderColor, drawer.title)
  } finally {
    drawer.pdfLoading = false
  }
}

// 点击文件列表切换 PDF（取随机页）
async function pickPdf(file) {
  if (drawer.pdfLoading) return
  await renderPdfRandomPage(file)
}

function refreshPreview() {
  if (!drawer.pdfPageDataUrl) return
  buildPublicBasicComposite(drawer.pdfPageDataUrl, drawer.files, drawer.borderColor, drawer.title)
    .then(url => { drawer.previewUrl = url })
}

function download() {
  if (!drawer.previewUrl) return
  const a = document.createElement('a')
  a.href = drawer.previewUrl
  a.download = '公共基础笔记目录图.png'
  a.click()
}

function downloadPdf() {
  if (!drawer.pdfPreviewUrl) return
  const a = document.createElement('a')
  a.href = drawer.pdfPreviewUrl
  a.download = '公共基础笔记PDF截图.png'
  a.click()
}

// ─── Canvas 合成：PDF底图 + 左下角目录浮层 ────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
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

async function buildPublicBasicComposite(pdfDataUrl, files, borderColor, title) {
  const pdfImg = await loadImage(pdfDataUrl)

  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const BORDER = 12
  const TITLE_H = 120

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  // 边框
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 内部白色
  const innerX = BORDER, innerY = BORDER
  const innerW = CANVAS_W - BORDER * 2
  const innerH = CANVAS_H - BORDER * 2
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(innerX, innerY, innerW, innerH)

  // 标题
  ctx.fillStyle = '#FF0000'
  const fontSize = Math.round(TITLE_H * 0.5)
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, CANVAS_W / 2, innerY + TITLE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // PDF 铺满剩余区域（cover 裁剪）
  const pdfAreaX = innerX
  const pdfAreaY = innerY + TITLE_H
  const pdfAreaW = innerW
  const pdfAreaH = innerH - TITLE_H
  const scale = Math.max(pdfAreaW / pdfImg.width, pdfAreaH / pdfImg.height)
  const pdfDrawW = pdfImg.width * scale
  const pdfDrawH = pdfImg.height * scale
  const pdfDrawX = pdfAreaX + (pdfAreaW - pdfDrawW) / 2
  const pdfDrawY = pdfAreaY + (pdfAreaH - pdfDrawH) / 2
  ctx.save()
  ctx.beginPath()
  ctx.rect(pdfAreaX, pdfAreaY, pdfAreaW, pdfAreaH)
  ctx.clip()
  ctx.drawImage(pdfImg, pdfDrawX, pdfDrawY, pdfDrawW, pdfDrawH)
  ctx.restore()

  // 左下角目录浮层
  const ICON_SIZE = 36
  const ROW_H = 72
  const OVERLAY_PAD = 20
  const FONT_SIZE = 20
  const pdfFiles = files

  ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
  const maxTextW = pdfFiles.reduce((max, f) => Math.max(max, ctx.measureText(f.name).width), 0)
  const OVERLAY_W = Math.max(
    400,
    Math.min(CANVAS_W - BORDER * 2 - 40, Math.ceil(maxTextW) + ICON_SIZE + OVERLAY_PAD * 2 + 10)
  )
  const OVERLAY_H = pdfFiles.length * ROW_H + OVERLAY_PAD * 2

  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const offsetRight = rnd(30, 80)
  const offsetBottom = rnd(30, 80)
  // 右下角定位
  const overlayX = CANVAS_W - BORDER - OVERLAY_W - offsetRight
  const overlayY = CANVAS_H - BORDER - OVERLAY_H - offsetBottom

  // 阴影 + 白底圆角浮层
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
    if (file.isdir === 1) {
      drawFolderIcon(ctx, overlayX + OVERLAY_PAD, y + (ROW_H - ICON_SIZE) / 2, ICON_SIZE)
    } else {
      drawPdfIcon(ctx, overlayX + OVERLAY_PAD, y + (ROW_H - ICON_SIZE) / 2, ICON_SIZE)
    }
    ctx.fillStyle = '#333333'
    ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`

    // 截断过长文件名
    const maxW = OVERLAY_W - ICON_SIZE - OVERLAY_PAD * 2 - 10
    let name = file.name
    while (ctx.measureText(name).width > maxW && name.length > 1) name = name.slice(0, -1)
    if (name !== file.name) name = name.slice(0, -1) + '...'

    ctx.fillText(name, overlayX + OVERLAY_PAD + ICON_SIZE + 10, y + ROW_H / 2 + 6)

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

// ─── pdf.js 按需加载 ──────────────────────────────────────
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

onMounted(load)
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
}

.component-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 12px;
  background: #fafafa;
}

.component-header {
  margin-bottom: 12px;
}

.component-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.component-body {
  display: flex;
  align-items: center;
}
</style>
