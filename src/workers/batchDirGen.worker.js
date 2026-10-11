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
let _CARD_TITLE_TEMPLATE_POOL = []
let _USE_CARD_TITLE_TEMPLATES = false
let _CARD_SCHEMES = []
let _CARD_TEMPLATE_STYLE_BAG = []
let _CARD_SCHEME_BAG = []

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

function shuffledCopy(arr) {
  const list = [...(arr || [])]
  for (let i = list.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1)
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function buildCardText(detail) {
  const pool = _USE_CARD_TITLE_TEMPLATES ? _CARD_TITLE_TEMPLATE_POOL : _TITLE_POOL
  const suffix = rndPick(pool) || ''
  return `${detail?.company_name || ''}笔试，${suffix}`
}

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// OffscreenCanvas blob → base64 dataURL（FileReaderSync 在 Worker 中可用）
async function offscreenToDataUrl(canvas) {
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new FileReaderSync().readAsDataURL(blob)
}

function filterDirFilesByType(files, type) {
  if (type === 'history') {
    return (files || []).filter(file => !/模拟题|模拟试卷/.test(String(file?.name || '')))
  }
  if (type === 'mock') {
    return (files || []).filter(file => !String(file?.name || '').includes('真题'))
  }
  return files || []
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
  '党员','党建','时事政资','时事政治','时政',
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
  'year_card',
  'timeline_card',
  'ticket_card',
  'tag_card',
  'stagger_card',
  'grouped_card',
  'border_card',
  'block_grid',
  'ledger_table',
  'folder_tabs_square',
  'side_panel_square',
  'exam_checklist',
  'kanban_columns',
  'index_columns',
  'stamp_blocks',
  'barcode_list',
  'calendar_grid_square',
  'blueprint_rect',
  'rank_board',
  'file_stack_square',
  'step_bars',
  'block_overview',
]

const PDF_SINGLE_STYLES = [
  'classic', 'folder', 'desk', 'stamp', 'split', 'phone', 'blueprint', 'minimal',
  'examRed', 'fileStack', 'memoBoard', 'greenPlan', 'newspaper', 'blackGold',
  'blueRibbon', 'pinkHighlighter', 'indexTabs', 'gridCard', 'clipboard',
  'lectureSlide', 'ticket', 'magazine', 'focusRing',
  'aurora', 'lawPaper', 'sciLab', 'metro', 'receiptLong', 'glassLayer',
  'notebookBlue', 'kraftSeal', 'radialFocus', 'purplePortal', 'greenChalk',
  'windowDesk', 'archiveBox', 'orangeBurst', 'calmGray', 'blueprintDark',
  'foldedCorner', 'comicMarker', 'sideCatalog', 'redLedger',
]
const PDF_GRID_STYLES = ['classic', 'desk', 'folder', 'phone', 'stamp', 'checklist', 'blueprint', 'album', 'pinboard', 'stackedFocus', 'minimalLine']
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

const SQUARE_DIR_STYLES = [
  'block_grid', 'ledger_table', 'folder_tabs_square', 'side_panel_square', 'exam_checklist',
  'kanban_columns', 'index_columns', 'stamp_blocks', 'barcode_list', 'calendar_grid_square',
  'blueprint_rect', 'rank_board', 'file_stack_square', 'step_bars', 'block_overview',
]

function getSquareDirHeight(style, count) {
  const n = Math.max(1, count)
  if (['block_grid', 'stamp_blocks', 'blueprint_rect'].includes(style)) return 168 + Math.ceil(n / 2) * 112
  if (['kanban_columns', 'calendar_grid_square', 'block_overview'].includes(style)) return 206 + Math.ceil(n / 3) * 124
  if (style === 'index_columns') return 172 + Math.ceil(n / 2) * 112
  if (style === 'ledger_table') return 206 + n * 66
  if (style === 'side_panel_square') return 210 + n * 72
  if (style === 'exam_checklist') return 198 + n * 68
  if (style === 'folder_tabs_square') return 188 + n * 76
  if (style === 'file_stack_square') return 206 + n * 66
  return 190 + n * 66
}

function drawSquareTitle(ctx, title, style, W) {
  const dark = style === 'blueprint_rect'
  const accentMap = {
    block_grid: '#2563eb', ledger_table: '#ea580c', folder_tabs_square: '#0f766e',
    side_panel_square: '#e11d48', exam_checklist: '#4f46e5', kanban_columns: '#14b8a6',
    index_columns: '#be123c', stamp_blocks: '#ca8a04', barcode_list: '#0f172a',
    calendar_grid_square: '#2563eb', blueprint_rect: '#38bdf8', rank_board: '#65a30d',
    file_stack_square: '#9333ea', step_bars: '#f97316', block_overview: '#0ea5e9',
  }
  ctx.fillStyle = dark ? '#f8fafc' : '#111827'
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(title, 42, 58)
  ctx.fillStyle = accentMap[style] || '#2563eb'
  ctx.fillRect(42, 92, 96, 8)
  ctx.textBaseline = 'alphabetic'
}

function squareTextLines(ctx, text, maxWidth, x, y, lineHeight = 20, fontSize = 14, maxLines = 2) {
  const rawLines = wrapCanvasText(ctx, text, maxWidth)
  const lines = rawLines.slice(0, maxLines)
  if (rawLines.length > maxLines && lines.length) {
    let last = lines[lines.length - 1]
    while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last}...`
  }
  drawWrappedLines(ctx, lines, x, y, lineHeight, fontSize, 9)
}

async function renderSquareDirComposite(files, title, bgImageUrl, style) {
  const DPR = 2, W = 600
  const H = getSquareDirHeight(style, files.length)
  const canvas = new OffscreenCanvas(W * DPR, H * DPR)
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  if (bgImageUrl) {
    try {
      const bgImg = await loadBitmap(bgImageUrl)
      const scale = Math.max(W / bgImg.width, H / bgImg.height)
      const bw = bgImg.width * scale, bh = bgImg.height * scale
      ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fillRect(0, 0, W, H)
    } catch {
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H)
    }
  } else {
    const bg = style === 'ledger_table' ? '#fff7ed' : style === 'exam_checklist' ? '#eef2ff' : style === 'index_columns' ? '#fff1f2'
      : style === 'stamp_blocks' ? '#fefce8' : style === 'calendar_grid_square' ? '#eff6ff' : style === 'blueprint_rect' ? '#0f172a'
        : style === 'rank_board' ? '#f7fee7' : style === 'file_stack_square' ? '#faf5ff' : style === 'step_bars' ? '#fff7ed' : '#f8fafc'
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  }
  if (style === 'blueprint_rect') drawGridBg(ctx, 42, 128, W - 84, H - 176, '#60a5fa', 0.2, 36)
  drawSquareTitle(ctx, title, style, W)
  ctx.lineWidth = 2

  const numbered = (num, x, y, w, h, color, r = 4) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(num).padStart(2, '0'), x + w / 2, y + h / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  }

  if (style === 'ledger_table') {
    const x = 58, y = 132, w = 484, rowH = 66
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, rowH * (files.length + 1))
    ctx.strokeStyle = '#fed7aa'; ctx.strokeRect(x, y, w, rowH * (files.length + 1))
    ctx.fillStyle = '#ffedd5'; ctx.fillRect(x, y, w, rowH)
    ctx.fillStyle = '#111827'; ctx.font = 'bold 17px "PingFang SC", sans-serif'; ctx.fillText('序号', x + 42, y + 30); ctx.fillText('资料内容', x + 150, y + 30)
    files.forEach((file, i) => {
      const yy = y + rowH * (i + 1)
      ctx.strokeStyle = '#fed7aa'; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke()
      ctx.fillStyle = '#111827'; ctx.font = 'bold 18px Arial'; ctx.fillText(String(i + 1).padStart(2, '0'), x + 42, yy + 31)
      ctx.font = 'bold 16px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 318, x + 150, yy + 27, 21, 16)
    })
    ctx.beginPath(); ctx.moveTo(x + 106, y); ctx.lineTo(x + 106, y + rowH * (files.length + 1)); ctx.stroke()
  } else if (style === 'side_panel_square') {
    const x = 52, y = 132, panelW = 160, rowH = 72, totalH = rowH * files.length + 26
    ctx.fillStyle = '#111827'; ctx.fillRect(x, y, panelW, totalH)
    ctx.fillStyle = '#fff'; ctx.fillRect(x + panelW, y, 314, totalH)
    ctx.strokeStyle = '#e5e7eb'; ctx.strokeRect(x + panelW, y, 314, totalH)
    files.forEach((file, i) => {
      const yy = y + 20 + i * rowH
      numbered(i + 1, x + 42, yy - 12, 66, 32, i % 2 ? '#f43f5e' : '#fb7185', 4)
      ctx.fillStyle = '#ffe4e6'; ctx.fillRect(x + panelW + 40, yy - 8, 190, 6)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 16px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 270, x + panelW + 32, yy + 16, 21, 16)
    })
  } else if (style === 'exam_checklist') {
    const x = 96, y = 126, w = 408, rowH = 68
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, w, rowH * files.length + 44, 4); ctx.fill()
    ctx.strokeStyle = '#c7d2fe'; ctx.stroke()
    ctx.fillStyle = '#e0e7ff'; ctx.fillRect(x, y, w, 44)
    files.forEach((file, i) => {
      const yy = y + 62 + i * rowH
      ctx.strokeStyle = '#6366f1'; ctx.strokeRect(x + 32, yy - 24, 28, 28)
      ctx.beginPath(); ctx.moveTo(x + 38, yy - 10); ctx.lineTo(x + 46, yy - 2); ctx.lineTo(x + 58, yy - 20); ctx.stroke()
      ctx.fillStyle = '#111827'; ctx.font = 'bold 16px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 284, x + 82, yy - 8, 21, 16)
      ctx.strokeStyle = '#e0e7ff'; ctx.beginPath(); ctx.moveTo(x + 82, yy + 25); ctx.lineTo(x + 350, yy + 25); ctx.stroke()
    })
  } else if (style === 'kanban_columns') {
    const heads = [['真题', '#06b6d4', '#ecfeff'], ['考点', '#22c55e', '#f0fdf4'], ['冲刺', '#f97316', '#fff7ed']]
    heads.forEach(([h, c, bg], col) => {
      const x = 58 + col * 162
      ctx.fillStyle = bg; ctx.fillRect(x, 132, 136, H - 182)
      ctx.strokeStyle = '#d1d5db'; ctx.strokeRect(x, 132, 136, H - 182)
      ctx.fillStyle = c; ctx.fillRect(x, 132, 136, 42)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(h, x + 68, 160); ctx.textAlign = 'left'
    })
    files.forEach((file, i) => {
      const x = 70 + (i % 3) * 162, y = 198 + Math.floor(i / 3) * 118
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, 112, 88, 3); ctx.fill(); ctx.strokeStyle = '#e5e7eb'; ctx.stroke()
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px Arial'; ctx.fillText(String(i + 1).padStart(2, '0'), x + 16, y + 28)
      ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 82, x + 16, y + 52, 18, 14)
    })
  } else if (style === 'index_columns') {
    const colH = H - 198
    ctx.fillStyle = '#fff'; ctx.fillRect(58, 132, 216, colH); ctx.strokeStyle = '#fecdd3'; ctx.strokeRect(58, 132, 216, colH)
    ctx.fillStyle = '#fff'; ctx.fillRect(326, 132, 216, colH); ctx.strokeRect(326, 132, 216, colH)
    files.forEach((file, i) => {
      const x = i % 2 ? 344 : 76, y = 170 + Math.floor(i / 2) * 108
      numbered(i + 1, x, y - 24, 48, 42, '#be123c', 0)
      ctx.fillStyle = '#ffe4e6'; ctx.fillRect(x + 48, y - 24, 148, 62)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 116, x + 66, y - 2, 18, 14)
    })
  } else if (style === 'barcode_list') {
    files.forEach((file, i) => {
      const y = 130 + i * 66
      ctx.fillStyle = '#fff'; ctx.fillRect(58, y, 484, 52); ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(58, y, 484, 52)
      ctx.fillStyle = '#0f172a'; for (let b = 0; b < 8; b++) ctx.fillRect(78 + b * 6, y + 8, b % 2 ? 2 : 4, 18)
      numbered(i + 1, 164, y + 6, 48, 22, '#0f172a', 2)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 270, 242, y + 24, 20, 15)
    })
  } else if (style === 'rank_board' || style === 'step_bars') {
    files.forEach((file, i) => {
      const x = style === 'step_bars' ? 84 + i * 8 : 84
      const y = 130 + i * 66
      const w = style === 'rank_board' ? Math.max(300, 430 - i * 14) : 430
      const accent = style === 'rank_board' ? '#4d7c0f' : '#f97316'
      ctx.fillStyle = style === 'rank_board' ? (i % 2 ? '#d9f99d' : '#bef264') : (i % 2 ? '#fed7aa' : '#ffedd5')
      ctx.fillRect(x, y, w, 52)
      numbered(i + 1, x, y, 58, 52, accent, 0)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, w - 82, x + 82, y + 22, 20, 15)
    })
  } else if (style === 'file_stack_square') {
    files.forEach((file, i) => {
      const x = 72 + i * 10, y = 132 + i * 66
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 420, 58); ctx.strokeStyle = '#d8b4fe'; ctx.strokeRect(x, y, 420, 58)
      numbered(i + 1, x, y, 62, 58, i % 2 ? '#a855f7' : '#7e22ce', 0)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 318, x + 82, y + 25, 20, 15)
    })
  } else if (style === 'calendar_grid_square' || style === 'block_overview') {
    if (style === 'block_overview') {
      ctx.fillStyle = '#e0f2fe'; ctx.fillRect(58, 124, 484, 58)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 26px "PingFang SC", sans-serif'; ctx.fillText(`${files.length}份资料`, 84, 162)
    }
    files.forEach((file, i) => {
      const x = 58 + (i % 3) * 166, y = (style === 'block_overview' ? 212 : 140) + Math.floor(i / 3) * 116
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 134, 92); ctx.strokeStyle = style === 'calendar_grid_square' ? '#bfdbfe' : '#bae6fd'; ctx.strokeRect(x, y, 134, 92)
      numbered(i + 1, x + 14, y + 12, 36, 28, '#0ea5e9', 2)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 104, x + 14, y + 58, 17, 14)
    })
  } else {
    files.forEach((file, i) => {
      const gridLike = ['block_grid', 'stamp_blocks', 'blueprint_rect'].includes(style)
      const x = gridLike ? 66 + (i % 2) * 250 : 78 + (i % 2) * 250
      const y = gridLike ? 136 + Math.floor(i / 2) * 112 : 130 + i * 76
      const dark = style === 'blueprint_rect'
      const accent = style === 'block_grid' ? ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed', '#0891b2'][i % 6]
        : style === 'stamp_blocks' ? '#ca8a04' : style === 'folder_tabs_square' ? '#0f766e' : '#2563eb'
      if (style === 'folder_tabs_square') {
        ctx.fillStyle = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#cffafe'][i % 6]
        ctx.beginPath(); ctx.roundRect(58, 128 + i * 76, 120, 22, 4); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.fillRect(58, 146 + i * 76, 484, 56); ctx.strokeStyle = '#cbd5e1'; ctx.strokeRect(58, 146 + i * 76, 484, 56)
        numbered(i + 1, 82, 160 + i * 76, 38, 26, accent, 2)
        ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 350, 144, 170 + i * 76, 20, 15)
      } else {
        ctx.fillStyle = dark ? '#172554' : '#fff'; ctx.fillRect(x, y, 214, 88); ctx.strokeStyle = dark ? '#38bdf8' : style === 'stamp_blocks' ? '#ca8a04' : '#dbeafe'; ctx.strokeRect(x, y, 214, 88)
        numbered(i + 1, x, y, 62, 88, accent, 0)
        ctx.fillStyle = dark ? '#e0f2fe' : '#111827'; ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareTextLines(ctx, file.name, 130, x + 78, y + 35, 18, 14)
      }
    })
  }
  return offscreenToDataUrl(canvas)
}

async function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl, style = 'classic') {
  const DPR = 2, W = 600
  const activeStyle = DIR_IMAGE_STYLES.includes(style) ? style : 'classic'
  if (SQUARE_DIR_STYLES.includes(activeStyle)) {
    return renderSquareDirComposite(files, title, bgImageUrl, activeStyle)
  }
  const BORDER = bgImageUrl ? 0 : (activeStyle === 'classic' ? 10 : 0)
  const infoCardStyles = ['year_card', 'timeline_card', 'ticket_card', 'tag_card', 'stagger_card', 'grouped_card', 'border_card']
  const gridStyles = ['sticky', 'calendar', 'folder_wall', 'rainbow', ...infoCardStyles]
  const PADDING = activeStyle === 'magazine' || activeStyle === 'terminal' || activeStyle === 'book' || activeStyle === 'mono' ? 40 : 34
  const ICON_SIZE = activeStyle === 'classic' || activeStyle === 'drive' ? 30 : 32
  const BADGE_W = activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'magazine' || activeStyle === 'split' || activeStyle === 'blueprint' || activeStyle === 'receipt' || activeStyle === 'book' || activeStyle === 'index' || activeStyle === 'bubble' || activeStyle === 'stamp' || activeStyle === 'mint' || activeStyle === 'cream' || activeStyle === 'mono'
    ? 56
    : activeStyle === 'soft'
      ? ICON_SIZE + 10
      : ICON_SIZE
  const ICON_TEXT_GAP = activeStyle === 'classic' || activeStyle === 'drive' ? 26 : 22
  const TITLE_H = activeStyle === 'split' ? 170 : activeStyle === 'magazine' || activeStyle === 'terminal' || activeStyle === 'book' || activeStyle === 'mono' ? 118 : 102
  const textX = activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'split' || activeStyle === 'blueprint' || activeStyle === 'receipt' || activeStyle === 'book' || activeStyle === 'index' || activeStyle === 'bubble' || activeStyle === 'stamp' || activeStyle === 'mint' || activeStyle === 'cream' || activeStyle === 'mono'
    ? BORDER + PADDING + (activeStyle === 'book' ? 154 : 130)
    : BORDER + PADDING + BADGE_W + ICON_TEXT_GAP
  const maxTextW = W - textX - PADDING - BORDER
  const fontSize = activeStyle === 'drive' || activeStyle === 'table' || activeStyle === 'sheet' || activeStyle === 'dark' || activeStyle === 'terminal' || activeStyle === 'blueprint' || activeStyle === 'mono' ? 18 : 17
  const rows = measureDirRows(files, maxTextW, fontSize)
  const rowGap = ['sticky', 'soft', 'checklist', 'bubble', 'mint', 'rainbow'].includes(activeStyle) ? 14 : 0
  const infoMeasureCanvas = new OffscreenCanvas(1, 1)
  const infoMeasureCtx = infoMeasureCanvas.getContext('2d')
  infoMeasureCtx.font = '600 15px "PingFang SC", "Microsoft YaHei", sans-serif'
  const infoCardW = (W - 84) / 2
  const infoCardRows = infoCardStyles.includes(activeStyle)
    ? files.map(file => wrapCanvasText(infoMeasureCtx, file.name, infoCardW - (activeStyle === 'year_card' ? 86 : 30)))
    : []
  const infoRowHeights = infoCardStyles.includes(activeStyle)
    ? Array.from({ length: Math.ceil(files.length / 2) }, (_, rowIndex) => {
        const maxLines = Math.max(infoCardRows[rowIndex * 2]?.length || 1, infoCardRows[rowIndex * 2 + 1]?.length || 1)
        const verticalSpace = activeStyle === 'year_card' ? 54 : 78
        return Math.max(108, maxLines * 22 + verticalSpace)
      })
    : []
  const gridCardH = activeStyle === 'calendar' || activeStyle === 'folder_wall' || activeStyle === 'rainbow' ? 128 : 126
  const bodyH = gridStyles.includes(activeStyle)
    ? infoCardStyles.includes(activeStyle) ? infoRowHeights.reduce((sum, height) => sum + height, 0) : Math.ceil(files.length / 2) * gridCardH
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
    ctx.font = `bold 22px "PingFang SC", sans-serif`
    ctx.fillText('2026', 40, 126)
    ctx.fillText('备考资料包', 40, 154)
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
      const infoRow = Math.floor(i / 2)
      const cardY = infoCardStyles.includes(activeStyle)
        ? listTop + infoRowHeights.slice(0, infoRow).reduce((sum, value) => sum + value, 0) + (activeStyle === 'stagger_card' && col ? 12 : 0)
        : listTop + infoRow * gridCardH
      const cardH = infoCardStyles.includes(activeStyle) ? infoRowHeights[infoRow] - 16 : gridCardH - 22
      ctx.save()
      if (infoCardStyles.includes(activeStyle)) {
        const palette = ['#fff0f0', '#e7f6ff', '#f3fbea', '#fff6e5']
        const accent = ['#ff5d70', '#3e8edb', '#55a96b', '#e29a25'][i % 4]
        const yearMatch = String(file.name || '').match(/20\d{2}/)
        const year = yearMatch ? yearMatch[0] : String(i + 1).padStart(2, '0')
        if (activeStyle === 'timeline_card') {
          ctx.strokeStyle = '#d6dfeb'; ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(cardX + 26, cardY); ctx.lineTo(cardX + 26, cardY + cardH); ctx.stroke()
          ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cardX + 26, cardY + 28, 8, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = palette[i % palette.length]; ctx.beginPath(); ctx.roundRect(cardX + 46, cardY, cardW - 46, cardH, 14); ctx.fill()
          ctx.fillStyle = accent; ctx.font = 'bold 20px "PingFang SC", sans-serif'; ctx.fillText(year, cardX + 62, cardY + 30)
          ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
          drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 76), cardX + 62, cardY + 58, 22, 15)
        } else {
          ctx.fillStyle = activeStyle === 'border_card' ? '#ffffff' : palette[i % palette.length]
          ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, activeStyle === 'ticket_card' ? 4 : 16); ctx.fill()
          if (activeStyle === 'border_card') {
            ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke()
          }
          if (activeStyle === 'ticket_card') {
            ctx.fillStyle = accent; ctx.fillRect(cardX, cardY, 6, cardH)
          }
          if (activeStyle === 'year_card') {
            ctx.fillStyle = accent; ctx.font = 'bold 24px "PingFang SC", sans-serif'; ctx.fillText(String(i + 1).padStart(2, '0'), cardX + 14, cardY + 34)
            ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
            drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 86), cardX + 72, cardY + 29, 22, 15)
          } else {
            ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(cardX + 14, cardY + 13, activeStyle === 'grouped_card' ? 72 : 46, 25, 8); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "PingFang SC", sans-serif'; ctx.textAlign = 'center'
            ctx.fillText(activeStyle === 'grouped_card' ? `${year} 真题` : (file.isdir === 1 ? '文件夹' : 'PDF'), cardX + 14 + (activeStyle === 'grouped_card' ? 36 : 23), cardY + 30); ctx.textAlign = 'left'
            ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
            drawWrappedLines(ctx, wrapCanvasText(ctx, file.name, cardW - 28), cardX + 14, cardY + 62, 22, 15)
          }
        }
      } else if (activeStyle === 'sticky') {
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
      ? BORDER + PADDING + (activeStyle === 'book' ? 78 : 58)
      : BORDER + PADDING
    const noX = activeStyle === 'book' ? BORDER + PADDING + 24 : BORDER + PADDING
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
  const fixedText = (text, x, y, color = '#111827', size = 34, weight = 'bold', align = 'left') => {
    ctx.fillStyle = color
    ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = align; ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
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
  const drawStyleFrame = (accent, alpha = 0.48, lineWidth = 4) => {
    ctx.strokeStyle = accent
    ctx.globalAlpha = alpha
    ctx.lineWidth = lineWidth
    ctx.beginPath(); ctx.roundRect(58, 58, CANVAS_W - 116, CANVAS_H - 116, 34); ctx.stroke()
    ctx.globalAlpha = 1
  }
  const drawPlanLabel = (label, x, y, accent, color = '#ffffff') => {
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.roundRect(x, y, 184, 46, 23); ctx.fill()
    ctx.fillStyle = color
    ctx.font = 'bold 22px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(label, x + 92, y + 23)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  }

  if (style === 'examRed') {
    fillBg('#fff8f5')
    drawStyleFrame('#d71920', 0.95, 12)
    ctx.fillStyle = '#ffebe8'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 246, y: 300, w: 730, h: 900, r: 20 })
    drawOverlay(650, 1126, 520)
    drawPlanLabel('考前急救', 76, 1450, '#f7caca', '#d71920')
  } else if (style === 'fileStack') {
    fillBg('#f7fbff')
    drawStyleFrame('#60a5fa', 0.6)
    ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.arc(1030, 188, 116, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 340, y: 270, w: 700, h: 880, r: 18, rotate: -8, shadow: true })
    drawPage({ x: 312, y: 295, w: 700, h: 880, r: 18, rotate: -4, shadow: true })
    drawPage({ x: 286, y: 318, w: 700, h: 880, r: 18, rotate: -3, shadow: true })
    drawOverlay(650, 1126, 520)
  } else if (style === 'memoBoard') {
    fillBg('#fffaf0')
    drawStyleFrame('#f59e0b', 0.55)
    ctx.fillStyle = '#fde68a'; ctx.save(); ctx.translate(84, 250); ctx.rotate(-0.14); ctx.beginPath(); ctx.roundRect(0, 0, 180, 150, 12); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#bfdbfe'; ctx.save(); ctx.translate(936, 145); ctx.rotate(0.12); ctx.beginPath(); ctx.roundRect(0, 0, 170, 126, 12); ctx.fill(); ctx.restore()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 302, y: 342, w: 660, h: 850, r: 20, rotate: 3 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'greenPlan') {
    fillBg('#f1fbf5')
    drawStyleFrame('#22c55e', 0.46)
    ctx.fillStyle = '#dcfce7'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 226, y: 306, w: 690, h: 910, r: 18 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'newspaper') {
    fillBg('#f8f5ef')
    titleText(92, 180, '#111827', 52, 'left')
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(92, 232); ctx.lineTo(1150, 232); ctx.stroke()
    drawPage({ x: 296, y: 330, w: 650, h: 870, r: 8, shadow: false })
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(296, 330, 650, 870)
    drawOverlay(650, 1126, 520)
  } else if (style === 'blackGold') {
    fillBg('#111111')
    drawStyleFrame('#d4af37', 0.65)
    ctx.fillStyle = 'rgba(212,175,55,0.18)'; ctx.beginPath(); ctx.arc(1020, 180, 92, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#ffffff', 52, 'left')
    drawPage({ x: 286, y: 328, w: 690, h: 890, r: 20, rotate: -2 },)
    drawOverlay(650, 1126, 520)
  } else if (style === 'blueRibbon') {
    fillBg('#eff6ff')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#0f4c81', 0.08, 44)
    drawStyleFrame('#0f4c81', 0.52)
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 340, y: 305, w: 650, h: 900, r: 16 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'pinkHighlighter') {
    fillBg('#fff1f6')
    drawStyleFrame('#f472b6', 0.58)
    ctx.fillStyle = '#fbcfe8'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 286, y: 328, w: 690, h: 880, r: 20, rotate: -3 })
    drawOverlay(650, 1126, 520)
    drawPlanLabel('重点速看', 76, 1450, '#f9c7dd', '#be185d')
  } else if (style === 'indexTabs') {
    fillBg('#f8fafc')
    drawStyleFrame('#8b5cf6', 0.58)
    ;['#ddd6fe', '#bfdbfe', '#fecdd3', '#bbf7d0', '#fde68a'].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(978 + i * 28, 330 + i * 78, 112, 54, 12); ctx.fill()
    })
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 268, y: 318, w: 690, h: 900, r: 18 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'gridCard') {
    fillBg('#f6f7fb')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#ef4444', 0.07, 44)
    drawStyleFrame('#ef4444', 0.45)
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 300, y: 330, w: 650, h: 870, r: 18 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'clipboard') {
    fillBg('#f5f0e8')
    drawStyleFrame('#92400e', 0.46)
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.roundRect(366, 86, 510, 96, 32); ctx.fill()
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.roundRect(512, 54, 220, 80, 28); ctx.fill()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 266, y: 250, w: 710, h: 970, r: 16 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'lectureSlide') {
    fillBg('#eef2ff')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#4338ca', 0.06, 44)
    drawStyleFrame('#6366f1', 0.48)
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 216, y: 318, w: 760, h: 850, r: 16 })
    drawOverlay(620, 1130, 520)
  } else if (style === 'ticket') {
    fillBg('#fffbeb')
    ctx.fillStyle = '#fed7aa'; ctx.beginPath(); ctx.roundRect(86, 248, CANVAS_W - 172, 1172, 24); ctx.fill()
    drawStyleFrame('#ea580c', 0.52)
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 286, y: 326, w: 680, h: 880, r: 18, rotate: 2 })
    drawOverlay(650, 1126, 520)
  } else if (style === 'magazine') {
    fillBg('#fdf2f8')
    drawStyleFrame('#be123c', 0.52)
    ctx.fillStyle = '#ffe4e6'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 336, y: 280, w: 640, h: 930, r: 18 })
    drawOverlay(86, 1188, 520)
  } else if (style === 'focusRing') {
    fillBg('#ecfeff')
    drawStyleFrame('#0891b2', 0.48)
    ctx.strokeStyle = 'rgba(8,145,178,0.22)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(822, 778, 410, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(8,145,178,0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(822, 778, 330, 0, Math.PI * 2); ctx.stroke()
    titleText(92, 180, '#111827', 52, 'left')
    drawPage({ x: 326, y: 350, w: 650, h: 840, r: 18 })
    drawOverlay(92, 1164, 520)
  } else if (style === 'aurora') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, 520)
    grad.addColorStop(0, '#22d3ee'); grad.addColorStop(0.55, '#a78bfa'); grad.addColorStop(1, '#f472b6')
    fillBg('#0f172a')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(CANVAS_W, 0); ctx.lineTo(CANVAS_W, 260); ctx.bezierCurveTo(960, 40, 760, 520, 560, 260); ctx.bezierCurveTo(340, 20, 210, 470, 0, 320); ctx.closePath(); ctx.fill()
    titleText(92, 208, '#ffffff', 56, 'left')
    drawPage({ x: 300, y: 350, w: 650, h: 850, r: 20, rotate: -2 })
    drawOverlay(640, 1115, 520)
  } else if (style === 'lawPaper') {
    fillBg('#f7f2e8')
    ctx.strokeStyle = '#dec8a3'; ctx.lineWidth = 8; ctx.strokeRect(70, 80, 1102, 1496)
    titleText(92, 150, '#111827', 58, 'left')
    ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(92, 252); ctx.lineTo(1150, 252); ctx.stroke()
    drawPage({ x: 278, y: 322, w: 680, h: 900, r: 4, shadow: false })
    ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = 3; ctx.strokeRect(278, 322, 680, 900)
    drawOverlay(620, 1132, 520)
  } else if (style === 'sciLab') {
    fillBg('#f8fffb')
    ctx.strokeStyle = '#059669'; ctx.lineWidth = 2; ctx.globalAlpha = 0.45
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(980 + i * 28, 140 + i * 34, 18 + i * 3, 0, Math.PI * 2); ctx.stroke() }
    ctx.globalAlpha = 1
    titleText(92, 178, '#111827', 56, 'left')
    drawPage({ x: 245, y: 320, w: 705, h: 900, r: 18 })
    drawOverlay(640, 1120, 520)
  } else if (style === 'metro') {
    fillBg('#f8fafc')
    ctx.fillStyle = '#ef4444'; ctx.fillRect(0, 0, CANVAS_W, 36)
    ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 36, CANVAS_W, 24)
    titleText(92, 175, '#111827', 56, 'left')
    drawPage({ x: 300, y: 310, w: 650, h: 890, r: 18 })
    drawOverlay(626, 1120, 530)
    ctx.lineCap = 'round'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(92, 1430); ctx.lineTo(1150, 1430); ctx.stroke()
    ctx.strokeStyle = '#1d4ed8'; ctx.beginPath(); ctx.moveTo(210, 1430); ctx.lineTo(650, 1430); ctx.stroke(); ctx.lineCap = 'butt'
  } else if (style === 'receiptLong') {
    fillBg('#fffdf4')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(92, 92, 1058, 1468, 4); ctx.fill()
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.strokeRect(92, 92, 1058, 1468)
    titleText(92, 188, '#111827', 56, 'left')
    drawPage({ x: 290, y: 315, w: 650, h: 890, r: 4, shadow: false })
    drawOverlay(610, 1128, 520)
  } else if (style === 'glassLayer') {
    fillBg('#e0f2fe')
    ctx.fillStyle = '#bae6fd'; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(210, 220, 230, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#7dd3fc'; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(1060, 1280, 280, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.34; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(86, 92, 1070, 1470, 34); ctx.fill(); ctx.globalAlpha = 1
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 286, y: 330, w: 680, h: 880, r: 20, rotate: 3 })
    drawOverlay(640, 1122, 520)
  } else if (style === 'notebookBlue') {
    fillBg('#f7fbff')
    ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = 2
    for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.moveTo(80, 250 + i * 48); ctx.lineTo(1160, 250 + i * 48); ctx.stroke() }
    ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(168, 96); ctx.lineTo(168, 1560); ctx.stroke()
    titleText(92, 175, '#111827', 56, 'left')
    drawPage({ x: 285, y: 318, w: 675, h: 895, r: 18, rotate: -1 })
    drawOverlay(640, 1120, 520)
  } else if (style === 'kraftSeal') {
    fillBg('#f2e4c8')
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 4; ctx.setLineDash([18, 12]); ctx.beginPath(); ctx.roundRect(82, 92, 1078, 1472, 28); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(1040, 250, 92, 0, Math.PI * 2); ctx.fill()
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 280, y: 326, w: 680, h: 890, r: 18, rotate: 2 })
    drawOverlay(635, 1124, 520)
  } else if (style === 'radialFocus') {
    fillBg('#fff7ed')
    ctx.fillStyle = '#fed7aa'; ctx.beginPath(); ctx.arc(820, 780, 520, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(249,115,22,0.3)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(820, 780, 410, 0, Math.PI * 2); ctx.stroke()
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 326, y: 350, w: 650, h: 840, r: 18 })
    drawOverlay(94, 1165, 520)
  } else if (style === 'purplePortal') {
    fillBg('#f5f3ff')
    ctx.fillStyle = '#ede9fe'; ctx.beginPath(); ctx.roundRect(72, 72, 1098, 1512, 48); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.66)'; ctx.beginPath(); ctx.roundRect(132, 150, 978, 1350, 46); ctx.fill()
    titleText(92, 190, '#111827', 56, 'left')
    drawPage({ x: 300, y: 342, w: 650, h: 850, r: 18 })
    drawOverlay(640, 1125, 520)
  } else if (style === 'greenChalk') {
    fillBg('#12352f')
    ctx.strokeStyle = '#d9f99d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(70, 82, 1102, 1492, 20); ctx.stroke()
    titleText(92, 180, '#f8fafc', 56, 'left')
    drawPage({ x: 290, y: 330, w: 660, h: 870, r: 18, rotate: -2 })
    drawOverlay(620, 1128, 540)
    ctx.strokeStyle = 'rgba(248,250,252,0.8)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(120, 1430); ctx.lineTo(520, 1430); ctx.stroke(); ctx.lineCap = 'butt'
  } else if (style === 'windowDesk') {
    fillBg('#eef2f7')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(118, 120, 1006, 1320, 22); ctx.fill()
    ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.roundRect(118, 120, 1006, 72, 22); ctx.fill()
    titleText(92, 284, '#111827', 54, 'left')
    drawPage({ x: 282, y: 405, w: 670, h: 780, r: 16, shadow: false })
    drawOverlay(630, 1118, 520)
  } else if (style === 'archiveBox') {
    fillBg('#f8fafc')
    ctx.fillStyle = 'rgba(204,251,241,0.7)'; ctx.beginPath(); ctx.roundRect(96, 240, 1050, 1110, 26); ctx.fill()
    ctx.fillStyle = 'rgba(15,118,110,0.9)'; ctx.beginPath(); ctx.roundRect(96, 170, 410, 130, 28); ctx.fill()
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 310, y: 340, w: 640, h: 850, r: 18 })
    drawOverlay(640, 1118, 520)
  } else if (style === 'orangeBurst') {
    fillBg('#fff7ed')
    ctx.fillStyle = 'rgba(254,215,170,0.8)'
    for (let i = 0; i < 18; i++) { ctx.save(); ctx.translate(620, 780); ctx.rotate(i / 18 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(620, -18); ctx.lineTo(250, 18); ctx.closePath(); ctx.fill(); ctx.restore() }
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 300, y: 330, w: 650, h: 860, r: 18, rotate: -3 })
    drawOverlay(638, 1120, 520)
  } else if (style === 'calmGray') {
    fillBg('#f3f4f6')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(70, 70, 1102, 1516, 34); ctx.fill()
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 292, y: 320, w: 660, h: 880, r: 14, shadow: false })
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(292, 320, 660, 880)
    drawOverlay(640, 1125, 520)
  } else if (style === 'blueprintDark') {
    fillBg('#0b2447')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#38bdf8', 0.08, 48)
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.strokeRect(66, 66, 1110, 1524)
    titleText(92, 180, '#f8fafc', 56, 'left')
    drawPage({ x: 292, y: 330, w: 660, h: 870, r: 18 })
    drawOverlay(638, 1126, 520)
  } else if (style === 'foldedCorner') {
    fillBg('#fdfdfb')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(92, 92); ctx.lineTo(1010, 92); ctx.lineTo(1150, 232); ctx.lineTo(1150, 1564); ctx.lineTo(92, 1564); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fee2e2'; ctx.beginPath(); ctx.moveTo(1010, 92); ctx.lineTo(1010, 232); ctx.lineTo(1150, 232); ctx.closePath(); ctx.fill()
    titleText(92, 180, '#111827', 56, 'left')
    drawPage({ x: 300, y: 330, w: 650, h: 860, r: 18 })
    drawOverlay(638, 1120, 520)
  } else if (style === 'comicMarker') {
    fillBg('#fffbeb')
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(85, 116, 1065, 1424, 38); ctx.stroke()
    titleText(92, 190, '#111827', 56, 'left')
    drawPage({ x: 288, y: 328, w: 670, h: 875, r: 18, rotate: -2 })
    drawOverlay(636, 1122, 520)
    ctx.strokeStyle = 'rgba(253,230,138,0.8)'; ctx.lineWidth = 32; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(110, 1340); ctx.quadraticCurveTo(410, 1280, 740, 1346); ctx.stroke(); ctx.lineCap = 'butt'
  } else if (style === 'sideCatalog') {
    fillBg('#f8fafc')
    ctx.fillStyle = '#cffafe'; ctx.fillRect(0, 0, 260, CANVAS_H)
    titleText(310, 180, '#111827', 56, 'left')
    drawPage({ x: 386, y: 330, w: 610, h: 850, r: 18 })
    drawOverlay(92, 1100, 500)
  } else if (style === 'redLedger') {
    fillBg('#fff5f5')
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.roundRect(76, 70, 170, 1516, 26); ctx.fill()
    ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(76, 70, 1090, 1516, 26); ctx.stroke()
    titleText(300, 180, '#111827', 56, 'left')
    drawPage({ x: 360, y: 320, w: 620, h: 880, r: 18 })
    drawOverlay(600, 1122, 520)
  } else if (style === 'folder') {
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
    if (!img) return
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
    const cy = active === 'stackedFocus' ? CANVAS_H * 0.08 : CANVAS_H * 0.50
    const fontSize = active === 'stackedFocus' ? 76 : 82
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
  const dashedFocus = (x, y, w, h, color = '#1e80ff') => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.setLineDash([14, 10])
    ctx.strokeRect(x - 8, y - 8, w + 16, h + 16)
    ctx.restore()
  }
  const imgAt = (index) => imgs[index] || imgs[index - 1] || imgs[index - 2] || imgs[0]

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
  } else if (active === 'stackedFocus') {
    bg('#f4f5f8')
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.roundRect(82, 34, CANVAS_W - 164, CANVAS_H - 78, 18)
    ctx.stroke()
    page(imgAt(3), { x: 148, y: 242, w: 640, h: 990, r: 4, rotate: -0.8 }, { shadowColor: 'rgba(15,23,42,.18)' })
    page(imgAt(2), { x: 255, y: 342, w: 640, h: 990, r: 4, rotate: 0.4 }, { shadowColor: 'rgba(15,23,42,.18)' })
    page(imgAt(1), { x: 360, y: 470, w: 640, h: 990, r: 4, rotate: -0.2 }, { shadowColor: 'rgba(15,23,42,.18)' })
    const front = { x: 460, y: 600, w: 670, h: 940, r: 2 }
    page(imgAt(0), front, { shadowColor: 'rgba(15,23,42,.22)' })
    dashedFocus(front.x, front.y, front.w, front.h)
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
  const files = filterDirFilesByType(res.files, type).sort((a, b) => b.isdir - a.isdir)
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
  const files = filterDirFilesByType(res.files, type).sort((a, b) => b.isdir - a.isdir)
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

const CARD_TEMPLATE_STYLE_NAMES = {
  poster: '竖条海报',
  check: '勾选清单',
  tags: '标签气泡',
  folder: '文件夹',
  note2: '便签纸',
  mono: '黑白极简',
  exam: '考试分区',
  stamp: '红章资料',
  dark2: '深色报告',
  app: '应用窗口',
  course: '课程横条',
  wrong: '错题纸',
  side: '侧边蓝条',
  gridnote: '网格笔记',
  paperclip: '回形针',
  blue: '蓝色渐变',
  photo: '相片底栏',
  cutout: '深色剪影',
  softpink: '柔粉卡片',
  greenfile: '绿色档案',
  orangeburst: '橙色圆点',
  blueprint_card: '蓝图网格',
  receipt_card: '票据清单',
  neon: '霓虹深色',
  vertical: '竖线稿纸',
  filetab: '文件标签',
  calendar_card: '日历红头',
  folderwall_card: '文件夹墙',
  outline_card: '竖线编号',
  cream_card: '奶油纸张',
  stamp2: '描边印章',
  marker: '马克笔',
}

const CARD_BOTTOM_HINTS = [
  '👈 左滑查看更多笔试备考资料',
  '📚 更多笔试复习资料，左滑查看',
  '✨ 往左翻，还有整理好的笔试资料',
  '📖 左滑解锁更多笔试学习资料',
  '📝 后面几页还有笔试备考干货',
  '👉 想看更多笔试资料？往左滑',
  '📌 左滑查看后续笔试资料内容',
  '💡 笔试复习资料还没完，继续左滑',
  '🎯 更多笔试重点资料藏在后面',
  '📚 下一页继续分享笔试备考资料',
  '👀 往左滑，看看还有哪些笔试资料',
  '📑 左边还有更多笔试复习内容',
  '🌟 左滑继续查看笔试学习笔记',
  '📖 笔试资料已整理，往左翻阅',
  '✍️ 左滑查看更多笔试知识整理',
  '📚 继续往左翻，笔试资料还有不少',
  '💫 更多笔试备考内容，左滑就能看',
  '📌 别急着划走，左滑还有笔试资料',
  '🗂️ 后续图片还有更多笔试复习资料',
  '👈 左滑进入下一组笔试备考内容',
  '📒 笔试高频考点资料，左滑接着看',
  '🎯 往左翻，更多笔试核心资料等你看',
  '📚 左滑还有笔试真题与复习笔记',
  '📝 笔试知识点整理，下一页继续',
  '✨ 左滑查看更多笔试题型资料',
  '📖 备考笔试的小伙伴，继续左滑看资料',
  '💡 笔试重点内容还有，往左滑查看',
  '📑 左滑翻阅更多笔试资料整理',
  '👈 更多笔试知识清单，请向左翻',
  '🌷 往左翻翻，笔试复习资料还在后面',
  '📚 后面准备了更多笔试学习内容',
  '🔖 左滑查看笔试资料的其他部分',
  '📌 笔试备考资料持续分享，左滑继续',
  '🎓 左滑了解更多笔试复习知识',
  '📝 更多笔试考点笔记，下一张接着看',
  '📖 想系统复习笔试？左滑看更多资料',
  '✨ 这还不是全部，左滑还有笔试资料',
  '📚 笔试复习内容比较多，左滑慢慢看',
  '🎯 往左翻页，继续查看笔试备考重点',
  '👀 后面还有笔试资料，记得左滑哦',
  '📒 左滑查看更多笔试专项复习内容',
  '🗂️ 更多笔试备考整理，向左翻页查看',
  '💡 左滑还有笔试常见题型学习资料',
  '📚 笔试资料分享继续，左滑看下一页',
  '📝 更多笔试复习笔记，往左翻就有',
  '📖 左滑看看后面整理的笔试知识点',
  '🌟 下一张还有笔试备考资料，继续翻',
  '👈 向左滑动，查看剩余笔试资料',
  '📌 更多笔试复习参考资料，左滑浏览',
  '🎯 左滑继续，后面还有笔试备考内容',
]

function pickCardTemplateStyle() {
  if (!_CARD_TEMPLATE_STYLE_BAG.length) _CARD_TEMPLATE_STYLE_BAG = shuffledCopy(CARD_TEMPLATE_STYLES)
  return _CARD_TEMPLATE_STYLE_BAG.pop() || rndPick(CARD_TEMPLATE_STYLES)
}

function pickCardScheme() {
  if (!_CARD_SCHEMES.length) return null
  if (!_CARD_SCHEME_BAG.length) _CARD_SCHEME_BAG = shuffledCopy(_CARD_SCHEMES)
  return _CARD_SCHEME_BAG.pop() || rndPick(_CARD_SCHEMES)
}

function pickCardBottomHint() {
  return rndPick(CARD_BOTTOM_HINTS) || '👈 左滑查看更多笔试备考资料'
}

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

function setCardHintFont(ctx, text, maxWidth, baseSize, minSize) {
  let fontSize = baseSize
  do {
    ctx.font = `bold ${fontSize}px "PingFang SC", "Helvetica Neue", sans-serif`
    if (ctx.measureText(text).width <= maxWidth || fontSize <= minSize) return fontSize
    fontSize -= 1 * (baseSize / 22 / 3)
  } while (fontSize > minSize)
  return fontSize
}

function drawRightHint(ctx, W, H, scale, text, color = '#1a1a1a', highlight = '#ffea7a') {
  const hintText = text || pickCardBottomHint()
  const baseFontSize = 22 * scale
  const minFontSize = 16 * scale
  const right = 40 * scale
  const maxWidth = W - right * 2
  const y = H - 128 * scale
  ctx.textBaseline = 'top'
  const fontSize = setCardHintFont(ctx, hintText, maxWidth, baseFontSize, minFontSize)
  const w = ctx.measureText(hintText).width
  ctx.fillStyle = highlight
  ctx.fillRect(W - right - w, y + fontSize * 0.55, w, fontSize * 0.48)
  ctx.fillStyle = color
  ctx.fillText(hintText, W - right - w, y)
}

const CARD_LAYOUT_VARIANTS = ['classic', 'centerHero', 'sideTitle', 'noticeBoard', 'infoFirst', 'compactTop']
const CARD_BOTTOM_MODES = ['hint', 'tags', 'subtitle', 'none']
const CARD_INFO_CHIPS = ['真题汇编', '高频考点', '考前冲刺', '速记清单', '重点整理', '资料合集', '刷题资料', '考点归纳']
const CARD_SUBTITLE_POOL = ['重点资料已整理', '适合考前集中复习', '先抓高频再刷题', '备考少走弯路', '资料清单已备好', '短期冲刺可参考']

function pickCardAntiVariant(style) {
  const denseStyles = ['vertical', 'receipt_card', 'calendar_card', 'outline_card']
  const layoutPool = denseStyles.includes(style)
    ? ['classic', 'compactTop', 'infoFirst', 'noticeBoard']
    : CARD_LAYOUT_VARIANTS
  return {
    layout: rndPick(layoutPool) || 'classic',
    bottomMode: rndPick(CARD_BOTTOM_MODES) || 'hint',
    copyMode: rndPick(['normal', 'companySeparate', 'suffixFocus', 'shortMain']) || 'normal',
    titleScale: rndInt(92, 108) / 100,
    titleShiftX: rndInt(-10, 12),
    titleShiftY: rndInt(-12, 16),
    lineTightness: rndInt(112, 128) / 100,
    chipCount: rndInt(2, 4),
    showInfo: rndInt(0, 100) < 78,
    showTexture: rndInt(0, 100) < 62,
  }
}

function buildCardCopyParts(text, variant) {
  const parts = splitCardText(text)
  const raw = String(text || '').trim()
  const examMatch = raw.match(/^(.+?)笔试[，,、\s]*(.*)$/)
  if (variant.copyMode === 'companySeparate' && examMatch) {
    return { main: examMatch[1], sub: `笔试 ${examMatch[2] || '备考资料'}` }
  }
  if (variant.copyMode === 'suffixFocus' && parts.sub) {
    return { main: parts.sub, sub: parts.main }
  }
  if (variant.copyMode === 'shortMain' && examMatch) {
    return { main: `${examMatch[1]}笔试`, sub: rndPick(CARD_SUBTITLE_POOL) || examMatch[2] || '重点资料已整理' }
  }
  return parts
}

function drawCardSubtleTexture(ctx, W, H, scale, palette) {
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.strokeStyle = palette.accent || '#64748b'
  ctx.lineWidth = 1 * scale
  const gap = rndInt(26, 38) * scale
  for (let x = rndInt(-20, 12) * scale; x < W; x += gap) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H * 0.18, H); ctx.stroke()
  }
  ctx.globalAlpha = 0.05
  for (let y = rndInt(20, 46) * scale; y < H; y += gap * 1.45) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  ctx.restore()
}

function drawCardInfoChips(ctx, x, y, maxWidth, palette, scale, count = 3) {
  const chips = shuffledCopy(CARD_INFO_CHIPS).slice(0, count)
  let cx = x
  let cy = y
  ctx.textBaseline = 'top'
  chips.forEach((chip, i) => {
    ctx.font = `bold ${14 * scale}px "PingFang SC", "Helvetica Neue", sans-serif`
    const w = Math.min(ctx.measureText(chip).width + 22 * scale, maxWidth)
    if (cx + w > x + maxWidth) {
      cx = x
      cy += 34 * scale
    }
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.72)' : palette.highlight
    ctx.beginPath(); ctx.roundRect(cx, cy, w, 28 * scale, 4 * scale); ctx.fill()
    ctx.fillStyle = palette.sub
    ctx.fillText(chip, cx + 11 * scale, cy + 6 * scale)
    cx += w + 9 * scale
  })
  return cy + 34 * scale
}

function drawCardBottomVariant(ctx, W, H, scale, mode, bottomHint, palette, x, maxWidth) {
  const y = H - 104 * scale
  if (mode === 'none') return
  if (mode === 'tags') {
    drawCardInfoChips(ctx, x, y, maxWidth, palette, scale, 3)
    return
  }
  if (mode === 'subtitle') {
    const text = rndPick(CARD_SUBTITLE_POOL) || '重点资料已整理'
    ctx.font = `bold ${20 * scale}px "PingFang SC", "Helvetica Neue", sans-serif`
    ctx.textBaseline = 'top'
    const w = Math.min(ctx.measureText(text).width + 22 * scale, maxWidth)
    ctx.fillStyle = palette.highlight
    ctx.fillRect(x, y + 14 * scale, w, 18 * scale)
    ctx.fillStyle = palette.hint
    ctx.fillText(text, x, y)
    return
  }
  drawRightHint(ctx, W, H, scale, bottomHint, palette.hint, palette.hintHighlight)
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

function drawTemplateCardTitle(ctx, lines, x, y, maxWidth, style, palette, scale, options = {}) {
  const fontSize = (options.fontSize || (['poster', 'stamp2', 'marker'].includes(style) ? 38 : 34)) * scale
  const lineHeight = fontSize * (options.lineTightness || 1.22)
  const maxLines = options.maxLines || 4
  const align = options.align || 'left'
  ctx.textBaseline = 'top'
  ctx.textAlign = align
  lines.slice(0, maxLines).forEach((line, i) => {
    const yy = y + i * lineHeight
    const w = Math.min(ctx.measureText(line).width, maxWidth)
    const tx = align === 'center' ? x + maxWidth / 2 : x
    const bgX = align === 'center' ? tx - w / 2 : x
    if (style === 'stamp2') {
      ctx.lineWidth = 2 * scale
      ctx.strokeStyle = palette.accent
      ctx.beginPath(); ctx.roundRect(bgX - 3 * scale, yy - 3 * scale, w + 10 * scale, fontSize + 8 * scale, 5 * scale); ctx.stroke()
    } else if (['cutout', 'gridnote', 'folderwall_card'].includes(style)) {
      ctx.fillStyle = style === 'cutout' ? 'rgba(255,255,255,0.12)' : '#ffffff'
      ctx.beginPath(); ctx.roundRect(bgX - 6 * scale, yy - 2 * scale, w + 14 * scale, fontSize + 8 * scale, 8 * scale); ctx.fill()
    } else if (style === 'blueprint_card') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1.5 * scale
      ctx.beginPath(); ctx.roundRect(bgX - 5 * scale, yy - 3 * scale, w + 14 * scale, fontSize + 8 * scale, 5 * scale); ctx.stroke()
    } else {
      ctx.fillStyle = palette.highlight
      ctx.fillRect(bgX, yy + fontSize * 0.55, w, fontSize * 0.42)
    }
    ctx.fillStyle = palette.text
    ctx.fillText(line, tx, yy)
  })
  ctx.textAlign = 'left'
  return y + Math.min(lines.length, maxLines) * lineHeight
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

async function renderTemplateCardImage(text, templateStyle, bottomHint) {
  const SCALE = 3
  const W = 360 * SCALE, H = 480 * SCALE
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const style = templateStyle || rndPick(CARD_TEMPLATE_STYLES)
  const palette = getTemplateCardPalette(style)
  const variant = pickCardAntiVariant(style)
  drawTemplateCardBackground(ctx, W, H, style, SCALE)
  if (variant.showTexture) drawCardSubtleTexture(ctx, W, H, SCALE, palette)
  drawTemplateCardDecor(ctx, W, H, style, palette, SCALE)

  const { main, sub } = buildCardCopyParts(text, variant)
  const baseX = style === 'app' || style === 'receipt_card' ? 48 * SCALE : 38 * SCALE
  const x = baseX + variant.titleShiftX * SCALE
  const maxWidth = W - baseX - (style === 'side' ? 58 * SCALE : 38 * SCALE)
  const classicTop = ['folder', 'filetab', 'calendar_card'].includes(style) ? 78 : 86
  const layoutMap = {
    classic: { x, top: classicTop * SCALE + variant.titleShiftY * SCALE, width: maxWidth, align: 'left', titleSize: (['poster', 'stamp2', 'marker'].includes(style) ? 38 : 34) * variant.titleScale, maxLines: 4 },
    centerHero: { x: 44 * SCALE, top: 118 * SCALE + variant.titleShiftY * SCALE, width: W - 88 * SCALE, align: 'center', titleSize: 36 * variant.titleScale, maxLines: 3 },
    sideTitle: { x: 56 * SCALE, top: 118 * SCALE + variant.titleShiftY * SCALE, width: W - 118 * SCALE, align: 'left', titleSize: 32 * variant.titleScale, maxLines: 4 },
    noticeBoard: { x: 46 * SCALE, top: 148 * SCALE + variant.titleShiftY * SCALE, width: W - 92 * SCALE, align: 'left', titleSize: 33 * variant.titleScale, maxLines: 3 },
    infoFirst: { x: 44 * SCALE, top: 168 * SCALE + variant.titleShiftY * SCALE, width: W - 88 * SCALE, align: 'left', titleSize: 32 * variant.titleScale, maxLines: 3 },
    compactTop: { x, top: 72 * SCALE + variant.titleShiftY * SCALE, width: maxWidth, align: 'left', titleSize: 31 * variant.titleScale, maxLines: 4 },
  }
  const layout = layoutMap[variant.layout] || layoutMap.classic

  if (variant.layout === 'sideTitle') {
    ctx.fillStyle = palette.accent
    ctx.beginPath(); ctx.roundRect(34 * SCALE, 98 * SCALE, 7 * SCALE, 214 * SCALE, 4 * SCALE); ctx.fill()
  } else if (variant.layout === 'noticeBoard') {
    ctx.fillStyle = style === 'dark2' || style === 'neon' || style === 'blueprint_card' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.62)'
    ctx.beginPath(); ctx.roundRect(36 * SCALE, 126 * SCALE, W - 72 * SCALE, 178 * SCALE, 12 * SCALE); ctx.fill()
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = 2 * SCALE
    ctx.stroke()
  } else if (variant.layout === 'infoFirst') {
    drawCardInfoChips(ctx, 42 * SCALE, 94 * SCALE, W - 84 * SCALE, palette, SCALE, variant.chipCount)
  }

  ctx.font = `900 ${layout.titleSize * SCALE}px "PingFang SC", "Helvetica Neue", sans-serif`
  const titleLines = wrapCardLines(ctx, main, layout.width)
  const afterTitleY = drawTemplateCardTitle(ctx, titleLines, layout.x, layout.top, layout.width, style, palette, SCALE, {
    fontSize: layout.titleSize,
    maxLines: layout.maxLines,
    align: layout.align,
    lineTightness: variant.lineTightness,
  })

  ctx.textBaseline = 'top'
  ctx.fillStyle = palette.sub
  const subSize = variant.layout === 'centerHero' ? 22 : 24
  ctx.font = `800 ${subSize * SCALE}px "PingFang SC", "Helvetica Neue", sans-serif`
  const subText = sub || rndPick(CARD_SUBTITLE_POOL) || '备考资料已整理'
  const subLines = wrapCardLines(ctx, subText, layout.width)
  const subX = layout.align === 'center' ? layout.x + 12 * SCALE : layout.x
  const subMaxLines = variant.layout === 'noticeBoard' ? 2 : 4
  drawCardLines(ctx, subLines, subX, afterTitleY + 20 * SCALE, 32 * SCALE, subMaxLines)

  if (variant.showInfo && variant.layout !== 'infoFirst') {
    const infoY = Math.min(afterTitleY + 118 * SCALE, H - 192 * SCALE)
    drawCardInfoChips(ctx, layout.align === 'center' ? 58 * SCALE : layout.x, infoY, layout.align === 'center' ? W - 116 * SCALE : layout.width, palette, SCALE, variant.chipCount)
  }

  ctx.fillStyle = palette.accent
  ctx.beginPath(); ctx.roundRect(baseX, H - 78 * SCALE, rndInt(34, 72) * SCALE, 5 * SCALE, 3 * SCALE); ctx.fill()
  drawCardBottomVariant(ctx, W, H, SCALE, variant.bottomMode, bottomHint, palette, baseX, W - baseX * 2)
  return offscreenToDataUrl(canvas)
}

// ── 卡片图（与生成笔记抽屉风格池保持一致，OffscreenCanvas 版）────────────
async function renderCardImage(text, styleInput) {
  const bottomHint = pickCardBottomHint()
  if (Math.random() < 0.85) {
    return renderTemplateCardImage(text, pickCardTemplateStyle(), bottomHint)
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
  // ─── 底部随机提示文案（重点样式，同 xxx笔试 高亮）──
  const BTM_FONT_SIZE = 22 * SCALE
  const BTM_TEXT = bottomHint
  ctx.font = `bold ${BTM_FONT_SIZE}px "PingFang SC", "Helvetica Neue", sans-serif`
  ctx.textBaseline = 'top'
  const maxBtmTextW = W - PAD_L - PAD_R
  const fittedBtmFontSize = setCardHintFont(ctx, BTM_TEXT, maxBtmTextW, BTM_FONT_SIZE, 16 * SCALE)
  const btmTextW = ctx.measureText(BTM_TEXT).width
  const btmX = W - PAD_R - btmTextW
  const btmY = H - 160 - fittedBtmFontSize
  if (!['geometric', 'border'].includes(style)) {
    ctx.fillStyle = HL_COLOR; ctx.fillRect(btmX, btmY + fittedBtmFontSize * 0.55, btmTextW, fittedBtmFontSize * 0.47)
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
async function runBatch({ productDetails, onlyDirImages, generationMode = 'complete', bgPool, borderColor, titlePool, cardTitleTemplatePool, useCardTitleTemplates, historyTitlePool, mockTitlePool, cardSchemes }) {
  _TITLE_POOL                = titlePool             || []
  _CARD_TITLE_TEMPLATE_POOL  = cardTitleTemplatePool || []
  _USE_CARD_TITLE_TEMPLATES  = !!useCardTitleTemplates
  _HISTORY_TITLE_POOL        = historyTitlePool      || []
  _MOCK_TITLE_POOL           = mockTitlePool         || []
  _CARD_SCHEMES              = cardSchemes           || []
  _CARD_TEMPLATE_STYLE_BAG = []
  _CARD_SCHEME_BAG = []
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
      const scheme = pickCardScheme() || { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' }
      cardText = buildCardText(detail)
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

async function buildCardTemplatePreviews({ sampleText, cardSchemes }) {
  _CARD_SCHEMES = cardSchemes || []
  _CARD_SCHEME_BAG = []
  _CARD_TEMPLATE_STYLE_BAG = []
  const text = sampleText || '示例单位笔试，考前冲刺就背这些'
  const previews = []
  for (const style of CARD_TEMPLATE_STYLES) {
    const dataUrl = await renderTemplateCardImage(text, style, pickCardBottomHint())
    previews.push({
      id: style,
      name: CARD_TEMPLATE_STYLE_NAMES[style] || style,
      base64: dataUrl.replace(/^data:image\/png;base64,/, ''),
    })
  }
  return previews
}

// ── Worker 入口 ──────────────────────────────────────────────────────
self.onmessage = async (e) => {
  if (e.data.type === 'preview-card-templates') {
    try {
      const previews = await buildCardTemplatePreviews(e.data)
      post({ type: 'card-template-previews', previews })
    } catch (err) {
      post({ type: 'card-template-preview-error', message: err.message || '预览生成失败' })
    }
    return
  }
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
