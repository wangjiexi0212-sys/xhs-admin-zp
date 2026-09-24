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
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
)

// 批量生成本身运行在 Web Worker 中；预加载 pdf.worker 后，让 PDF.js 的
// fake worker 直接复用当前线程内的 WorkerMessageHandler，避免访问 document。
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

const DIR_IMAGE_STYLES = [
  'classic',
  'drive',
  'sheet',
  'table',
  'checklist',
  'sticky',
  'dark',
  'magazine',
  'soft',
  'split',
  'terminal',
  'blueprint',
  'receipt',
  'book',
  'index',
  'bubble',
  'stamp',
  'mint',
  'calendar',
  'folder_wall',
  'rainbow',
  'outline',
  'cream',
  'mono',
]

const PDF_SINGLE_STYLES = ['classic', 'folder', 'desk', 'stamp', 'split', 'phone', 'blueprint', 'minimal']
const PDF_GRID_STYLES = ['classic', 'desk', 'folder', 'phone', 'stamp', 'checklist', 'blueprint', 'album', 'pinboard', 'minimalLine']
const PDF_GRID_TITLE_STYLES = ['solidRed', 'pill', 'stroke', 'card', 'shadow']

function wrapCanvasText(ctx, text, maxWidth) {
  const lines = []
  let cur = ''
  for (const ch of String(text || '')) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function measureDirRows(files, maxWidth, fontSize = 17) {
  const canvas = new OffscreenCanvas(1, 1)
  const ctx = canvas.getContext('2d')
  ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  return files.map(file => {
    const lines = wrapCanvasText(ctx, file.name, maxWidth)
    return { file, lines, height: Math.max(48, lines.length * (fontSize + 7) + 18) }
  })
}

function drawWrappedLines(ctx, lines, x, y, lineHeight, fontSize, blockSize = 10) {
  lines.forEach((line, i) => {
    const yy = y + i * lineHeight
    ctx.fillText(line, x, yy)
    mosaicText(ctx, line, x, yy, fontSize, blockSize)
  })
}

function drawDirBg(ctx, W, H, style, borderColor, bgColor, bgOpacity) {
  if (style === 'classic') {
    ctx.fillStyle = borderColor; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(10, 10, W - 20, H - 20)
    drawGridBg(ctx, 10, 10, W - 20, H - 20, bgColor, bgOpacity)
  } else if (style === 'drive') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#f7fbff'); grad.addColorStop(1, '#eef6ff')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else if (style === 'sheet') {
    ctx.fillStyle = '#fffefa'; ctx.fillRect(0, 0, W, H)
    drawGridBg(ctx, 0, 0, W, H, '#d8ecff', 0.45, 26)
  } else if (style === 'table') {
    ctx.fillStyle = '#18c38a'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdfa'; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'checklist') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#f4fff9'); grad.addColorStop(1, '#ffffff')
    ctx.fillStyle = '#35c98a'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = grad; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'sticky') {
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.45
    ctx.fillStyle = '#ffdd6c'; ctx.beginPath(); ctx.arc(W * 0.86, H * 0.12, 110, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff96aa'; ctx.beginPath(); ctx.arc(W * 0.12, H * 0.86, 120, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  } else if (style === 'dark') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#111827'); grad.addColorStop(1, '#1f2937')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else if (style === 'magazine') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ffe9ec'
    ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.86, H); ctx.closePath(); ctx.fill()
  } else if (style === 'split') {
    ctx.fillStyle = '#fff7e6'; ctx.fillRect(0, 0, W * 0.36, H)
    ctx.fillStyle = '#eef7ff'; ctx.fillRect(W * 0.36, 0, W * 0.64, H)
  } else if (style === 'terminal') {
    ctx.fillStyle = '#101722'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'blueprint') {
    ctx.fillStyle = '#123b66'; ctx.fillRect(0, 0, W, H)
    drawGridBg(ctx, 0, 0, W, H, '#ffffff', 0.12, 28)
  } else if (style === 'receipt') {
    ctx.fillStyle = '#f7f1e5'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdf7'
    ctx.beginPath(); ctx.roundRect(26, 24, W - 52, H - 48, 8); ctx.fill()
    ctx.setLineDash([8, 8]); ctx.strokeStyle = '#b7a98d'; ctx.stroke(); ctx.setLineDash([])
  } else if (style === 'book') {
    ctx.fillStyle = '#f4ead6'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(34, 24, W - 58, H - 48)
    ctx.fillStyle = '#b45309'; ctx.fillRect(34, 24, 14, H - 48)
  } else if (style === 'index') {
    ctx.fillStyle = '#f7fbff'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'bubble') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.62
    ctx.fillStyle = '#dff7ff'; ctx.beginPath(); ctx.arc(W * 0.18, H * 0.14, 120, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffe2eb'; ctx.beginPath(); ctx.arc(W * 0.9, H * 0.15, 120, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  } else if (style === 'stamp') {
    ctx.fillStyle = '#de2f2f'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff8f8'; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'mint') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#eafff5'); grad.addColorStop(1, '#f8fffc')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else if (style === 'calendar') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'folder_wall') {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'rainbow') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'outline') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'cream') {
    ctx.fillStyle = '#e8cfa7'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff8ed'; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'mono') {
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, W, H)
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#f6fbff'); grad.addColorStop(1, '#fff7fb')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  }
}

function drawDirTitleBlock(ctx, title, style, W, y) {
  ctx.textAlign = style === 'magazine' || style === 'terminal' || style === 'book' || style === 'mono' ? 'left' : 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style === 'dark' ? '#ff6b6b'
    : style === 'terminal' ? '#78ffbd'
      : style === 'blueprint' ? '#ffffff'
        : style === 'mint' ? '#059669'
          : style === 'cream' ? '#8a4b18'
            : style === 'mono' ? '#111111'
              : '#ff0000'
  ctx.font = `bold ${style === 'magazine' || style === 'terminal' || style === 'book' ? 32 : 34}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText(title, style === 'magazine' || style === 'terminal' || style === 'book' || style === 'mono' ? 40 : W / 2, y)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawStyledIcon(ctx, file, style, x, y, size, index) {
  if (style === 'checklist' || style === 'outline') {
    ctx.fillStyle = style === 'outline' ? '#2f7cf6' : '#22c55e'
    ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(size * 0.56)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(style === 'outline' ? String(index + 1) : '✓', x + size / 2, y + size / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    return
  }
  if (style === 'terminal') {
    ctx.fillStyle = '#78ffbd'
    ctx.font = `bold 18px ui-monospace, monospace`
    ctx.fillText('>', x, y + 20)
    return
  }
  if (style === 'table' || style === 'sheet' || style === 'dark' || style === 'soft' || style === 'magazine' || style === 'split' || style === 'blueprint' || style === 'receipt' || style === 'book' || style === 'index' || style === 'bubble' || style === 'stamp' || style === 'mint' || style === 'cream' || style === 'mono') {
    const badgeW = style === 'soft' ? size + 10 : 56
    ctx.fillStyle = style === 'blueprint' || style === 'receipt' || style === 'stamp' || style === 'mono'
      ? 'transparent'
      : file.isdir === 1 ? '#f6aa22' : '#ff6470'
    ctx.beginPath(); ctx.roundRect(x, y, badgeW, Math.max(24, size - 2), 8); ctx.fill()
    if (style === 'blueprint' || style === 'receipt' || style === 'stamp' || style === 'mono') {
      ctx.strokeStyle = style === 'blueprint' ? 'rgba(255,255,255,0.72)' : style === 'stamp' ? '#de2f2f' : '#333333'
      ctx.stroke()
    }
    ctx.fillStyle = style === 'blueprint' ? '#ffffff' : style === 'receipt' || style === 'mono' ? '#333333' : style === 'stamp' ? '#de2f2f' : '#fff'
    ctx.font = `bold 12px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(style === 'soft' ? String(index + 1).padStart(2, '0') : (file.isdir === 1 ? '文件夹' : 'PDF'), x + badgeW / 2, y + Math.max(24, size - 2) / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    return
  }
  file.isdir === 1 ? drawFolderIcon(ctx, x, y, size) : drawPdfIcon(ctx, x, y, size)
}

