/**
 * batchDirGen.worker.js
 *
 * 批量生成目录图的 Web Worker。
 * 运行在独立线程，不受浏览器标签页可见性影响，切换窗口/最小化后仍持续执行。
 *
 * 使用 classic worker（非 ES module），通过 importScripts 加载 CDN 依赖。
 */

/* eslint-disable no-undef */
importScripts(
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
)

// 禁用 PDF.js 内部 worker，避免嵌套 Worker 可靠性问题（从 Worker 里再 spawn Worker）
// PDF.js 会在本线程同步解析 PDF，对批量生成场景完全够用
pdfjsLib.GlobalWorkerOptions.workerSrc = ''

// ── 全局配置（由主线程通过 start 消息初始化）──────────────────────
let _token = ''
let _apiBase = ''
let _borderColor = '#F9863B'
let _TITLE_POOL = []
let _HISTORY_TITLE_POOL = []
let _MOCK_TITLE_POOL = []
let _CARD_SCHEMES = []

// ── 消息工具 ────────────────────────────────────────────────────────
const post = (payload) => self.postMessage(payload)
const log  = (text, type = 'info') => post({ type: 'log', text, logType: type })
const prog = (done, total) => post({ type: 'progress', done, total })

// ── 通用工具 ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function rndPick(arr) {
  if (!arr?.length) return null
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return arr[buf[0] % arr.length]
}

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// OffscreenCanvas blob → base64 dataURL（FileReaderSync 在 Worker 中可用）
async function offscreenToDataUrl(canvas) {
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new FileReaderSync().readAsDataURL(blob)
}

// ── API 工具 ─────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(_apiBase + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_token}`,
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  const j = await res.json()
  return (j && j.data !== undefined) ? j.data : j
}

async function getBaiduFiles(path) {
  return apiFetch(`/api/baidu/files?path=${encodeURIComponent(path)}`)
}

async function getBaiduFilesWithRetry(path, maxRetry = 5) {
  let lastErr
  for (let i = 1; i <= maxRetry; i++) {
    try { return await getBaiduFiles(path) }
    catch (e) { lastErr = e; if (i < maxRetry) await sleep(1000) }
  }
  throw lastErr
}

// ── 图片加载（fetch + createImageBitmap，无跨域限制）────────────────
async function loadBitmap(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`图片加载失败 (${res.status})`)
  return createImageBitmap(await res.blob())
}

// ── 敏感词打码 ───────────────────────────────────────────────────────
const SENSITIVE_WORD_LIST = [
  '习近平','毛泽东','邓小平','江泽民','胡锦涛','李克强',
  '赵乐际','王沪宁','丁薛祥','李希',
  '中国共产党','中共中央','党中央','中央','共产党','政治局','总书记',
  '国家主席','国家副主席','中央军委','人民解放军','武警部队',
  '国务院','全国人大','全国政协','人民代表大会','人民代表',
  '中华人民共和国','共和国','中国','中华民族','中华','政府','党','宪法',
  '社会主义','全会','国家','法律','法规','政治',
]