async function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl, style = 'classic') {
  const DPR = 2, W = 600
  const activeStyle = DIR_IMAGE_STYLES.includes(style) ? style : 'classic'
  const BORDER = bgImageUrl ? 0 : (activeStyle === 'classic' ? 10 : 0)
  const gridStyles = ['sticky', 'calendar', 'folder_wall', 'rainbow']
  const PADDING = activeStyle === 'magazine' || activeStyle === 'terminal' || activeStyle === 'book' || activeStyle === 'mono' ? 40 : 34
  const ICON_SIZE = activeStyle === 'classic' || activeStyle === 'drive' ? 30 : 32
  const BADGE_W = activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'magazine' || activeStyle === 'split' || activeStyle === 'blueprint' || activeStyle === 'receipt' || activeStyle === 'book' || activeStyle === 'index' || activeStyle === 'bubble' || activeStyle === 'stamp' || activeStyle === 'mint' || activeStyle === 'cream' || activeStyle === 'mono'
    ? 56
    : activeStyle === 'soft'
      ? ICON_SIZE + 10
      : ICON_SIZE
  const ICON_TEXT_GAP = activeStyle === 'classic' || activeStyle === 'drive' ? 26 : 22
  const TITLE_H = activeStyle === 'magazine' || activeStyle === 'terminal' || activeStyle === 'book' || activeStyle === 'mono' ? 118 : 102
  const textX = activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'split' || activeStyle === 'blueprint' || activeStyle === 'receipt' || activeStyle === 'book' || activeStyle === 'index' || activeStyle === 'bubble' || activeStyle === 'stamp' || activeStyle === 'mint' || activeStyle === 'cream' || activeStyle === 'mono'
    ? BORDER + PADDING + 130
    : BORDER + PADDING + BADGE_W + ICON_TEXT_GAP
  const maxTextW = W - textX - PADDING - BORDER
  const fontSize = activeStyle === 'drive' || activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'terminal' || activeStyle === 'blueprint' || activeStyle === 'mono' ? 18 : 17
  const rows = measureDirRows(files, maxTextW, fontSize)
  const rowGap = ['sticky', 'soft', 'checklist', 'bubble', 'mint', 'rainbow'].includes(activeStyle) ? 14 : 0
  const gridCardH = activeStyle === 'calendar' || activeStyle === 'folder_wall' || activeStyle === 'rainbow' ? 128 : 126
  const bodyH = gridStyles.includes(activeStyle)
    ? Math.ceil(files.length / 2) * gridCardH
    : rows.reduce((sum, row) => sum + row.height + rowGap, 0)
  const H = BORDER + TITLE_H + bodyH + PADDING + BORDER + (activeStyle === 'drive' ? 44 : 0)
  const canvas = new OffscreenCanvas(W * DPR, H * DPR)
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  if (bgImageUrl) {
    const bgImg = await loadBitmap(bgImageUrl)
    const scale = Math.max(W / bgImg.width, H / bgImg.height)
    const bw = bgImg.width * scale, bh = bgImg.height * scale
    ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
  } else {
    drawDirBg(ctx, W, H, activeStyle, borderColor, bgColor, bgOpacity)
  }
  drawDirTitleBlock(ctx, title, activeStyle, W, BORDER + TITLE_H / 2)
  if (activeStyle === 'drive') {
    const winX = BORDER + 20, winY = BORDER + 88, winW = W - BORDER * 2 - 40, winH = H - winY - 24
    ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.beginPath(); ctx.roundRect(winX, winY, winW, winH, 12); ctx.fill()
    ctx.strokeStyle = 'rgba(30,41,59,0.12)'; ctx.stroke()
    ctx.fillStyle = '#ff5f57'; ctx.beginPath(); ctx.arc(winX + 18, winY + 18, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(winX + 34, winY + 18, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#28c840'; ctx.beginPath(); ctx.arc(winX + 50, winY + 18, 5, 0, Math.PI * 2); ctx.fill()
  }
  if (activeStyle === 'split') {
    ctx.fillStyle = '#9a4e00'
    ctx.font = `bold 26px "PingFang SC", sans-serif`
    ctx.fillText('2026', 40, 150)
    ctx.fillText('备考资料包', 40, 184)
  }
  if (activeStyle === 'table' || activeStyle === 'dark') {
    const headerY = BORDER + TITLE_H - 18
    ctx.fillStyle = activeStyle === 'dark' ? 'rgba(255,255,255,0.1)' : '#243044'
    ctx.fillRect(BORDER + PADDING - 10, headerY, W - BORDER * 2 - PADDING * 2 + 20, 36)
    ctx.fillStyle = '#fff'; ctx.font = `bold 14px "PingFang SC", sans-serif`
    ctx.fillText('序号', BORDER + PADDING, headerY + 23)
    ctx.fillText('类型', BORDER + PADDING + 58, headerY + 23)
    ctx.fillText('文件名称', textX, headerY + 23)
  } else if (activeStyle === 'classic') {
    ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(BORDER + PADDING, BORDER + TITLE_H); ctx.lineTo(W - BORDER - PADDING, BORDER + TITLE_H); ctx.stroke()
  }
  const listTop = BORDER + TITLE_H
  let y = listTop + (activeStyle === 'table' || activeStyle === 'dark' ? 24 : 0)
  const stickyColors = ['#fff3b0', '#d8f5ff', '#dff8d8', '#ffe0ea', '#eadfff', '#fff0d2', '#e7f7ed', '#f4e7ff']
  const rainbowColors = ['#fff1f0', '#e6f7ff', '#f6ffed', '#fff7e6', '#f9f0ff', '#e6fffb', '#fffbe6', '#f0f5ff']
  rows.forEach((row, i) => {
    const { file, lines, height } = row
    if (gridStyles.includes(activeStyle)) {
      const col = i % 2
      const cardW = (W - 84) / 2
      const cardX = 34 + col * (cardW + 16)
      const cardY = listTop + Math.floor(i / 2) * gridCardH
      const cardH = gridCardH - 22
      ctx.save()
      if (activeStyle === 'sticky') {
        ctx.translate(cardX + cardW / 2, cardY + cardH / 2)
        ctx.rotate((i % 2 ? 0.012 : -0.012))
        ctx.fillStyle = stickyColors[i % stickyColors.length]
        ctx.beginPath(); ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 9); ctx.fill()
        ctx.fillStyle = '#243044'; ctx.font = `600 15px "PingFang SC", "Microsoft YaHei", sans-serif`
        drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 26), -cardW / 2 + 13, -18, 21, 15)
      } else if (activeStyle === 'calendar') {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill()
        ctx.strokeStyle = 'rgba(30,41,59,0.12)'; ctx.stroke()
        ctx.fillStyle = '#e92222'; ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, 30, 14); ctx.fill()
        ctx.fillRect(cardX, cardY + 16, cardW, 14)
        ctx.fillStyle = '#fff'; ctx.font = `bold 13px "PingFang SC", sans-serif`; ctx.fillText(`${String(i + 1).padStart(2, '0')} ${file.isdir === 1 ? '文件夹' : 'PDF'}`, cardX + 12, cardY + 20)
        ctx.fillStyle = '#202938'; ctx.font = `600 15px "PingFang SC", sans-serif`
        drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 24), cardX + 12, cardY + 54, 21, 15)
      } else if (activeStyle === 'folder_wall') {
        ctx.fillStyle = '#fff7d6'
        ctx.beginPath(); ctx.roundRect(cardX, cardY + 10, cardW, cardH - 10, 18); ctx.fill()
        ctx.strokeStyle = '#f5d980'; ctx.stroke()
        ctx.fillStyle = '#ffe082'; ctx.beginPath(); ctx.roundRect(cardX + 18, cardY, 70, 22, 8); ctx.fill()
        ctx.fillStyle = '#202938'; ctx.font = `600 15px "PingFang SC", sans-serif`
        drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 30), cardX + 15, cardY + 50, 21, 15)
      } else {
        ctx.fillStyle = rainbowColors[i % rainbowColors.length]
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill()
        ctx.fillStyle = file.isdir === 1 ? '#f6aa22' : '#ff6470'
        ctx.beginPath(); ctx.roundRect(cardX + 12, cardY + 12, 46, 24, 8); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = `bold 12px "PingFang SC", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(file.isdir === 1 ? '夹' : 'PDF', cardX + 35, cardY + 29); ctx.textAlign = 'left'
        ctx.fillStyle = '#202938'; ctx.font = `600 15px "PingFang SC", sans-serif`
        drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 30), cardX + 15, cardY + 60, 21, 15)
      }
      ctx.restore()
      if (i === rows.length - 1) y = cardY + cardH
      return
    }
    if (activeStyle === 'soft' || activeStyle === 'checklist' || activeStyle === 'bubble' || activeStyle === 'mint' || activeStyle === 'rainbow') {
      const x = BORDER + PADDING - 4
      const w = W - BORDER * 2 - PADDING * 2 + 8
      ctx.fillStyle = activeStyle === 'mint' ? '#ffffff' : activeStyle === 'bubble' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.78)'
      ctx.beginPath(); ctx.roundRect(x, y + 7, w, height - 8, activeStyle === 'bubble' ? 24 : 14); ctx.fill()
      if (activeStyle === 'mint') {
        ctx.fillStyle = '#10b981'; ctx.fillRect(x, y + 7, 6, height - 8)
      }
      ctx.strokeStyle = 'rgba(30,41,59,0.08)'; ctx.stroke()
    }
    if (activeStyle === 'outline' && i < rows.length - 1) {
      ctx.strokeStyle = 'rgba(30,41,59,0.15)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(BORDER + PADDING + 16, y + 32); ctx.lineTo(BORDER + PADDING + 16, y + height + rowGap + 20); ctx.stroke()
    }
    const iconX = activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'split' || activeStyle === 'blueprint' || activeStyle === 'receipt' || activeStyle === 'book' || activeStyle === 'index' || activeStyle === 'bubble' || activeStyle === 'stamp' || activeStyle === 'mint' || activeStyle === 'cream' || activeStyle === 'mono'
      ? BORDER + PADDING + 58
      : BORDER + PADDING
    const noX = BORDER + PADDING
    if (activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'split' || activeStyle === 'blueprint' || activeStyle === 'receipt' || activeStyle === 'book' || activeStyle === 'index' || activeStyle === 'bubble' || activeStyle === 'stamp' || activeStyle === 'mint' || activeStyle === 'cream' || activeStyle === 'mono') {
      ctx.fillStyle = activeStyle === 'dark' ? 'rgba(237,242,255,0.78)' : '#6c7482'
      ctx.font = `bold 15px "PingFang SC", sans-serif`
      ctx.fillText(String(i + 1).padStart(2, '0'), noX, y + 34)
    }
    drawStyledIcon(ctx, file, activeStyle, iconX, y + 15, ICON_SIZE, i)
    ctx.fillStyle = activeStyle === 'dark' || activeStyle === 'terminal' || activeStyle === 'blueprint' ? '#f8fbff' : activeStyle === 'cream' ? '#6f3f14' : '#333333'
    ctx.font = `${activeStyle === 'magazine' || activeStyle === 'terminal' ? '600' : '500'} ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    drawWrappedLines(ctx, lines, textX, y + 35, fontSize + 7, fontSize, 10)
    if (!['sticky', 'soft', 'checklist'].includes(activeStyle) && i < rows.length - 1) {
      ctx.strokeStyle = activeStyle === 'dark' || activeStyle === 'terminal' || activeStyle === 'blueprint' ? 'rgba(255,255,255,0.10)' : activeStyle === 'stamp' ? 'rgba(222,47,47,0.16)' : '#eeeeee'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(BORDER + PADDING, y + height); ctx.lineTo(W - BORDER - PADDING, y + height); ctx.stroke()
    }
    y += height + rowGap
  })
  return offscreenToDataUrl(canvas)
}

// ── buildHistoryComposite（OffscreenCanvas 版）───────────────────────
async function buildHistoryComposite(pdfOffscreen, files, borderColor, title, bgColor, bgOpacity, bgImageUrl, style = 'classic') {
  const activeStyle = PDF_SINGLE_STYLES.includes(style) ? style : 'classic'
  if (activeStyle !== 'classic') {
    return buildStyledSinglePdfComposite(pdfOffscreen, files, borderColor, title, activeStyle)
  }
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

async function buildStyledSinglePdfComposite(pdfOffscreen, files, borderColor, title, style = 'classic') {
  const CANVAS_W = 1242, CANVAS_H = 1656
  const canvas = new OffscreenCanvas(CANVAS_W, CANVAS_H)
  const ctx = canvas.getContext('2d')
  const pdfBitmap = await createImageBitmap(pdfOffscreen)
  const pdfFiles = files.filter(f => f.isdir === 0)

  const fillBg = (fill, border = null) => {
    ctx.fillStyle = fill; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 12; ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12) }
  }
  const titleText = (x, y, color = '#f00', size = 58, align = 'center') => {
    ctx.fillStyle = color
    ctx.font = `bold ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = align; ctx.textBaseline = 'middle'
    ctx.fillText(title, x, y)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  }
  const drawPage = ({ x, y, w, h, r = 16, rotate = 0, shadow = true }) => {
    const cx = x + w / 2, cy = y + h / 2
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotate * Math.PI / 180)
    if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8 }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.clip()
    ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2, -h / 2, w, h)
    const crop = 40
    const srcW = pdfBitmap.width - crop * 2, srcH = pdfBitmap.height - crop * 2
    const scale = Math.min(w / srcW, h / srcH)
    const dw = srcW * scale, dh = srcH * scale
    ctx.drawImage(pdfBitmap, crop, crop, srcW, srcH, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }
  const drawOverlay = (x, y, width = 540) => {
    const fontSize = 22, rowH = 70, iconSize = 40, pad = 22
    ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    const maxTextW = width - pad * 2 - iconSize - 14
    const rows = pdfFiles.map(file => {
      const lines = wrapCanvasText(ctx, file.name, maxTextW)
      return { file, lines, height: Math.max(rowH, lines.length * (fontSize + 8) + 22) }
    })
    const height = rows.reduce((sum, row) => sum + row.height, 0) + pad * 2
    x = Math.min(Math.max(24, x), CANVAS_W - width - 24)
    y = Math.min(Math.max(24, y), CANVAS_H - height - 24)
    ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, width, height, 14); ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.stroke()
    let cy = y + pad
    rows.forEach((row, i) => {
      drawPdfIcon(ctx, x + pad, cy + (rowH - iconSize) / 2, iconSize)
      ctx.fillStyle = '#333'; ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
      drawWrappedLines(ctx, row.lines, x + pad + iconSize + 14, cy + Math.max(fontSize + 8, (row.height - row.lines.length * (fontSize + 8)) / 2 + fontSize), fontSize + 8, fontSize, 12)
      if (i < rows.length - 1) {
        ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.moveTo(x + pad, cy + row.height); ctx.lineTo(x + width - pad, cy + row.height); ctx.stroke()
      }
      cy += row.height
    })
  }

  if (style === 'folder') {
    fillBg('#f1c46b'); ctx.fillStyle = '#fff2cf'; ctx.beginPath(); ctx.roundRect(70, 150, CANVAS_W - 140, CANVAS_H - 220, 34); ctx.fill()
    titleText(158, 145, '#7a4306', 54, 'left'); drawPage({ x: 285, y: 300, w: 650, h: 950 }); drawOverlay(655, 1150, 510)
  } else if (style === 'desk') {
    fillBg('#eef7f2'); ctx.fillStyle = '#f8e2cf'; ctx.save(); ctx.translate(-140, 1060); ctx.rotate(-0.14); ctx.fillRect(0, 0, 1120, 320); ctx.restore()
    titleText(90, 120, '#814c1d', 54, 'left'); drawPage({ x: 120, y: 230, w: 660, h: 980, rotate: -3 }); drawOverlay(645, 1120, 520)
  } else if (style === 'stamp') {
    fillBg('#fff8f1', borderColor); ctx.strokeStyle = '#d92727'; ctx.lineWidth = 6; ctx.strokeRect(42, 42, CANVAS_W - 84, CANVAS_H - 84)
    titleText(CANVAS_W / 2, 96, '#d92727', 58); drawPage({ x: 130, y: 205, w: 680, h: 1045, r: 10 }); drawOverlay(655, 1135, 520)
  } else if (style === 'split') {
    fillBg('#eef7ff'); ctx.fillStyle = '#fff7e6'; ctx.fillRect(0, 0, 430, CANVAS_H)
    titleText(88, 180, '#9a4e00', 46, 'left'); drawPage({ x: 485, y: 130, w: 650, h: 965 }); drawOverlay(88, 945, 430)
  } else if (style === 'phone') {
    fillBg('#101827'); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(210, 58, 820, 1540, 70); ctx.fill()
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 18; ctx.beginPath(); ctx.roundRect(210, 58, 820, 1540, 70); ctx.stroke()
    titleText(290, 190, '#111827', 44, 'left'); drawPage({ x: 315, y: 275, w: 610, h: 895, r: 14 }); drawOverlay(330, 1215, 580)
  } else if (style === 'blueprint') {
    fillBg('#123b66'); drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#ffffff', 0.10, 42)
    titleText(92, 138, '#fff', 48, 'left'); drawPage({ x: 115, y: 240, w: 670, h: 980, r: 10 }); drawOverlay(660, 1110, 510)
  } else {
    fillBg('#fff'); ctx.fillStyle = '#111827'; ctx.fillRect(72, 0, 28, CANVAS_H)
    titleText(150, 122, '#111827', 48, 'left'); ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 172); ctx.lineTo(930, 172); ctx.stroke()
    drawPage({ x: 150, y: 240, w: 650, h: 970, r: 2, shadow: false }); ctx.strokeStyle = '#111827'; ctx.strokeRect(150, 240, 650, 970); drawOverlay(610, 1120, 520)
  }
  return offscreenToDataUrl(canvas)
}

// ── PDF 第一页渲染（OffscreenCanvas 版）─────────────────────────────
async function renderPdfPage(pdfPath) {
  const url = _apiBase + `/api/baidu/proxy-pdf?path=${encodeURIComponent(pdfPath)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${_token}` } })
  if (!res.ok) throw new Error(`PDF加载失败 (${res.status})`)
  const buffer = await res.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer, disableWorker: true }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = new OffscreenCanvas(viewport.width, viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  await applyPdfMosaic(canvas, page, viewport)
  return canvas  // 返回 OffscreenCanvas（可传入 buildHistoryComposite）
}

async function renderPdfPages(pdfPath, count = 4) {
  const url = _apiBase + `/api/baidu/proxy-pdf?path=${encodeURIComponent(pdfPath)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${_token}` } })
  if (!res.ok) throw new Error(`PDF加载失败 (${res.status})`)
  const buffer = await res.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer, disableWorker: true }).promise
  const pages = []
  for (let i = 1; i <= Math.min(count, doc.numPages); i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = new OffscreenCanvas(viewport.width, viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    await applyPdfMosaic(canvas, page, viewport)
    pages.push(canvas)
  }
  while (pages.length < count && pages.length) pages.push(pages[pages.length - 1])
  return pages
}

async function buildPdfGridComposite(pageCanvases, borderColor, style = 'classic', titleText = '', titleStyle = 'solidRed') {
  const CANVAS_W = 1242, CANVAS_H = 1656
  const canvas = new OffscreenCanvas(CANVAS_W, CANVAS_H)
  const ctx = canvas.getContext('2d')
  const imgs = await Promise.all(pageCanvases.map(c => createImageBitmap(c)))
  const active = PDF_GRID_STYLES.includes(style) ? style : 'classic'

  const bg = (fill, border = null) => {
    ctx.fillStyle = fill; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 12; ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12) }
  }
  const page = (img, rect, opts = {}) => {
    const { x, y, w, h, r = 18, rotate = 0 } = rect
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rotate * Math.PI / 180)
    ctx.shadowColor = opts.shadow === false ? 'transparent' : (opts.shadowColor || 'rgba(0,0,0,.22)')
    ctx.shadowBlur = opts.shadow === false ? 0 : 12
    ctx.shadowOffsetY = opts.shadow === false ? 0 : 6
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.clip()
    const scale = Math.min(w / img.width, h / img.height)
    const dw = img.width * scale, dh = img.height * scale
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }
  const title = (text, x, y, fill, color = '#fff') => {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, 430, 70, 35); ctx.fill()
    ctx.fillStyle = color; ctx.font = 'bold 36px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, x + 215, y + 35); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  }
  const drawTitleOverlay = (text, titleStyleName) => {
    if (!text) return
    const cx = CANVAS_W / 2
    const cy = CANVAS_H * 0.50
    const fontSize = 82
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    const tw = ctx.measureText(text).width
    if (titleStyleName === 'pill') {
      const padX = fontSize * 0.65
      const padY = fontSize * 0.42
      const bw = Math.min(CANVAS_W - 120, tw + padX * 2)
      const bh = fontSize + padY * 2
      ctx.fillStyle = 'rgba(20,20,20,0.66)'
      ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(text, cx, cy)
    } else if (titleStyleName === 'stroke') {
      ctx.lineWidth = 8
      ctx.strokeStyle = 'rgba(0,0,0,.9)'
      ctx.lineJoin = 'round'
      ctx.strokeText(text, cx, cy)
      ctx.fillStyle = '#fff'
      ctx.fillText(text, cx, cy)
    } else if (titleStyleName === 'card') {
      const padX = fontSize * 0.8
      const padY = fontSize * 0.55
      const bw = Math.min(CANVAS_W - 120, Math.max(tw + padX * 2, CANVAS_W * 0.42))
      const bh = fontSize + padY * 2
      ctx.shadowColor = 'rgba(0,0,0,.24)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 12
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 22); ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.roundRect(cx - bw / 2 + 3, cy - bh / 2 + 3, bw - 6, bh - 6, 19); ctx.stroke()
      ctx.fillStyle = '#1a1a1a'
      ctx.fillText(text, cx, cy + fontSize * 0.08)
    } else if (titleStyleName === 'shadow') {
      ctx.shadowColor = 'rgba(0,0,0,.88)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = 5
      ctx.fillStyle = '#fff'
      ctx.fillText(text, cx, cy)
    } else {
      const padX = fontSize * 0.72
      const padY = fontSize * 0.38
      const bw = Math.min(CANVAS_W - 120, tw + padX * 2)
      const bh = fontSize + padY * 2
      const grad = ctx.createLinearGradient(cx - bw / 2, cy, cx + bw / 2, cy)
      grad.addColorStop(0, '#ff6b35')
      grad.addColorStop(1, '#ff2d55')
      ctx.shadowColor = 'rgba(255,45,85,.35)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 8
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = '#fff'
      ctx.fillText(text, cx, cy)
    }
    ctx.restore()
  }
  const four = (cells, opts = {}) => cells.forEach((r, i) => page(imgs[i], r, opts))

  if (active === 'desk') {
    bg('#f7efe2'); ctx.fillStyle = '#e8f4ec'; ctx.fillRect(0, 1030, CANVAS_W, 626)
    four([{ x: 92, y: 120, w: 520, h: 650, rotate: -3 }, { x: 620, y: 160, w: 500, h: 620, rotate: 2.5 }, { x: 120, y: 815, w: 500, h: 620, rotate: 2 }, { x: 640, y: 790, w: 500, h: 650, rotate: -2.5 }])
    title('真题先刷，少走弯路', 406, 760, '#fff4c4', '#814c1d')
  } else if (active === 'folder') {
    bg('#f1c46b'); ctx.fillStyle = '#fff2cf'; ctx.beginPath(); ctx.roundRect(56, 126, CANVAS_W - 112, CANVAS_H - 176, 30); ctx.fill()
    four([{ x: 98, y: 200, w: 490, h: 570 }, { x: 654, y: 200, w: 490, h: 570 }, { x: 98, y: 848, w: 490, h: 570 }, { x: 654, y: 848, w: 490, h: 570 }])
  } else if (active === 'phone') {
    bg('#101827'); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(162, 62, 918, 1532, 70); ctx.fill()
    four([{ x: 238, y: 260, w: 352, h: 470 }, { x: 652, y: 260, w: 352, h: 470 }, { x: 238, y: 806, w: 352, h: 470 }, { x: 652, y: 806, w: 352, h: 470 }])
  } else if (active === 'stamp') {
    bg('#fff8f1', borderColor); ctx.strokeStyle = '#d92727'; ctx.lineWidth = 6; ctx.strokeRect(42, 42, CANVAS_W - 84, CANVAS_H - 84)
    four([{ x: 88, y: 132, w: 500, h: 620 }, { x: 654, y: 132, w: 500, h: 620 }, { x: 88, y: 884, w: 500, h: 620 }, { x: 654, y: 884, w: 500, h: 620 }])
  } else if (active === 'checklist') {
    bg('#eaf4ff'); four([{ x: 70, y: 130, w: 430, h: 560, rotate: -1.5 }, { x: 70, y: 860, w: 430, h: 560, rotate: 1.2 }, { x: 690, y: 140, w: 450, h: 560, rotate: 1.5 }, { x: 690, y: 862, w: 450, h: 560, rotate: -1.2 }])
    title('整理真题，汇总高频考点', 410, 770, borderColor)
  } else if (active === 'blueprint') {
    bg('#123b66'); drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#ffffff', 0.12, 42)
    four([{ x: 86, y: 205, w: 500, h: 570 }, { x: 656, y: 205, w: 500, h: 570 }, { x: 86, y: 850, w: 500, h: 570 }, { x: 656, y: 850, w: 500, h: 570 }], { shadowColor: 'rgba(0,0,0,.3)' })
  } else if (active === 'album') {
    bg('#111827'); ctx.fillStyle = '#f9fafb'; ctx.beginPath(); ctx.roundRect(58, 70, CANVAS_W - 116, CANVAS_H - 140, 34); ctx.fill()
    four([{ x: 96, y: 218, w: 500, h: 560, r: 6 }, { x: 646, y: 218, w: 500, h: 560, r: 6 }, { x: 96, y: 848, w: 500, h: 560, r: 6 }, { x: 646, y: 848, w: 500, h: 560, r: 6 }], { shadow: false })
  } else if (active === 'pinboard') {
    bg('#fefce8'); four([{ x: 96, y: 165, w: 486, h: 565, rotate: -1 }, { x: 660, y: 165, w: 486, h: 565, rotate: 1 }, { x: 96, y: 885, w: 486, h: 565, rotate: 1 }, { x: 660, y: 885, w: 486, h: 565, rotate: -1 }])
    title('回忆版真题', 456, 770, '#111827')
  } else if (active === 'minimalLine') {
    bg('#ffffff'); ctx.fillStyle = '#111827'; ctx.fillRect(74, 0, 24, CANVAS_H)
    four([{ x: 150, y: 215, w: 450, h: 540, r: 2 }, { x: 680, y: 215, w: 450, h: 540, r: 2 }, { x: 150, y: 875, w: 450, h: 540, r: 2 }, { x: 680, y: 875, w: 450, h: 540, r: 2 }], { shadow: false })
  } else {
    bg('#f2f2f2', borderColor)
    const pad = 32, gap = 20, w = Math.floor((CANVAS_W - pad * 2 - gap) / 2), h = Math.floor((CANVAS_H - pad * 2 - gap) / 2)
    four([{ x: pad, y: pad, w, h }, { x: pad + w + gap, y: pad, w, h }, { x: pad, y: pad + h + gap, w, h }, { x: pad + w + gap, y: pad + h + gap, w, h }])
  }
  drawTitleOverlay(titleText, titleStyle)
  return offscreenToDataUrl(canvas)
}

// ── buildDirImageForBatch（Worker 版）──────────────────────────────
async function buildDirImageForBatch(path, type, title, onlyDir, bgUrl, dirStyle, pdfSingleStyle = 'classic') {
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
          return await buildHistoryComposite(pdfCanvas, files, _borderColor, title, pickBgColor(), 0.35, bgUrl, pdfSingleStyle)
        } catch (_) {}
      }
    }
    return renderCompositeImage(files, title, _borderColor, pickBgColor(), 0.35, bgUrl, dirStyle)
  }
  if (type === 'custom') {
    if (!onlyDir) {
      const pdfs = files.filter(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
      if (pdfs.length) {
        try {
          const pdfCanvas = await renderPdfPage(rndPick(pdfs).path)
          return await buildHistoryComposite(pdfCanvas, files, _borderColor, title, pickBgColor(), 0.35, bgUrl, pdfSingleStyle)
        } catch (_) {}
      }
    }
  }
  return renderCompositeImage(files, title, _borderColor, pickBgColor(), 0.35, bgUrl, dirStyle)
}

async function buildPaperImageForBatch(path, type, mode, pdfGridStyle, pdfSingleStyle, title, pdfGridTitleStyle) {
  const res = await getBaiduFilesWithRetry(path)
  const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
  if (!files.length) throw new Error('目录为空')
  const keyword = type === 'mock' ? '2026' : '2025'
  const pdf = files.find(f => f.isdir === 0 && f.name.includes(keyword)) || files.find(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
  if (!pdf) throw new Error('未找到PDF试题文件')
  if (mode === 'examGrid') {
    const pages = await renderPdfPages(pdf.path, 4)
    return buildPdfGridComposite(pages, _borderColor, pdfGridStyle, title, pdfGridTitleStyle)
  }
  const pdfCanvas = await renderPdfPage(pdf.path)
  const singleTitle = title || (type === 'mock' ? (rndPick(_MOCK_TITLE_POOL) || '模拟题目录') : (rndPick(_HISTORY_TITLE_POOL) || '真题目录'))
  return buildHistoryComposite(pdfCanvas, files, _borderColor, singleTitle, pickBgColor(), 0.35, null, pdfSingleStyle)
}

function normalizeCardStyle(input) {
  if (input?.id && Array.isArray(input.schemes)) {
    return {
      id: input.id,
      scheme: rndPick(input.schemes) || {},
    }
  }
  return { id: 'basic', scheme: input || { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' } }
}

const CARD_TEMPLATE_STYLES = [
  'poster','check','tags','folder','note2','mono','exam','stamp','dark2','app',
  'course','wrong','side','gridnote','paperclip','blue','photo','cutout','softpink','greenfile',
  'orangeburst','blueprint_card','receipt_card','neon','vertical','filetab','calendar_card','folderwall_card','outline_card','cream_card','stamp2','marker',
]

function splitCardText(text) {
  const raw = String(text || '').trim()
  const m = raw.match(/^(.+?笔试)[，,、\s]*(.*)$/)
  if (m) return { main: m[1], sub: m[2] || '备考资料已整理' }
  const comma = raw.search(/[，,]/)
  if (comma > 0) return { main: raw.slice(0, comma), sub: raw.slice(comma + 1) }
  return { main: raw, sub: '备考资料已整理' }
}

function wrapCardLines(ctx, text, maxWidth) {
  const lines = []
  let cur = ''
  for (const ch of String(text || '')) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function drawCardLines(ctx, lines, x, y, lineHeight, maxLines = 5) {
  lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight))
}

function drawRightHint(ctx, W, H, scale, color = '#1a1a1a', highlight = '#ffea7a') {
  const text = '左滑查看更多备考资料'
  const fontSize = 22 * scale
  const right = 40 * scale
  const y = H - 128 * scale
  ctx.font = `bold ${fontSize}px "PingFang SC", "Helvetica Neue", sans-serif`
  ctx.textBaseline = 'top'
  const w = ctx.measureText(text).width
  ctx.fillStyle = highlight
  ctx.fillRect(W - right - w, y + fontSize * 0.55, w, fontSize * 0.48)
  ctx.fillStyle = color
  ctx.fillText(text, W - right - w, y)
}

function drawTemplateCardBackground(ctx, W, H, style, scale) {
  const r = 22 * scale
  ctx.clearRect(0, 0, W, H)
  if (style === 'poster') {
    ctx.fillStyle = '#eef4ff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#7a35d8'; ctx.fillRect(0, 0, 18 * scale, H)
  } else if (style === 'check') {
    ctx.fillStyle = '#28c985'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#f0fff7'; ctx.beginPath(); ctx.roundRect(10 * scale, 10 * scale, W - 20 * scale, H - 20 * scale, r - 8 * scale); ctx.fill()
  } else if (style === 'tags') {
    ctx.fillStyle = '#fffdf8'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.globalAlpha = 0.75
    ctx.fillStyle = '#fff4b8'; ctx.beginPath(); ctx.arc(W * 0.22, H * 0.18, 120 * scale, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#bcecff'; ctx.beginPath(); ctx.arc(W * 0.88, H * 0.82, 130 * scale, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  } else if (style === 'folder') {
    ctx.fillStyle = '#fff7d7'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#ffd15d'; ctx.beginPath(); ctx.roundRect(0, 0, 210 * scale, 58 * scale, 0); ctx.fill()
  } else if (style === 'note2') {
    ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillRect(W / 2 - 49 * scale, 0, 98 * scale, 28 * scale)
  } else if (style === 'mono') {
    ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.lineWidth = 2 * scale; ctx.strokeStyle = '#111'; ctx.stroke()
  } else if (style === 'exam') {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#ffefe8'); grad.addColorStop(0.48, '#ffffff'); grad.addColorStop(0.49, '#edf5ff')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'stamp') {
    ctx.fillStyle = '#df3434'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#fff8f8'; ctx.beginPath(); ctx.roundRect(10 * scale, 10 * scale, W - 20 * scale, H - 20 * scale, r - 8 * scale); ctx.fill()
  } else if (style === 'dark2' || style === 'cutout' || style === 'neon') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, style === 'neon' ? '#0f1020' : '#111827'); grad.addColorStop(1, '#1f2937')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'app') {
    ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(26 * scale, 26 * scale, W - 52 * scale, H - 52 * scale, r); ctx.fill()
  } else if (style === 'course') {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#1877f2'; ctx.fillRect(0, 0, W, 18 * scale)
  } else if (style === 'wrong') {
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.strokeStyle = '#e9d8b8'; ctx.lineWidth = 1 * scale
    for (let y = 36 * scale; y < H; y += 35 * scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  } else if (style === 'side') {
    ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#1677ff'; ctx.fillRect(W - 18 * scale, 0, 18 * scale, H)
  } else if (style === 'gridnote') {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.strokeStyle = '#edf5ff'; ctx.lineWidth = 1 * scale
    for (let x = 0; x < W; x += 28 * scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 28 * scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  } else if (style === 'paperclip') {
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.lineWidth = 7 * scale; ctx.strokeStyle = '#9ca3af'; ctx.beginPath(); ctx.roundRect(W - 72 * scale, 28 * scale, 38 * scale, 76 * scale, 20 * scale); ctx.stroke()
  } else if (style === 'blue') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#eaf4ff'); grad.addColorStop(1, '#ffffff')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'photo') {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#e8f4ec'); grad.addColorStop(1, '#fff3e1')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.beginPath(); ctx.roundRect(32 * scale, H - 190 * scale, W - 64 * scale, 84 * scale, 18 * scale); ctx.fill()
  } else if (style === 'softpink') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#fff0f5'); grad.addColorStop(1, '#ffffff')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'greenfile') {
    ctx.fillStyle = '#ecfdf5'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#10b981'; ctx.fillRect(0, 0, 18 * scale, H)
  } else if (style === 'orangeburst') {
    ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#fed7aa'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.2, 130 * scale, 0, Math.PI * 2); ctx.fill()
  } else if (style === 'blueprint_card') {
    ctx.fillStyle = '#123b66'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1 * scale
    for (let x = 0; x < W; x += 26 * scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 26 * scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  } else if (style === 'receipt_card') {
    ctx.fillStyle = '#f7f1e5'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#fffdf7'; ctx.beginPath(); ctx.roundRect(24 * scale, 24 * scale, W - 48 * scale, H - 48 * scale, 8 * scale); ctx.fill()
  } else if (style === 'vertical') {
    ctx.fillStyle = '#fffdf7'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'filetab') {
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#c7d2fe'; ctx.beginPath(); ctx.roundRect(0, 0, 180 * scale, 54 * scale, 0); ctx.fill()
  } else if (style === 'calendar_card') {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#ef4444'; ctx.fillRect(0, 0, W, 62 * scale)
  } else if (style === 'folderwall_card') {
    ctx.fillStyle = '#fff7d6'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'outline_card') {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#2563eb'; ctx.fillRect(34 * scale, 64 * scale, 8 * scale, 170 * scale)
  } else if (style === 'cream_card') {
    ctx.fillStyle = '#e8cfa7'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
    ctx.fillStyle = '#fff8ed'; ctx.beginPath(); ctx.roundRect(12 * scale, 12 * scale, W - 24 * scale, H - 24 * scale, r - 8 * scale); ctx.fill()
  } else if (style === 'stamp2') {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else if (style === 'marker') {
    ctx.fillStyle = '#fefce8'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, r); ctx.fill()
  } else {
    drawCardBackground(ctx, W, H, r, style, {}, scale)
  }
}

function getTemplateCardPalette(style) {
  if (['dark2', 'cutout', 'neon', 'blueprint_card'].includes(style)) {
    return { text: '#ffffff', sub: '#e5edf8', accent: '#7dd3fc', highlight: 'rgba(125,211,252,0.28)', hint: '#ffffff', hintHighlight: 'rgba(255,234,122,0.24)' }
  }
  if (['stamp', 'stamp2', 'exam', 'calendar_card'].includes(style)) {
    return { text: '#1f2328', sub: '#2f3338', accent: '#df2f2f', highlight: 'rgba(255,224,92,0.76)', hint: '#171a1f', hintHighlight: 'rgba(255,224,92,0.82)' }
  }
  if (['check', 'greenfile'].includes(style)) {
    return { text: '#123c2a', sub: '#23614a', accent: '#10b981', highlight: 'rgba(134,239,172,0.68)', hint: '#123c2a', hintHighlight: 'rgba(252,231,98,0.75)' }
  }
  if (['folder', 'folderwall_card', 'cream_card', 'receipt_card', 'note2', 'wrong'].includes(style)) {
    return { text: '#3c2f1f', sub: '#66533b', accent: '#d97706', highlight: 'rgba(255,218,94,0.72)', hint: '#3c2f1f', hintHighlight: 'rgba(255,218,94,0.78)' }
  }
  if (['blue', 'side', 'course', 'filetab', 'outline_card', 'app'].includes(style)) {
    return { text: '#162033', sub: '#334155', accent: '#2563eb', highlight: 'rgba(147,197,253,0.48)', hint: '#162033', hintHighlight: 'rgba(255,234,122,0.72)' }
  }
  return { text: '#171a20', sub: '#313640', accent: '#7c3aed', highlight: 'rgba(255,234,122,0.78)', hint: '#171a20', hintHighlight: 'rgba(255,234,122,0.82)' }
}

function drawTemplateTag(ctx, x, y, text, fill, color, scale) {
  ctx.font = `bold ${13 * scale}px "PingFang SC", "Helvetica Neue", sans-serif`
  const w = ctx.measureText(text).width + 18 * scale
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.roundRect(x, y, w, 26 * scale, 13 * scale); ctx.fill()
  ctx.fillStyle = color
  ctx.fillText(text, x + 9 * scale, y + 6 * scale)
  return w
}

function drawTemplateCardTitle(ctx, lines, x, y, maxWidth, style, palette, scale) {
  const fontSize = (['poster', 'stamp2', 'marker'].includes(style) ? 38 : 34) * scale
  const lineHeight = fontSize * 1.22
  ctx.textBaseline = 'top'
  lines.slice(0, 4).forEach((line, i) => {
    const yy = y + i * lineHeight
    const w = Math.min(ctx.measureText(line).width, maxWidth)
    if (style === 'stamp2') {
      ctx.lineWidth = 2 * scale
      ctx.strokeStyle = palette.accent
      ctx.beginPath(); ctx.roundRect(x - 3 * scale, yy - 3 * scale, w + 10 * scale, fontSize + 8 * scale, 5 * scale); ctx.stroke()
    } else if (['cutout', 'gridnote', 'folderwall_card'].includes(style)) {
      ctx.fillStyle = style === 'cutout' ? 'rgba(255,255,255,0.12)' : '#ffffff'
      ctx.beginPath(); ctx.roundRect(x - 6 * scale, yy - 2 * scale, w + 14 * scale, fontSize + 8 * scale, 8 * scale); ctx.fill()
    } else if (style === 'blueprint_card') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1.5 * scale
      ctx.beginPath(); ctx.roundRect(x - 5 * scale, yy - 3 * scale, w + 14 * scale, fontSize + 8 * scale, 5 * scale); ctx.stroke()
    } else {
      ctx.fillStyle = palette.highlight
      ctx.fillRect(x, yy + fontSize * 0.55, w, fontSize * 0.42)
    }
    ctx.fillStyle = palette.text
    ctx.fillText(line, x, yy)
  })
  return y + Math.min(lines.length, 4) * lineHeight
}

function drawTemplateCardDecor(ctx, W, H, style, palette, scale) {
  ctx.save()
  if (style === 'stamp2') {
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = 2.5 * scale
    ctx.beginPath(); ctx.arc(W - 70 * scale, 65 * scale, 36 * scale, 0, Math.PI * 2); ctx.stroke()
    ctx.font = `bold ${16 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'; ctx.fillStyle = palette.accent; ctx.fillText('备考', W - 70 * scale, 58 * scale); ctx.fillText('资料', W - 70 * scale, 78 * scale)
    ctx.textAlign = 'left'
  } else if (style === 'check') {
    ctx.fillStyle = palette.accent
    ;['真题', '模拟', '公基'].forEach((t, i) => {
      const y = 275 * scale + i * 33 * scale
      ctx.beginPath(); ctx.arc(56 * scale, y + 8 * scale, 8 * scale, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * scale; ctx.beginPath(); ctx.moveTo(51 * scale, y + 8 * scale); ctx.lineTo(56 * scale, y + 13 * scale); ctx.lineTo(64 * scale, y + 3 * scale); ctx.stroke()
      ctx.fillStyle = palette.sub; ctx.font = `600 ${15 * scale}px "PingFang SC", sans-serif`; ctx.fillText(`${t}资料已整理`, 75 * scale, y)
      ctx.fillStyle = palette.accent
    })
  } else if (style === 'tags') {
    let x = 42 * scale, y = 282 * scale
    ;['资料齐全', '重点清晰', '备考省心'].forEach((t, i) => {
      const w = drawTemplateTag(ctx, x, y, t, ['#fff4b8', '#dbeafe', '#dcfce7'][i], '#1f2937', scale)
      x += w + 8 * scale
    })
  } else if (style === 'calendar_card') {
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${18 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('备考清单', 36 * scale, 20 * scale)
  } else if (style === 'vertical') {
    ctx.strokeStyle = '#e5decf'; ctx.lineWidth = 1 * scale
    for (let x = 68 * scale; x < W - 35 * scale; x += 36 * scale) {
      ctx.beginPath(); ctx.moveTo(x, 44 * scale); ctx.lineTo(x, H - 76 * scale); ctx.stroke()
    }
  } else if (style === 'marker') {
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 4 * scale
    ctx.beginPath(); ctx.moveTo(42 * scale, 86 * scale); ctx.lineTo(W - 56 * scale, 72 * scale); ctx.stroke()
  }
  ctx.restore()
}

async function renderTemplateCardImage(text, templateStyle) {
  const SCALE = 3
  const W = 360 * SCALE, H = 480 * SCALE
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const style = templateStyle || rndPick(CARD_TEMPLATE_STYLES)
  const palette = getTemplateCardPalette(style)
  drawTemplateCardBackground(ctx, W, H, style, SCALE)
  drawTemplateCardDecor(ctx, W, H, style, palette, SCALE)

  const { main, sub } = splitCardText(text)
  const x = style === 'app' || style === 'receipt_card' ? 48 * SCALE : 38 * SCALE
  const maxWidth = W - x - (style === 'side' ? 58 * SCALE : 38 * SCALE)
  const top = ['folder', 'filetab', 'calendar_card'].includes(style) ? 78 * SCALE : 86 * SCALE
  ctx.font = `900 ${(['poster', 'stamp2', 'marker'].includes(style) ? 38 : 34) * SCALE}px "PingFang SC", "Helvetica Neue", sans-serif`
  const titleLines = wrapCardLines(ctx, main, maxWidth)
  const afterTitleY = drawTemplateCardTitle(ctx, titleLines, x, top, maxWidth, style, palette, SCALE)

  ctx.textBaseline = 'top'
  ctx.fillStyle = palette.sub
  ctx.font = `800 ${24 * SCALE}px "PingFang SC", "Helvetica Neue", sans-serif`
  const subLines = wrapCardLines(ctx, sub || '备考资料已整理', maxWidth)
  drawCardLines(ctx, subLines, x, afterTitleY + 24 * SCALE, 35 * SCALE, 4)

  ctx.fillStyle = palette.accent
  ctx.beginPath(); ctx.roundRect(x, H - 78 * SCALE, 40 * SCALE, 5 * SCALE, 3 * SCALE); ctx.fill()
  drawRightHint(ctx, W, H, SCALE, palette.hint, palette.hintHighlight)
  return offscreenToDataUrl(canvas)
}

// ── 卡片图（与生成笔记抽屉风格池保持一致，OffscreenCanvas 版）────────────
async function renderCardImage(text, styleInput) {
  if (Math.random() < 0.85) {
    return renderTemplateCardImage(text, rndPick(CARD_TEMPLATE_STYLES))
  }
  const picked = normalizeCardStyle(styleInput)
  const style = picked.id
  const scheme = picked.scheme
  const SCALE = 3
  const W = 360 * SCALE, H = 480 * SCALE
  const PAD_L = 40 * SCALE, PAD_R = 40 * SCALE, PAD_T = 44 * SCALE, PAD_B = 36 * SCALE
  const RADIUS = 20 * SCALE
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')
  drawCardBackground(ctx, W, H, RADIUS, style, scheme, SCALE)
  const accent = scheme.accent || scheme.border || scheme.ribbon || scheme.quoteColor || '#52c07a'
  const textColor = scheme.text || '#1a1a1a'
  const showQuote = !['minimal', 'border', 'note', 'kraft'].includes(style)
  const QUOTE_FONT_SIZE = showQuote ? 72 * SCALE : 0
  if (showQuote) {
    ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = accent
    ctx.font = `bold ${QUOTE_FONT_SIZE}px Georgia, serif`; ctx.textBaseline = 'top'
    ctx.fillText(style === 'geometric' ? '\u201D' : '\u201C', PAD_L, PAD_T); ctx.restore()
  }
  if (style === 'minimal') {
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.roundRect(0, 0, 8 * SCALE, H, 2 * SCALE); ctx.fill()
  }
  if (style === 'note') {
    ctx.fillStyle = scheme.tape || 'rgba(255,255,255,0.7)'
    ctx.beginPath(); ctx.roundRect(W / 2 - 44 * SCALE, 0, 88 * SCALE, 24 * SCALE, 0); ctx.fill()
  }
  if (style === 'kraft') {
    drawKraftDecoration(ctx, W, H, scheme, SCALE)
  }
  const FONT_SIZE = 36 * SCALE
  const LINE_HEIGHT = FONT_SIZE * 1.75
  const TEXT_TOP = PAD_T + (showQuote ? QUOTE_FONT_SIZE * 0.8 + 16 * SCALE : 68 * SCALE)
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
      if (!['geometric', 'border'].includes(style)) {
        ctx.fillStyle = HL_COLOR; ctx.fillRect(x, y + FONT_SIZE * 0.55, hlW, FONT_SIZE * 0.47)
      }
      ctx.fillStyle = textColor; ctx.fillText(hlPart, x, y); x += hlW
    }
    if (normalPart) { ctx.font = FONT_NORMAL; ctx.fillStyle = textColor; ctx.fillText(normalPart, x, y) }
    y += LINE_HEIGHT
  }
  const BAR_W = 40 * SCALE
  ctx.fillStyle = accent
  ctx.beginPath(); ctx.roundRect(PAD_L, H - PAD_B - BAR_H, BAR_W, BAR_H, 2 * SCALE); ctx.fill()
  // ─── 底部固定文字：左滑查看更多备考资料（重点样式，同 xxx笔试 高亮）──
  const BTM_FONT_SIZE = 22 * SCALE
  const BTM_TEXT = '左滑查看更多备考资料'
  ctx.font = `bold ${BTM_FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`
  ctx.textBaseline = 'top'
  const btmTextW = ctx.measureText(BTM_TEXT).width
  const btmX = W - PAD_R - btmTextW
  const btmY = H - 160 - BTM_FONT_SIZE
  if (!['geometric', 'border'].includes(style)) {
    ctx.fillStyle = HL_COLOR; ctx.fillRect(btmX, btmY + BTM_FONT_SIZE * 0.55, btmTextW, BTM_FONT_SIZE * 0.47)
  }
  ctx.fillStyle = textColor; ctx.fillText(BTM_TEXT, btmX, btmY)
  return offscreenToDataUrl(canvas)
}

function drawCardBackground(ctx, W, H, radius, style, scheme, scale) {
  if (style === 'diffuse') {
    ctx.fillStyle = scheme.bg || '#dff4e3'
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, radius); ctx.fill()
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = scheme.circle || 'rgba(200,230,201,0.72)'
    ctx.beginPath(); ctx.arc(W * 0.28, H * 0.25, W * 0.42, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.78, W * 0.36, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    return
  }
  ctx.fillStyle = scheme.bg || '#d4f7d4'
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, radius); ctx.fill()
  if (style === 'border') {
    ctx.lineWidth = 10 * scale
    ctx.strokeStyle = scheme.border || '#ff7043'
    ctx.stroke()
  }
}

function drawKraftDecoration(ctx, W, H, scheme, scale) {
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = scheme.ribbon || '#e89aa6'
  ctx.lineWidth = 2 * scale
  ctx.beginPath(); ctx.moveTo(30 * scale, 8 * scale); ctx.lineTo(30 * scale, 70 * scale); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(20 * scale, 16 * scale); ctx.lineTo(40 * scale, 16 * scale); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W - 58 * scale, H - 86 * scale); ctx.lineTo(W - 24 * scale, H - 86 * scale); ctx.stroke()
  ctx.restore()
}