function findSensitiveRanges(text) {
  const ranges = []
  for (const w of SENSITIVE_WORD_LIST) {
    let i = 0
    while (true) {
      const p = text.indexOf(w, i)
      if (p < 0) break
      ranges.push({ start: p, end: p + w.length })
      i = p + 1
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const merged = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  return merged
}

function mosaicText(ctx, text, textX, textBaselineY, fontSize, blockSize = 10) {
  const ranges = findSensitiveRanges(text)
  if (!ranges.length) return
  const savedFill = ctx.fillStyle, savedAlign = ctx.textAlign, savedBaseline = ctx.textBaseline
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  const CW = ctx.canvas.width, CH = ctx.canvas.height
  for (const { start, end } of ranges) {
    const prefixW = ctx.measureText(text.slice(0, start)).width
    const matchW  = ctx.measureText(text.slice(start, end)).width
    const rx = Math.floor(textX + prefixW) - 2, ry = Math.floor(textBaselineY - fontSize * 1.05) - 2
    const rw = Math.ceil(matchW) + 4,            rh = Math.ceil(fontSize * 1.35) + 4
    const x0 = Math.max(0, rx), y0 = Math.max(0, ry)
    const x1 = Math.min(CW, rx + rw), y1 = Math.min(CH, ry + rh)
    for (let by = y0; by < y1; by += blockSize) {
      for (let bx = x0; bx < x1; bx += blockSize) {
        const bw = Math.min(blockSize, x1 - bx), bh = Math.min(blockSize, y1 - by)
        if (bw <= 0 || bh <= 0) continue
        const px = ctx.getImageData(Math.min(bx + (bw >> 1), CW - 1), Math.min(by + (bh >> 1), CH - 1), 1, 1).data
        ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
        ctx.fillRect(bx, by, bw, bh)
      }
    }
  }
  ctx.fillStyle = savedFill; ctx.textAlign = savedAlign; ctx.textBaseline = savedBaseline
}

async function applyPdfMosaic(canvas, page, viewport) {
  let textContent
  try { textContent = await page.getTextContent() } catch { return }
  const ctx = canvas.getContext('2d')
  const CW = canvas.width, CH = canvas.height
  const BLOCK = 20
  const [va, , vc, vd, ve, vf] = viewport.transform
  const pdfPt = (x, y) => [va * x + vc * y + ve, viewport.transform[1] * x + vd * y + vf]
  const items = textContent.items.filter(it => it.str).map(it => {
    const [cx, cy] = pdfPt(it.transform[4], it.transform[5])
    const fs = Math.sqrt(it.transform[0] ** 2 + it.transform[1] ** 2)
    return { str: it.str, cx, cy, widthPx: (it.width || 0) * Math.abs(va), fontSizePx: fs * Math.abs(va) }
  })
  const lines = []
  for (const item of items) {
    let line = lines.find(l => Math.abs(l.baseCy - item.cy) <= 3)
    if (!line) { line = { baseCy: item.cy, items: [] }; lines.push(line) }
    line.items.push(item)
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.cx - b.cx)
    const chars = []
    for (const item of line.items) {
      const n = item.str.length || 1
      for (let k = 0; k < item.str.length; k++) {
        chars.push({ ch: item.str[k], x0: item.cx + k / n * item.widthPx, x1: item.cx + (k + 1) / n * item.widthPx, fontSizePx: item.fontSizePx })
      }
    }
    const lineText = chars.map(c => c.ch).join('')
    const ranges = findSensitiveRanges(lineText)
    for (const { start, end } of ranges) {
      if (end > chars.length) continue
      const rx  = Math.floor(chars[start].x0) - 3
      const rx1 = Math.ceil(chars[end - 1].x1) + 3
      const fh  = chars[start].fontSizePx
      const ry  = Math.floor(line.baseCy - fh * 1.05) - 3
      const rh  = Math.ceil(fh * 1.4) + 6
      const x0 = Math.max(0, rx), y0 = Math.max(0, ry)
      const x1 = Math.min(CW, rx1), y1 = Math.min(CH, ry + rh)
      for (let by = y0; by < y1; by += BLOCK) {
        for (let bx = x0; bx < x1; bx += BLOCK) {
          const bw = Math.min(BLOCK, x1 - bx), bh = Math.min(BLOCK, y1 - by)
          if (bw <= 0 || bh <= 0) continue
          const px = ctx.getImageData(Math.min(bx + (bw >> 1), CW - 1), Math.min(by + (bh >> 1), CH - 1), 1, 1).data
          ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
          ctx.fillRect(bx, by, bw, bh)
        }
      }
    }
  }
}

// ── 绘图辅助函数 ─────────────────────────────────────────────────────
const BG_COLOR_POOL = [
  '#a8c8f0','#f0a8b4','#a8e0c8','#f0d0a8','#c8b4f0','#a8d8f0','#f0e0a8','#b4f0d0',
  '#f0b4c8','#b4c8f0','#d0f0a8','#f0c8a8','#ffd6d6','#d6f0ff','#d6ffd6','#fff0d6',
  '#e8d6ff','#d6ffe8','#ffecd6','#d6e8ff','#ffe4f0','#e4ffe4','#fff4d6','#d6f4ff',
  '#f0d6ff','#d6ffee','#ffd6ee','#eeffd6','#dce8ff','#ffdce8','#dcffee','#ffeedd',
]
const pickBgColor = () => rndPick(BG_COLOR_POOL)

function drawGridBg(ctx, x, y, w, h, color, opacity, cellSize = 28) {
  if (opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let cx = x; cx <= x + w; cx += cellSize) { ctx.moveTo(cx, y); ctx.lineTo(cx, y + h) }
  for (let cy = y; cy <= y + h; cy += cellSize) { ctx.moveTo(x, cy); ctx.lineTo(x + w, cy) }
  ctx.stroke(); ctx.restore()
}

function drawFolderIcon(ctx, x, y, size) {
  ctx.fillStyle = '#F5A623'
  ctx.beginPath(); ctx.roundRect(x, y, size * 0.45, size * 0.22, 3); ctx.fill()
  ctx.beginPath(); ctx.roundRect(x, y + size * 0.18, size, size * 0.74, 4); ctx.fill()
}

function drawPdfIcon(ctx, x, y, size) {
  ctx.fillStyle = '#FF6B6B'
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 5); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(size * 0.38)}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('PDF', x + size / 2, y + size / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

// ── renderCompositeImage（OffscreenCanvas 版）────────────────────────
async function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl) {
  const DPR = 2, W = 600
  const BORDER = bgImageUrl ? 0 : 10
  const PADDING = 28, ICON_SIZE = 30, ROW_H = 52, TITLE_H = 88
  const H = BORDER + TITLE_H + ROW_H * files.length + PADDING + BORDER
  const canvas = new OffscreenCanvas(W * DPR, H * DPR)
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  if (bgImageUrl) {
    const bgImg = await loadBitmap(bgImageUrl)
    const scale = Math.max(W / bgImg.width, H / bgImg.height)
    const bw = bgImg.width * scale, bh = bgImg.height * scale
    ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
  } else {
    ctx.fillStyle = borderColor; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2)
    drawGridBg(ctx, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, bgColor, bgOpacity)
  }
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold 34px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(title, W / 2, BORDER + TITLE_H / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(BORDER + PADDING, BORDER + TITLE_H); ctx.lineTo(W - BORDER - PADDING, BORDER + TITLE_H); ctx.stroke()
  const listTop = BORDER + TITLE_H
  files.forEach((file, i) => {
    const y = listTop + i * ROW_H, iconY = y + (ROW_H - ICON_SIZE) / 2
    file.isdir === 1 ? drawFolderIcon(ctx, BORDER + PADDING, iconY, ICON_SIZE) : drawPdfIcon(ctx, BORDER + PADDING, iconY, ICON_SIZE)
    ctx.fillStyle = '#333333'
    ctx.font = `15px "PingFang SC", "Microsoft YaHei", sans-serif`
    const maxWidth = W - BORDER * 2 - PADDING * 2 - ICON_SIZE - 12
    let name = file.name
    while (ctx.measureText(name).width > maxWidth && name.length > 1) name = name.slice(0, -1)
    if (name !== file.name) name = name.slice(0, -1) + '...'
    ctx.fillText(name, BORDER + PADDING + ICON_SIZE + 12, y + ROW_H / 2 + 6)
    mosaicText(ctx, name, BORDER + PADDING + ICON_SIZE + 12, y + ROW_H / 2 + 6, 15, 10)
    if (i < files.length - 1) {
      ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(BORDER + PADDING, y + ROW_H); ctx.lineTo(W - BORDER - PADDING, y + ROW_H); ctx.stroke()
    }
  })
  return offscreenToDataUrl(canvas)
}

// ── buildHistoryComposite（OffscreenCanvas 版）───────────────────────
async function buildHistoryComposite(pdfOffscreen, files, borderColor, title, bgColor, bgOpacity, bgImageUrl) {
  const CANVAS_W = 1242, CANVAS_H = 1656
  const BORDER = bgImageUrl ? 0 : 12
  const TITLE_H = 120
  const canvas = new OffscreenCanvas(CANVAS_W, CANVAS_H)
  const ctx = canvas.getContext('2d')
  if (bgImageUrl) {
    const bgImg = await loadBitmap(bgImageUrl)
    const scale = Math.max(CANVAS_W / bgImg.width, CANVAS_H / bgImg.height)
    const bw = bgImg.width * scale, bh = bgImg.height * scale
    ctx.drawImage(bgImg, (CANVAS_W - bw) / 2, (CANVAS_H - bh) / 2, bw, bh)
  } else {
    ctx.fillStyle = borderColor; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }
  const innerX = BORDER, innerY = BORDER
  const innerW = CANVAS_W - BORDER * 2, innerH = CANVAS_H - BORDER * 2
  if (!bgImageUrl) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(innerX, innerY, innerW, innerH)
    drawGridBg(ctx, innerX, innerY, innerW, innerH, bgColor, bgOpacity, 36)
  }
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold ${Math.round(TITLE_H * 0.5)}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(title, CANVAS_W / 2, innerY + TITLE_H / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  // PDF 图绘制
  const pdfBitmap = await createImageBitmap(pdfOffscreen)
  const pdfAreaX = innerX, pdfAreaY = innerY + TITLE_H
  const pdfAreaW = innerW, pdfAreaH = innerH - TITLE_H
  const cropL = rndInt(30, 70), cropR = rndInt(30, 70), cropT = rndInt(30, 70), cropB = rndInt(30, 70)
  const srcX = cropL, srcY = cropT
  const srcW = pdfBitmap.width - cropL - cropR, srcH = pdfBitmap.height - cropT - cropB
  const pdfMargin = rndInt(30, 80)
  const pdfMaxW = pdfAreaW - pdfMargin * 2, pdfMaxH = pdfAreaH - pdfMargin * 2
  const scl = Math.min(pdfMaxW / srcW, pdfMaxH / srcH)
  const pdfDrawW = srcW * scl, pdfDrawH = srcH * scl
  const scaleOffset = rndInt(-50, 50)
  const finalDrawW = pdfDrawW + scaleOffset
  const finalDrawH = pdfDrawH * (finalDrawW / pdfDrawW)
  const finalDrawX = pdfAreaX + (pdfAreaW - finalDrawW) / 2
  const finalDrawY = pdfAreaY + (pdfAreaH - finalDrawH) / 2
  ctx.drawImage(pdfBitmap, srcX, srcY, srcW, srcH, finalDrawX, finalDrawY, finalDrawW, finalDrawH)
  // 文件名浮层
  const ICON_SIZE = 36, ROW_H = 72, OVERLAY_PAD = 20, FONT_SIZE = 20
  const pdfFiles = files.filter(f => f.isdir === 0)
  ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
  const maxTextW = pdfFiles.reduce((max, f) => Math.max(max, ctx.measureText(f.name).width), 0)
  const OVERLAY_W = Math.max(400, Math.min(CANVAS_W - BORDER * 2 - 40, Math.ceil(maxTextW) + ICON_SIZE + OVERLAY_PAD * 2 + 10))
  const OVERLAY_H = pdfFiles.length * ROW_H + OVERLAY_PAD * 2
  const offsetRight = rndInt(30, 80), offsetBottom = rndInt(30, 80)
  const overlayX = CANVAS_W - BORDER - OVERLAY_W - offsetRight
  const overlayY = CANVAS_H - BORDER - OVERLAY_H - offsetBottom
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.roundRect(overlayX, overlayY, OVERLAY_W, OVERLAY_H, 10); ctx.fill()
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
  pdfFiles.forEach((file, i) => {
    const y = overlayY + OVERLAY_PAD + i * ROW_H
    drawPdfIcon(ctx, overlayX + OVERLAY_PAD, y + (ROW_H - ICON_SIZE) / 2, ICON_SIZE)
    ctx.fillStyle = '#333333'
    ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.fillText(file.name, overlayX + OVERLAY_PAD + ICON_SIZE + 10, y + ROW_H / 2 + 6)
    mosaicText(ctx, file.name, overlayX + OVERLAY_PAD + ICON_SIZE + 10, y + ROW_H / 2 + 6, FONT_SIZE, 12)
    if (i < pdfFiles.length - 1) {
      ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(overlayX + OVERLAY_PAD, y + ROW_H); ctx.lineTo(overlayX + OVERLAY_W - OVERLAY_PAD, y + ROW_H); ctx.stroke()
    }
  })
  return offscreenToDataUrl(canvas)
}