// ── 主批量循环 ───────────────────────────────────────────────────────
async function runBatch({ productDetails, onlyDirImages, generationMode = 'complete', bgPool, borderColor, titlePool, historyTitlePool, mockTitlePool, cardSchemes }) {
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
    const dirStyle = rndPick(DIR_IMAGE_STYLES) || 'classic'
    const pdfGridStyle = rndPick(PDF_GRID_STYLES) || 'classic'
    const pdfGridTitleStyle = rndPick(PDF_GRID_TITLE_STYLES) || 'solidRed'
    const pdfSingleStyle = rndPick(PDF_SINGLE_STYLES) || 'classic'

    // 构建任务列表（与主线程逻辑一致）
    const tasks = []
    if (generationMode === 'dirOnly') {
      if (detail.baidu_path_history) tasks.push({ path: detail.baidu_path_history, type: 'history', label: '真题目录', title: rndPick(_HISTORY_TITLE_POOL) || '真题目录' })
      if (detail.baidu_path_mock) tasks.push({ path: detail.baidu_path_mock, type: 'mock', label: '模拟题目录', title: rndPick(_MOCK_TITLE_POOL) || '模拟题目录' })
    } else if (generationMode === 'examGrid' || generationMode === 'examSingle') {
      if (detail.baidu_path_exam) tasks.push({ path: detail.baidu_path_exam, type: 'exam', label: '笔试资料目录', title: '笔试资料完整目录' })
      if (detail.baidu_path_history) tasks.push({ path: detail.baidu_path_history, type: 'historyPaper', sourceType: 'history', label: generationMode === 'examGrid' ? '真题拼图' : '真题单图', title: rndPick(_HISTORY_TITLE_POOL) || '真题目录' })
      if (detail.baidu_path_mock) tasks.push({ path: detail.baidu_path_mock, type: 'mockPaper', sourceType: 'mock', label: generationMode === 'examGrid' ? '模拟题拼图' : '模拟题单图', title: rndPick(_MOCK_TITLE_POOL) || '模拟题目录' })
    } else {
      if (detail.baidu_path_exam) {
        tasks.push({ path: detail.baidu_path_exam, type: 'exam', label: '笔试资料目录', title: '笔试资料完整目录' })
        tasks.push({ path: detail.baidu_path_exam, type: 'culture', label: '企业文化', title: '企业文化重点速览' })
      }
      if (detail.baidu_path_history) {
        tasks.push({ path: detail.baidu_path_history, type: 'history', label: '真题目录', title: rndPick(_HISTORY_TITLE_POOL) || '真题目录' })
      }
      if (detail.baidu_path_mock) {
        tasks.push({ path: detail.baidu_path_mock, type: 'mock', label: '模拟题目录', title: rndPick(_MOCK_TITLE_POOL) || '模拟题目录' })
      }
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
        if (task.type === 'historyPaper' || task.type === 'mockPaper') {
          dataUrl = await buildPaperImageForBatch(task.path, task.sourceType, generationMode, pdfGridStyle, pdfSingleStyle, task.title, pdfGridTitleStyle)
        } else if (task.type === 'culture') {
          const res = await getBaiduFilesWithRetry(task.path)
          const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
          const culturePdf = files.find(f => f.isdir === 0 && f.name.includes('企业文化'))
          if (!culturePdf) { log(`  └ ${task.label}：未找到"企业文化"PDF，跳过`, 'warn'); continue }
          const pdfCanvas = await renderPdfPage(culturePdf.path)
          dataUrl = await buildHistoryComposite(pdfCanvas, files, _borderColor, task.title, pickBgColor(), 0.35, productBgUrl, pdfSingleStyle)
        } else {
          const forceDirOnly = onlyDirImages || generationMode === 'complete'
          dataUrl = await buildDirImageForBatch(task.path, task.type, task.title, forceDirOnly, productBgUrl, dirStyle, pdfSingleStyle)
        }
        images.push({ label: task.label, base64: dataUrl.replace(/^data:image\/png;base64,/, '') })
        log(`  └ ${task.label} ✓`, 'success')
      } catch (e) {
        log(`  └ ${task.label} 失败：${e.message}`, 'error')
      }
    }

    // 生成卡片图
    // cardText 同步回主线程，作为笔记标题，保证卡片图文案与笔记标题完全一致
    let cardText = ''
    log(`  └ 生成卡片图中...`, 'info')
    try {
      const scheme = rndPick(_CARD_SCHEMES) || { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' }
      const cardTitle = rndPick(_TITLE_POOL) || ''
      cardText = `${detail.company_name || ''}笔试，${cardTitle}`
      const cardDataUrl = await renderCardImage(cardText, scheme)
      images.push({ label: '卡片图', base64: cardDataUrl.replace(/^data:image\/png;base64,/, '') })
      log(`  └ 卡片图 ✓`, 'success')
    } catch (e) {
      log(`  └ 卡片图失败：${e.message}`, 'error')
    }

    // 把本商品所有图片发回主线程（主线程负责：笔记生成 + docx + ZIP + 飞书）
    // cardText：卡片图使用的文案，主线程直接用于笔记标题，无需重新随机
    post({ type: 'product-images', id, company, images, cardText })

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