// ── PDF 第一页渲染（OffscreenCanvas 版）─────────────────────────────
async function renderPdfPage(pdfPath) {
  const url = _apiBase + `/api/baidu/proxy-pdf?path=${encodeURIComponent(pdfPath)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${_token}` } })
  if (!res.ok) throw new Error(`PDF加载失败 (${res.status})`)
  const buffer = await res.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = new OffscreenCanvas(viewport.width, viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  await applyPdfMosaic(canvas, page, viewport)
  return canvas  // 返回 OffscreenCanvas（可传入 buildHistoryComposite）
}

// ── buildDirImageForBatch（Worker 版）──────────────────────────────
async function buildDirImageForBatch(path, type, title, onlyDir, bgUrl) {
  const res = await getBaiduFilesWithRetry(path)
  const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
  if (!files.length) throw new Error('目录为空')
  if (type === 'history' || type === 'mock') {
    if (!onlyDir) {
      const kw = type === 'mock' ? '2026' : '2025'
      const pdf = files.find(f => f.isdir === 0 && f.name.includes(kw))
      if (pdf) {
        try {
          const pdfCanvas = await renderPdfPage(pdf.path)
          return await buildHistoryComposite(pdfCanvas, files, _borderColor, title, pickBgColor(), 0.35, bgUrl)
        } catch (_) {}
      }
    }
    return renderCompositeImage(files, title, _borderColor, pickBgColor(), 0.35, bgUrl)
  }
  if (type === 'custom') {
    if (!onlyDir) {
      const pdfs = files.filter(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
      if (pdfs.length) {
        try {
          const pdfCanvas = await renderPdfPage(rndPick(pdfs).path)
          return await buildHistoryComposite(pdfCanvas, files, _borderColor, title, pickBgColor(), 0.35, bgUrl)
        } catch (_) {}
      }
    }
  }
  return renderCompositeImage(files, title, _borderColor, pickBgColor(), 0.35, bgUrl)
}

// ── 卡片图（CardBasic，OffscreenCanvas 版）──────────────────────────
async function renderCardImage(text, scheme) {
  const SCALE = 3
  const W = 360 * SCALE, H = 480 * SCALE
  const PAD_L = 40 * SCALE, PAD_R = 40 * SCALE, PAD_T = 44 * SCALE, PAD_B = 36 * SCALE
  const RADIUS = 20 * SCALE
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = scheme.bg
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, RADIUS); ctx.fill()
  const QUOTE_FONT_SIZE = 72 * SCALE
  ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = scheme.accent
  ctx.font = `bold ${QUOTE_FONT_SIZE}px Georgia, serif`; ctx.textBaseline = 'top'
  ctx.fillText('\u201C', PAD_L, PAD_T); ctx.restore()
  const FONT_SIZE = 36 * SCALE
  const LINE_HEIGHT = FONT_SIZE * 1.75
  const TEXT_TOP = PAD_T + QUOTE_FONT_SIZE * 0.8 + 16 * SCALE
  const TEXT_WIDTH = W - PAD_L - PAD_R
  const BAR_H = 4 * SCALE
  const TEXT_BOTTOM = H - PAD_B - BAR_H - 8 * SCALE
  const HL_COLOR = '#ffea7a'
  const commaIdx = String(text || '').search(/[，,]/)
  let hlCharsLeft = commaIdx === -1 ? text.length : commaIdx
  const FONT_NORMAL = `600 ${FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`
  const FONT_BOLD   = `bold ${FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`
  ctx.font = FONT_NORMAL; ctx.textBaseline = 'top'
  // 换行
  const lines = []
  for (const para of String(text || '').split('\n')) {
    if (!para) { lines.push(''); continue }
    let cur = ''
    for (const ch of para) {
      const test = cur + ch
      if (ctx.measureText(test).width > TEXT_WIDTH) { if (cur) lines.push(cur); cur = ch }
      else cur = test
    }
    if (cur) lines.push(cur)
  }
  let y = TEXT_TOP
  for (const line of lines) {
    if (y + FONT_SIZE > TEXT_BOTTOM) break
    const hlLen = Math.min(hlCharsLeft, line.length)
    const hlPart = line.slice(0, hlLen), normalPart = line.slice(hlLen)
    hlCharsLeft -= hlLen
    let x = PAD_L
    if (hlPart) {
      ctx.font = FONT_BOLD
      const hlW = ctx.measureText(hlPart).width
      ctx.fillStyle = HL_COLOR; ctx.fillRect(x, y + FONT_SIZE * 0.55, hlW, FONT_SIZE * 0.47)
      ctx.fillStyle = scheme.text; ctx.fillText(hlPart, x, y); x += hlW
    }
    if (normalPart) { ctx.font = FONT_NORMAL; ctx.fillStyle = scheme.text; ctx.fillText(normalPart, x, y) }
    y += LINE_HEIGHT
  }
  const BAR_W = 40 * SCALE
  ctx.fillStyle = scheme.accent
  ctx.beginPath(); ctx.roundRect(PAD_L, H - PAD_B - BAR_H, BAR_W, BAR_H, 2 * SCALE); ctx.fill()
  // ─── 底部固定文字：左滑查看更多备考资料（重点样式，同 xxx笔试 高亮）──
  const BTM_FONT_SIZE = 22 * SCALE
  const BTM_TEXT = '左滑查看更多备考资料'
  ctx.font = `bold ${BTM_FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`
  ctx.textBaseline = 'top'
  const btmTextW = ctx.measureText(BTM_TEXT).width
  const btmX = W - PAD_R - btmTextW
  const btmY = H - 160 - BTM_FONT_SIZE
  ctx.fillStyle = HL_COLOR; ctx.fillRect(btmX, btmY + BTM_FONT_SIZE * 0.55, btmTextW, BTM_FONT_SIZE * 0.47)
  ctx.fillStyle = scheme.text; ctx.fillText(BTM_TEXT, btmX, btmY)
  return offscreenToDataUrl(canvas)
}

// ── 主批量循环 ───────────────────────────────────────────────────────
async function runBatch({ productDetails, onlyDirImages, bgPool, borderColor, titlePool, historyTitlePool, mockTitlePool, cardSchemes }) {
  _TITLE_POOL         = titlePool        || []
  _HISTORY_TITLE_POOL = historyTitlePool || []
  _MOCK_TITLE_POOL    = mockTitlePool    || []
  _CARD_SCHEMES       = cardSchemes      || []
  _borderColor        = borderColor      || '#F9863B'
  const bgImagePool   = bgPool           || []

  const total = productDetails.length
  let done = 0

  for (const { id, company, detail } of productDetails) {
    log(`处理：${company}`)

    // 本商品所有任务使用同一张背景图（crypto 真随机）
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const productBgUrl = bgImagePool.length ? bgImagePool[buf[0] % bgImagePool.length] : null

    // 构建任务列表（与主线程逻辑一致）
    const tasks = []
    if (detail.baidu_path_exam) {
      tasks.push({ path: detail.baidu_path_exam, type: 'exam',    label: '笔试资料目录', title: '笔试资料完整目录' })
      tasks.push({ path: detail.baidu_path_exam, type: 'culture', label: '企业文化目录', title: '企业近况及文化' })
    }
    if (detail.baidu_path_history) {
      tasks.push({ path: detail.baidu_path_history, type: 'history', label: '真题目录',   title: rndPick(_HISTORY_TITLE_POOL) || '真题目录' })
    }
    if (detail.baidu_path_mock) {
      tasks.push({ path: detail.baidu_path_mock, type: 'mock', label: '模拟题目录', title: rndPick(_MOCK_TITLE_POOL) || '模拟题目录' })
    }
    if (detail.baidu_custom_dirs?.length) {
      detail.baidu_custom_dirs.forEach((item, idx) => {
        tasks.push({ path: item.path, type: 'custom', label: item.name || `自定义${idx + 1}`, title: item.name || '自定义' })
      })
    }

    if (!tasks.length) {
      log(`  └ 未配置百度网盘目录，跳过`, 'warn')
      done++; prog(done, total); continue
    }

    const images = []  // { label, base64 }

    // 生成目录图
    for (const task of tasks) {
      try {
        let dataUrl
        if (task.type === 'culture') {
          const res = await getBaiduFilesWithRetry(task.path)
          const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
          const culturePdf = files.find(f => f.isdir === 0 && f.name.includes('企业文化'))
          if (!culturePdf) { log(`  └ ${task.label}：未找到"企业文化"PDF，跳过`, 'warn'); continue }
          const pdfCanvas = await renderPdfPage(culturePdf.path)
          dataUrl = await buildHistoryComposite(pdfCanvas, files, _borderColor, task.title, pickBgColor(), 0.35, productBgUrl)
        } else {
          dataUrl = await buildDirImageForBatch(task.path, task.type, task.title, onlyDirImages, productBgUrl)
        }
        images.push({ label: task.label, base64: dataUrl.replace(/^data:image\/png;base64,/, '') })
        log(`  └ ${task.label} ✓`, 'success')
      } catch (e) {
        log(`  └ ${task.label} 失败：${e.message}`, 'error')
      }
    }

    // 生成卡片图
    log(`  └ 生成卡片图中...`, 'info')
    try {
      const scheme = rndPick(_CARD_SCHEMES) || { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' }
      const cardTitle = rndPick(_TITLE_POOL) || ''
      const cardText = `${detail.company_name || ''}笔试，${cardTitle}`
      const cardDataUrl = await renderCardImage(cardText, scheme)
      images.push({ label: '卡片图', base64: cardDataUrl.replace(/^data:image\/png;base64,/, '') })
      log(`  └ 卡片图 ✓`, 'success')
    } catch (e) {
      log(`  └ 卡片图失败：${e.message}`, 'error')
    }

    // 把本商品所有图片发回主线程（主线程负责：笔记生成 + docx + ZIP + 飞书）
    post({ type: 'product-images', id, company, images })

    done++; prog(done, total)
  }

  post({ type: 'done' })
}

// ── Worker 入口 ──────────────────────────────────────────────────────
self.onmessage = async (e) => {
  if (e.data.type !== 'start') return
  const { token, apiBase, ...rest } = e.data
  _token   = token   || ''
  _apiBase = apiBase || ''
  try {
    await runBatch(rest)
  } catch (err) {
    post({ type: 'error', message: err.message || '未知错误' })
  }
}
