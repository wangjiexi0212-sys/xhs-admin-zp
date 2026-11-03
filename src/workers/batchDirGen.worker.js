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
let _CARD_TEXT_TITLE_BAG = []
let _CARD_SCHEMES = []
let _CARD_TEMPLATE_STYLE_BAG = []
let _CARD_SCHEME_BAG = []
let _CARD_LAYOUT_VARIANT_BAGS = new Map()

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
  if (!_CARD_TEXT_TITLE_BAG.length) {
    const pool = _USE_CARD_TITLE_TEMPLATES ? _CARD_TITLE_TEMPLATE_POOL : _TITLE_POOL
    _CARD_TEXT_TITLE_BAG = shuffledCopy(pool)
  }
  const suffix = _CARD_TEXT_TITLE_BAG.pop() || ''
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
  '中国共产党','中共中央','党中央','中央','共产党','政治局','政治局常委','总书记',
  '中央委员会','中央纪委','中央组织部','中央宣传部','中央统战部','中央政法委',
  '国家主席','国家副主席','中央军委','人民解放军','解放军','武警部队',
  '国务院','全国人大','全国政协','人大常委会','人民代表大会','代表大会','人民代表',
  '最高人民法院','最高人民检察院','人民法院','人民检察院','公安部','国防部','外交部',
  '党委','党组','纪委','监委','省委','市委','县委','区委','政府工作报告',
  '中华人民共和国','共和国','中国','中华民族','中华','政府','党','宪法',
  '社会主义','共产主义','马克思主义','毛泽东思想','中国特色社会主义',
  '全会','二十大','三中','三中全会','两会','党代会','国家','法律','法规','政治',
  '战争','反法西斯','解放','民主','三权','三权分立','分权','强国',
  '美国','俄罗斯','俄国','日本','英国','法国','德国','韩国','朝鲜','印度',
  '加拿大','澳大利亚','乌克兰','以色列','巴勒斯坦','伊朗','台湾','香港','澳门',
  '国民党','民进党','民主党','共和党','工党','保守党','政党','在野党','执政党',
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

const EDITORIAL_CARDS = [
  ['editorial_edition','备考专刊','material_display'], ['editorial_cobalt','钴蓝宣言','single_focus'],
  ['editorial_spine','书脊藏本','usage_path'], ['editorial_receipt','学习收据','review_check'],
  ['editorial_orange','暖橙单点','single_focus'], ['editorial_gallery','留白展签','material_display'],
  ['editorial_ribbon','斜切书腰','review_check'], ['editorial_split','上下双章','usage_path'],
  ['editorial_letter','给备考者的信','scene_action'], ['editorial_architect','建筑留白','usage_path'],
  ['editorial_ticket','学习通行票','usage_path'], ['editorial_night','深夜阅读灯','question_answer'],
  ['editorial_accordion','折页使用指南','usage_path'], ['editorial_annotation','观点摘录','review_check'],
  ['editorial_museum','档案展览','material_display'],
]
const CARD_TEMPLATE_STYLES = [
  ...EDITORIAL_CARDS.map(([id]) => id),
  'poster','check','tags','folder','note2','mono','exam','stamp','dark2','app',
  'course','wrong','side','gridnote','paperclip','blue','photo','cutout','softpink','greenfile',
  'orangeburst','blueprint_card','receipt_card','neon','vertical','filetab','calendar_card','folderwall_card','outline_card','cream_card','stamp2','marker',
  'ref_dark_border','ref_plaid','ref_arch','ref_ticket','ref_purple_sidebar','ref_clipboard','ref_minimal_red','ref_green_wave','ref_green_bands','ref_envelope','ref_purple_wave','ref_blue_sidebar','ref_brown_banner',
  'ref_tea_dark_border','ref_tea_plaid','ref_tea_arch','ref_tea_ticket','ref_tea_purple_sidebar','ref_tea_clipboard','ref_tea_minimal_red','ref_tea_green_wave','ref_tea_green_bands','ref_tea_envelope','ref_tea_purple_wave','ref_tea_blue_sidebar','ref_tea_brown_banner',
  'concept_metro','concept_dashboard','concept_answer','concept_track','concept_tree','concept_countdown','concept_radar','concept_stairs','concept_puzzle','concept_compare',
  'concept_matrix','concept_compass','concept_ranking','concept_orbit','concept_elements','concept_funnel','concept_timeline','concept_target','concept_circuit','concept_bars',
  'virtual_file_drawer','virtual_download_window','virtual_cloud_drive','virtual_pdf_stack','virtual_archive_seal','virtual_course_pack','virtual_ring_binder','virtual_material_kit',
  'virtual_content_index','virtual_az_index','virtual_file_tree','virtual_split_catalog','virtual_book_toc','virtual_folder_tabs','virtual_search_panel','virtual_module_map',
  'virtual_breadcrumb_path','virtual_study_signpost','virtual_bus_route','virtual_mountain_route','virtual_circular_route','virtual_task_flow','virtual_assembly_steps','virtual_workflow_pipeline',
  'virtual_review_diagnosis','virtual_sticky_wall','virtual_error_report','virtual_review_log','virtual_status_board','virtual_round_compare','virtual_checklist_sheet','virtual_progress_journal',
  'virtual_qa_dialogue','virtual_proofread_note','virtual_user_manual','virtual_magnifier_focus','virtual_highlighter_page','virtual_teacher_board','virtual_memo_note','virtual_question_cards',
]

const CARD_TEMPLATE_STYLE_NAMES = {
  ...Object.fromEntries(EDITORIAL_CARDS.map(([id,name]) => [id,name])),
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
  ref_dark_border: '深蓝细框',
  ref_plaid: '紫灰格纹',
  ref_arch: '绿色拱门',
  ref_ticket: '牛皮纸票券',
  ref_purple_sidebar: '紫色侧栏',
  ref_clipboard: '蓝灰夹板',
  ref_minimal_red: '黑红极简',
  ref_green_wave: '绿波几何',
  ref_green_bands: '绿色横条',
  ref_envelope: '信封折角',
  ref_purple_wave: '紫色波浪',
  ref_blue_sidebar: '蓝灰侧栏',
  ref_brown_banner: '棕色横幅',
  ref_tea_dark_border: '茶金青墨·深蓝细框',
  ref_tea_plaid: '茶金青墨·紫灰格纹',
  ref_tea_arch: '茶金青墨·绿色拱门',
  ref_tea_ticket: '茶金青墨·牛皮纸票券',
  ref_tea_purple_sidebar: '茶金青墨·紫色侧栏',
  ref_tea_clipboard: '茶金青墨·蓝灰夹板',
  ref_tea_minimal_red: '茶金青墨·黑红极简',
  ref_tea_green_wave: '茶金青墨·绿波几何',
  ref_tea_green_bands: '茶金青墨·绿色横条',
  ref_tea_envelope: '茶金青墨·信封折角',
  ref_tea_purple_wave: '茶金青墨·紫色波浪',
  ref_tea_blue_sidebar: '茶金青墨·蓝灰侧栏',
  ref_tea_brown_banner: '茶金青墨·棕色横幅',
  concept_metro: '地铁备考线',
  concept_dashboard: '能力仪表盘',
  concept_answer: '标准答题卡',
  concept_track: '进阶赛道',
  concept_tree: '知识生长树',
  concept_countdown: '分阶段计划',
  concept_radar: '五维雷达',
  concept_stairs: '四步学习路径',
  concept_puzzle: '四块拼图',
  concept_compare: '效率对照组',
  concept_matrix: '备考坐标系',
  concept_compass: '备考指南针',
  concept_ranking: '内容使用顺序',
  concept_orbit: '知识轨道',
  concept_elements: '考点元素表',
  concept_funnel: '复习漏斗',
  concept_timeline: '学习时间轴',
  concept_target: '单点聚焦',
  concept_circuit: '解题电路',
  concept_bars: '学习状态图',
  virtual_file_drawer: '档案抽屉',
  virtual_download_window: '下载窗口',
  virtual_cloud_drive: '云盘资料',
  virtual_pdf_stack: 'PDF资料堆',
  virtual_archive_seal: '档案封签',
  virtual_course_pack: '课程资料包',
  virtual_ring_binder: '活页资料册',
  virtual_material_kit: '资料拼装包',
  virtual_content_index: '资料索引卡',
  virtual_az_index: '字母索引页',
  virtual_file_tree: '文件树结构',
  virtual_split_catalog: '分栏目录',
  virtual_book_toc: '书籍目录页',
  virtual_folder_tabs: '文件标签页',
  virtual_search_panel: '资料检索面板',
  virtual_module_map: '资料模块图',
  virtual_breadcrumb_path: '文件路径',
  virtual_study_signpost: '学习路标',
  virtual_bus_route: '学习公交线',
  virtual_mountain_route: '登山学习路径',
  virtual_circular_route: '环形学习路线',
  virtual_task_flow: '四格任务流',
  virtual_assembly_steps: '资料拼装步骤',
  virtual_workflow_pipeline: '学习流水线',
  virtual_review_diagnosis: '复盘诊断单',
  virtual_sticky_wall: '问题便签墙',
  virtual_error_report: '错误分析报告',
  virtual_review_log: '练习复盘日志',
  virtual_status_board: '学习状态看板',
  virtual_round_compare: '两轮练习对照',
  virtual_checklist_sheet: '完成度检查表',
  virtual_progress_journal: '学习进度手账',
  virtual_qa_dialogue: '问答对话',
  virtual_proofread_note: '编辑批注页',
  virtual_user_manual: '资料操作说明书',
  virtual_magnifier_focus: '放大镜聚焦',
  virtual_highlighter_page: '荧光笔重点页',
  virtual_teacher_board: '板书讲解',
  virtual_memo_note: '手写备忘录',
  virtual_question_cards: '问题卡片组',
}

const CARD_BOTTOM_HINTS = [
  '先认识资料结构，再安排学习顺序',
  '不同资料可以分阶段配合使用',
  '完成练习后，记得记录错误原因',
  '一次只解决一个具体问题',
  '先看目录，再开始第一轮练习',
  '把资料拆成可以逐项完成的任务',
  '下一轮重点来自这一次的检查',
  '先完成眼前这一步，再继续展开',
  '做完一组内容，再停下来复盘',
  '准备下一轮前，先回看已有记录',
]

const CARD_TEMPLATE_DEMO_GOALS = [
  { id: 'material_display', name: '资料展示', viewpoint: '目录导航', items: ['学习资料', '历年回忆题', '模拟练习', '使用说明'], footer: '先认识资料结构，再安排学习顺序' },
  { id: 'usage_path', name: '使用路径', viewpoint: '分步使用', items: ['先看目录', '开始练习', '分类整理', '完成复盘'], footer: '把资料拆成可以逐项完成的任务' },
  { id: 'question_answer', name: '问题解答', viewpoint: '操作说明', items: ['明确问题', '查找内容', '完成练习', '记录结果'], footer: '一次只解决一个具体问题' },
  { id: 'review_check', name: '复盘自查', viewpoint: '薄弱项检查', items: ['完成情况', '错误原因', '薄弱内容', '下一轮重点'], footer: '下一轮重点来自这一次的检查' },
  { id: 'single_focus', name: '单点拆解', viewpoint: '重点解释', items: ['找到内容', '完成一次', '记录问题', '回看整理'], footer: '把一个问题讲清楚再进入下一项' },
  { id: 'scene_action', name: '场景动作', viewpoint: '完成练习后', items: ['打开资料', '顺着目录', '开始练习', '及时复盘'], footer: '做完一组内容，再停下来复盘' },
]

const CARD_ROUTE_STYLE_IDS = new Set(['concept_metro','concept_track','concept_stairs','concept_compass','concept_timeline','concept_circuit','concept_countdown'])
const CARD_REVIEW_STYLE_IDS = new Set(['concept_dashboard','concept_answer','concept_radar','concept_matrix','concept_bars','concept_compare'])
const CARD_MAP_STYLE_IDS = new Set(['concept_tree','concept_puzzle','concept_orbit','concept_elements','concept_funnel'])
const CARD_FOCUS_STYLE_IDS = new Set(['concept_target','concept_ranking'])
const VIRTUAL_MATERIAL_STYLE_IDS = new Set(['virtual_file_drawer','virtual_download_window','virtual_cloud_drive','virtual_pdf_stack','virtual_archive_seal','virtual_course_pack','virtual_ring_binder','virtual_material_kit'])
const VIRTUAL_INDEX_STYLE_IDS = new Set(['virtual_content_index','virtual_az_index','virtual_file_tree','virtual_split_catalog','virtual_book_toc','virtual_folder_tabs','virtual_search_panel','virtual_module_map'])
const VIRTUAL_ROUTE_STYLE_IDS = new Set(['virtual_breadcrumb_path','virtual_study_signpost','virtual_bus_route','virtual_mountain_route','virtual_circular_route','virtual_task_flow','virtual_assembly_steps','virtual_workflow_pipeline'])
const VIRTUAL_REVIEW_STYLE_IDS = new Set(['virtual_review_diagnosis','virtual_sticky_wall','virtual_error_report','virtual_review_log','virtual_status_board','virtual_round_compare','virtual_checklist_sheet','virtual_progress_journal'])
const VIRTUAL_FOCUS_STYLE_IDS = new Set(['virtual_qa_dialogue','virtual_proofread_note','virtual_user_manual','virtual_magnifier_focus','virtual_highlighter_page','virtual_teacher_board','virtual_memo_note','virtual_question_cards'])
const VIRTUAL_CARD_STYLE_IDS = new Set([...VIRTUAL_MATERIAL_STYLE_IDS, ...VIRTUAL_INDEX_STYLE_IDS, ...VIRTUAL_ROUTE_STYLE_IDS, ...VIRTUAL_REVIEW_STYLE_IDS, ...VIRTUAL_FOCUS_STYLE_IDS])

function buildTemplateDemoPlan(style, index = 0) {
  let preferredGoal = EDITORIAL_CARDS.find(([id]) => id === style)?.[2] || ''
  if (CARD_ROUTE_STYLE_IDS.has(style)) preferredGoal = 'usage_path'
  else if (CARD_REVIEW_STYLE_IDS.has(style)) preferredGoal = 'review_check'
  else if (CARD_MAP_STYLE_IDS.has(style)) preferredGoal = 'material_display'
  else if (CARD_FOCUS_STYLE_IDS.has(style)) preferredGoal = 'single_focus'
  else if (VIRTUAL_MATERIAL_STYLE_IDS.has(style) || VIRTUAL_INDEX_STYLE_IDS.has(style)) preferredGoal = 'material_display'
  else if (VIRTUAL_ROUTE_STYLE_IDS.has(style)) preferredGoal = 'usage_path'
  else if (VIRTUAL_REVIEW_STYLE_IDS.has(style)) preferredGoal = 'review_check'
  else if (VIRTUAL_FOCUS_STYLE_IDS.has(style)) preferredGoal = 'single_focus'
  const eligible = preferredGoal
    ? CARD_TEMPLATE_DEMO_GOALS.filter(goal => goal.id === preferredGoal)
    : CARD_TEMPLATE_DEMO_GOALS
  const goal = eligible[index % eligible.length] || CARD_TEMPLATE_DEMO_GOALS[0]
  return {
    cardGoal: goal.id,
    cardGoalName: goal.name,
    cardViewpoint: goal.viewpoint,
    cardScene: goal.viewpoint,
    cardItems: [...goal.items],
    cardFooter: goal.footer,
  }
}

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
  return rndPick(CARD_BOTTOM_HINTS) || '先看目录，再安排学习顺序'
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
const CARD_INFO_CHIPS = ['学习资料', '历年回忆题', '模拟练习', '内容索引', '分步使用', '练习复盘', '错误整理', '下一轮重点']
const CARD_SUBTITLE_POOL = ['先看资料结构再开始练习', '不同内容可以分阶段使用', '完成练习后及时复盘', '从一个具体问题开始', '把学习任务逐项拆开', '回看记录再安排下一轮']

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

function drawCardInfoChips(ctx, x, y, maxWidth, palette, scale, count = 3, sourceItems = null) {
  const chips = shuffledCopy(sourceItems?.length ? sourceItems : CARD_INFO_CHIPS).slice(0, count)
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

function drawCardBottomVariant(ctx, W, H, scale, mode, bottomHint, palette, x, maxWidth, cardPlan = null) {
  const y = H - 104 * scale
  if (mode === 'none') return
  if (mode === 'tags') {
    drawCardInfoChips(ctx, x, y, maxWidth, palette, scale, 3, cardPlan?.cardItems)
    return
  }
  if (mode === 'subtitle') {
    const text = cardPlan?.cardFooter || rndPick(CARD_SUBTITLE_POOL) || '先看资料结构再开始练习'
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

function drawTemplateCardDecor(ctx, W, H, style, palette, scale, cardPlan = null) {
  const items = cardPlan?.cardItems?.length ? cardPlan.cardItems : CARD_INFO_CHIPS
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
    items.slice(0, 3).forEach((t, i) => {
      const y = 275 * scale + i * 33 * scale
      ctx.beginPath(); ctx.arc(56 * scale, y + 8 * scale, 8 * scale, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * scale; ctx.beginPath(); ctx.moveTo(51 * scale, y + 8 * scale); ctx.lineTo(56 * scale, y + 13 * scale); ctx.lineTo(64 * scale, y + 3 * scale); ctx.stroke()
      ctx.fillStyle = palette.sub; ctx.font = `600 ${15 * scale}px "PingFang SC", sans-serif`; ctx.fillText(t, 75 * scale, y)
      ctx.fillStyle = palette.accent
    })
  } else if (style === 'tags') {
    let x = 42 * scale, y = 282 * scale
    items.slice(0, 3).forEach((t, i) => {
      const w = drawTemplateTag(ctx, x, y, t, ['#fff4b8', '#dbeafe', '#dcfce7'][i], '#1f2937', scale)
      x += w + 8 * scale
    })
  } else if (style === 'calendar_card') {
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${18 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(cardPlan?.cardGoalName || '学习清单', 36 * scale, 20 * scale)
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

const REFERENCE_CARD_STYLES = new Set([
  'ref_dark_border','ref_plaid','ref_arch','ref_ticket','ref_purple_sidebar','ref_clipboard','ref_minimal_red',
  'ref_green_wave','ref_green_bands','ref_envelope','ref_purple_wave','ref_blue_sidebar','ref_brown_banner',
])

const REFERENCE_TEA_THEME_MAP = {
  ref_tea_dark_border: 'ref_dark_border',
  ref_tea_plaid: 'ref_plaid',
  ref_tea_arch: 'ref_arch',
  ref_tea_ticket: 'ref_ticket',
  ref_tea_purple_sidebar: 'ref_purple_sidebar',
  ref_tea_clipboard: 'ref_clipboard',
  ref_tea_minimal_red: 'ref_minimal_red',
  ref_tea_green_wave: 'ref_green_wave',
  ref_tea_green_bands: 'ref_green_bands',
  ref_tea_envelope: 'ref_envelope',
  ref_tea_purple_wave: 'ref_purple_wave',
  ref_tea_blue_sidebar: 'ref_blue_sidebar',
  ref_tea_brown_banner: 'ref_brown_banner',
}

const REFERENCE_TEA_THEME_PALETTES = {
  ref_tea_dark_border: { ink: '#10212f', deep: '#163f5d', accent: '#80b8c8', soft: '#d9e9ed', paper: '#f6fbfb', pale: '#e8f3f6', line: '#9cc7d1' },
  ref_tea_plaid: { ink: '#33252f', deep: '#7f536c', accent: '#b88ca2', soft: '#eadde5', paper: '#fbf7fa', pale: '#f2e9ef', line: '#c9aebe' },
  ref_tea_arch: { ink: '#12382c', deep: '#1f765f', accent: '#8fbf78', soft: '#dcebd6', paper: '#fffef6', pale: '#edf5e8', line: '#a9c99b' },
  ref_tea_ticket: { ink: '#372b22', deep: '#80674d', accent: '#b79a72', soft: '#eadfce', paper: '#fffaf0', pale: '#f4ead9', line: '#c9b28e' },
  ref_tea_purple_sidebar: { ink: '#2c2034', deep: '#704381', accent: '#b799c8', soft: '#eadff0', paper: '#fcf8ff', pale: '#f3edf7', line: '#c9b4d2' },
  ref_tea_clipboard: { ink: '#202538', deep: '#37405d', accent: '#98a7c4', soft: '#e0e5ee', paper: '#fbfcff', pale: '#eef2f6', line: '#b9c4d6' },
  ref_tea_minimal_red: { ink: '#191713', deep: '#9f252c', accent: '#d8a14b', soft: '#efe3cb', paper: '#fffaf0', pale: '#f4ecdc', line: '#c7b088' },
  ref_tea_green_wave: { ink: '#18392f', deep: '#5c7d68', accent: '#a7c8b1', soft: '#dfece4', paper: '#f8fbf7', pale: '#edf5ef', line: '#bfd5c6' },
  ref_tea_green_bands: { ink: '#1d4624', deep: '#315d34', accent: '#9dd35f', soft: '#e5f2d2', paper: '#f9fff2', pale: '#eef7df', line: '#bedb93' },
  ref_tea_envelope: { ink: '#2b1d35', deep: '#71407e', accent: '#d0b8dd', soft: '#eadfed', paper: '#fffaff', pale: '#f4eef6', line: '#cdbbd4' },
  ref_tea_purple_wave: { ink: '#301b36', deep: '#7a4185', accent: '#d6a6c9', soft: '#eeddea', paper: '#fff8fd', pale: '#f6ecf4', line: '#d5bfd1' },
  ref_tea_blue_sidebar: { ink: '#243642', deep: '#38586b', accent: '#9fc4d7', soft: '#dfeaf0', paper: '#f8fbfd', pale: '#eef5f8', line: '#bfd3dd' },
  ref_tea_brown_banner: { ink: '#3f3228', deep: '#5d4938', accent: '#d4a35f', soft: '#e8dfd3', paper: '#fbf7ef', pale: '#f1e9df', line: '#cdbda8' },
}

function hexToRgb(hex) {
  const v = String(hex || '').replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map(ch => ch + ch).join('') : v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function paintPixel(data, i, rgb) {
  data[i] = rgb[0]
  data[i + 1] = rgb[1]
  data[i + 2] = rgb[2]
}

function applyTeaReferenceTheme(ctx, W, H, palette = REFERENCE_TEA_THEME_PALETTES.ref_tea_brown_banner) {
  const img = ctx.getImageData(0, 0, W, H)
  const data = img.data
  const ink = hexToRgb(palette.ink)
  const deep = hexToRgb(palette.deep)
  const accent = hexToRgb(palette.accent)
  const soft = hexToRgb(palette.soft)
  const paper = hexToRgb(palette.paper)
  const pale = hexToRgb(palette.pale)
  const line = hexToRgb(palette.line)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
    const sat = max === 0 ? 0 : (max - min) / max
    if (lum > 0.94) {
      paintPixel(data, i, paper)
    } else if (lum > 0.82) {
      paintPixel(data, i, mixRgb(paper, soft, sat > 0.12 ? 0.72 : 0.28))
    } else if (lum > 0.66) {
      paintPixel(data, i, sat > 0.10 ? mixRgb(soft, accent, 0.22) : pale)
    } else if (lum > 0.46) {
      paintPixel(data, i, sat > 0.12 ? accent : line)
    } else if (lum > 0.26) {
      paintPixel(data, i, sat > 0.10 ? deep : mixRgb(ink, deep, 0.36))
    } else {
      paintPixel(data, i, ink)
    }
  }
  ctx.putImageData(img, 0, 0)
}

function drawRefTextBlock(ctx, text, x, y, maxWidth, fontSize, color, options = {}) {
  const minSize = options.minSize || 28
  const weight = options.weight || 900
  const family = options.family || '"PingFang SC", "Helvetica Neue", sans-serif'
  const align = options.align || 'center'
  const maxLines = options.maxLines || 4
  let size = fontSize
  let lines = []
  ctx.textBaseline = 'top'
  ctx.textAlign = align
  while (size >= minSize) {
    ctx.font = `${weight} ${size}px ${family}`
    lines = wrapCardLines(ctx, text, maxWidth)
    if (lines.length <= maxLines) break
    size -= 2
  }
  const lineHeight = Math.round(size * (options.lineHeight || 1.28))
  const drawLines = lines.slice(0, maxLines)
  const tx = align === 'center' ? x + maxWidth / 2 : x
  ctx.fillStyle = color
  drawLines.forEach((line, i) => ctx.fillText(line, tx, y + i * lineHeight))
  ctx.textAlign = 'left'
  return y + drawLines.length * lineHeight
}

function drawRefPill(ctx, x, y, w, h, fill, text, color, fontSize = 34, radius = 18) {
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${fontSize}px "PingFang SC", "Helvetica Neue", sans-serif`
  ctx.fillText(text, x + w / 2, y + h / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
}

function drawRefContentText(ctx, x, y, maxWidth, title, lines, color, accent, align = 'center') {
  ctx.fillStyle = accent
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.font = `900 24px "PingFang SC", "Helvetica Neue", sans-serif`
  const tx = align === 'center' ? x + maxWidth / 2 : x
  if (title) ctx.fillText(title, tx, y)
  ctx.fillStyle = color
  ctx.font = `900 36px "PingFang SC", "Helvetica Neue", sans-serif`
  lines.forEach((line, i) => ctx.fillText(line, tx, y + 56 + i * 54))
  ctx.textAlign = 'left'
}

function drawRefRuledBg(ctx, W, H, color = '#d9e4df') {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2
  for (let y = 100; y < H; y += 145) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
}

function drawRefCardImage(ctx, W, H, style, text, cardPlan = null) {
  const { main, sub } = splitCardText(text || '')
  const title = main || '企业笔试学习资料'
  const cardItems = cardPlan?.cardItems?.length ? cardPlan.cardItems : ['学习资料', '历年回忆题', '模拟练习']
  const tagText = cardItems.slice(0, 3).join('  ')
  const footerText = cardPlan?.cardFooter || '不同资料可以分阶段配合使用'
  ctx.font = '900 36px "PingFang SC", sans-serif'
  const infoLines = (sub && sub.length > 8)
    ? wrapCardLines(ctx, sub, 800).slice(0, 2)
    : cardItems.slice(0, 4).reduce((lines, item, index) => {
        if (index % 2 === 0) lines.push(item)
        else lines[lines.length - 1] += ` · ${item}`
        return lines
      }, [])

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  if (style === 'ref_dark_border') {
    ctx.fillStyle = '#13202b'; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#a6c7cd'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.roundRect(54, 54, W - 108, H - 108, 28); ctx.stroke()
    drawRefTextBlock(ctx, title, 84, 284, W - 168, 70, '#f6fbfb', { maxLines: 4, minSize: 46 })
    drawRefPill(ctx, 96, 734, W - 192, 108, 'transparent', tagText, '#a6c7cd', 38, 54)
    ctx.strokeStyle = '#a6c7cd'; ctx.lineWidth = 5
    ctx.beginPath(); ctx.roundRect(96, 734, W - 192, 108, 54); ctx.stroke()
    drawRefContentText(ctx, 120, 990, W - 240, '', infoLines, '#f6fbfb', '#f6fbfb')
    drawRefTextBlock(ctx, footerText, 120, 1276, W - 240, 30, '#f6fbfb', { maxLines: 1, minSize: 20 })
    return
  }

  if (style === 'ref_plaid') {
    ctx.fillStyle = '#f6f0f4'; ctx.fillRect(0, 0, W, H)
    for (let x = 0; x < W; x += 90) {
      ctx.fillStyle = (x / 90) % 2 ? '#8f7987' : '#a8929f'
      ctx.fillRect(x, 0, 90, 90); ctx.fillRect(x, H - 90, 90, 90)
    }
    ctx.strokeStyle = '#473f46'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.roundRect(56, 134, W - 112, H - 226, 16); ctx.stroke()
    ctx.fillStyle = '#8f7987'; ctx.fillRect(82, 166, 314, 70)
    drawRefTextBlock(ctx, title, 88, 300, W - 176, 68, '#3f3840', { maxLines: 3, minSize: 42 })
    drawRefPill(ctx, 96, 740, W - 192, 102, '#8f7987', tagText.replaceAll('  ', ' · '), '#fff', 38, 22)
    drawRefContentText(ctx, 110, 932, W - 220, '备考内容', infoLines, '#3f3840', '#a18b99', 'left')
    drawRefPill(ctx, 354, 1190, 684, 96, '#8f7987', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_arch') {
    ctx.fillStyle = '#dcead6'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffef6'; ctx.beginPath(); ctx.roundRect(88, 82, W - 176, H - 168, 420); ctx.fill()
    ctx.strokeStyle = '#1f765f'; ctx.lineWidth = 7
    ctx.beginPath(); ctx.roundRect(114, 114, W - 228, H - 228, 390); ctx.stroke()
    drawRefTextBlock(ctx, title, 150, 340, W - 300, 58, '#134536', { maxLines: 4, minSize: 38 })
    drawRefPill(ctx, 164, 750, W - 328, 104, '#1f765f', tagText.replaceAll('  ', ' · '), '#fff', 38, 18)
    drawRefContentText(ctx, 190, 940, W - 380, '笔试内容', infoLines, '#134536', '#1f765f')
    drawRefPill(ctx, 190, 1244, W - 380, 96, '#1f765f', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_ticket') {
    ctx.fillStyle = '#eee7de'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdf8'; ctx.beginPath(); ctx.roundRect(68, 78, W - 136, H - 156, 28); ctx.fill()
    ctx.strokeStyle = '#826f5b'; ctx.lineWidth = 4; ctx.setLineDash([14, 10])
    ctx.beginPath(); ctx.roundRect(68, 78, W - 136, H - 156, 28); ctx.stroke(); ctx.setLineDash([])
    for (let y = 144; y < H - 110; y += 108) {
      ctx.fillStyle = '#eee7de'; ctx.beginPath(); ctx.arc(68, y, 17, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(W - 68, y, 17, 0, Math.PI * 2); ctx.fill()
    }
    ctx.save(); ctx.translate(710, 150); ctx.rotate(-0.13); ctx.strokeStyle = '#a89178'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(0, 0, 248, 82, 12); ctx.stroke(); ctx.restore()
    drawRefTextBlock(ctx, title, 110, 310, W - 220, 62, '#342d28', { maxLines: 4, minSize: 40 })
    drawRefPill(ctx, 130, 746, W - 260, 104, '#826f5b', tagText.replaceAll('  ', ' · '), '#fff', 38, 16)
    drawRefContentText(ctx, 130, 944, W - 260, '笔试内容', infoLines, '#342d28', '#a89178', 'left')
    drawRefPill(ctx, 190, 1240, W - 380, 94, '#826f5b', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_purple_sidebar') {
    ctx.fillStyle = '#f3edf5'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#704381'; ctx.fillRect(0, 0, 122, H)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(154, 60, W - 214, H - 120, 34); ctx.fill()
    ctx.fillStyle = '#704381'; ctx.font = '900 28px "PingFang SC", sans-serif'; ctx.fillText('招聘考试资料', 200, 112)
    drawRefTextBlock(ctx, title, 206, 198, W - 292, 64, '#2c2034', { maxLines: 4, minSize: 40 })
    drawRefPill(ctx, 204, 718, W - 312, 110, '#704381', tagText, '#fff', 39, 18)
    drawRefContentText(ctx, 206, 918, W - 310, '笔试内容', infoLines, '#2c2034', '#704381', 'left')
    drawRefPill(ctx, 250, 1230, 752, 96, '#704381', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_clipboard') {
    ctx.fillStyle = '#edf1f4'; ctx.fillRect(0, 0, W, H); drawRefRuledBg(ctx, W, H, '#d8dee4')
    ctx.fillStyle = '#dde0ea'; ctx.beginPath(); ctx.moveTo(470, 60); ctx.lineTo(710, 60); ctx.lineTo(790, 130); ctx.lineTo(390, 130); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(70, 130, W - 140, H - 220, 26); ctx.fill()
    ctx.fillStyle = '#37405d'; ctx.beginPath(); ctx.roundRect(92, 156, W - 184, 104, 10); ctx.fill()
    drawRefTextBlock(ctx, title, 92, 278, W - 184, 70, '#202538', { maxLines: 4, minSize: 42 })
    drawRefTextBlock(ctx, tagText, 170, 834, W - 340, 44, '#37405d', { maxLines: 1, minSize: 30 })
    drawRefContentText(ctx, 160, 980, W - 320, '', infoLines, '#202538', '#202538')
    drawRefPill(ctx, 190, 1232, W - 380, 98, '#37405d', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_minimal_red') {
    ctx.fillStyle = '#efe8da'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffef9'; ctx.fillRect(48, 48, W - 96, H - 96)
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(74, 152); ctx.lineTo(W - 74, 152); ctx.stroke()
    drawRefTextBlock(ctx, title, 110, 214, W - 220, 70, '#111', { maxLines: 4, minSize: 42 })
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(74, 696); ctx.lineTo(W - 74, 696); ctx.stroke()
    drawRefTextBlock(ctx, tagText.replaceAll('  ', ' | '), 100, 746, W - 200, 38, '#ba202b', { maxLines: 1, minSize: 28 })
    ctx.strokeStyle = '#aaa39a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 834); ctx.lineTo(W / 2, 1110); ctx.stroke()
    drawRefContentText(ctx, 100, 886, 390, '核心内容', infoLines.slice(0, 2), '#111', '#ba202b', 'left')
    drawRefContentText(ctx, 610, 886, 350, '使用说明', cardItems.slice(2, 4), '#111', '#ba202b', 'left')
    drawRefPill(ctx, 190, 1248, W - 380, 96, '#c3222b', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_green_wave') {
    ctx.fillStyle = '#edf3ef'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#5c7d68'
    ctx.beginPath(); ctx.moveTo(0, 42); ctx.bezierCurveTo(220, -26, 300, 78, 456, 38); ctx.bezierCurveTo(660, -28, 850, 28, W, 148); ctx.lineTo(W, 592); ctx.lineTo(0, 592); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#dbe7df'; ctx.beginPath(); ctx.arc(W - 120, 540, 190, 0, Math.PI * 2); ctx.fill()
    drawRefTextBlock(ctx, title, 82, 142, W - 164, 62, '#fff', { maxLines: 4, minSize: 40 })
    drawRefPill(ctx, 96, 714, W - 192, 104, '#5c7d68', tagText.replaceAll('  ', ' · '), '#fff', 38, 16)
    ctx.fillStyle = '#fffef9'; ctx.beginPath(); ctx.roundRect(132, 906, W - 264, 258, 90); ctx.fill()
    drawRefContentText(ctx, 170, 954, W - 340, '笔试内容', infoLines, '#18392f', '#5c7d68')
    drawRefPill(ctx, 190, 1248, W - 380, 96, '#5c7d68', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_green_bands') {
    ctx.fillStyle = '#f1f6f2'; ctx.fillRect(0, 0, W, H); drawRefRuledBg(ctx, W, H, '#d4ded6')
    ctx.fillStyle = '#315d34'; ctx.fillRect(0, 70, 904, 65); ctx.fillRect(0, 548, 966, 220)
    ctx.fillStyle = '#dbe8db'; ctx.fillRect(138, 196, W - 138, 330)
    drawRefTextBlock(ctx, title, 200, 218, W - 250, 70, '#1d4624', { maxLines: 3, minSize: 42 })
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(126, 548, W - 252, 220, 28); ctx.fill()
    drawRefTextBlock(ctx, tagText.replaceAll('  ', ' · '), 160, 580, W - 320, 52, '#315d34', { maxLines: 2, minSize: 34 })
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(74, 810, W - 148, 512, 28); ctx.fill()
    drawRefContentText(ctx, 150, 858, W - 300, '', infoLines, '#1d4624', '#1d4624')
    drawRefPill(ctx, 190, 1210, W - 380, 96, '#315d34', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_envelope') {
    ctx.fillStyle = '#f3eff5'; ctx.fillRect(0, 0, W, H); drawRefRuledBg(ctx, W, H, '#ded7e2')
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(60, 88, W - 120, H - 180, 26); ctx.fill()
    ctx.fillStyle = '#e4dce7'; ctx.beginPath(); ctx.moveTo(60, 88); ctx.lineTo(W - 60, 88); ctx.lineTo(W / 2, 262); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#c7b9cb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, 88); ctx.lineTo(W / 2, 262); ctx.lineTo(W - 60, 88); ctx.stroke()
    drawRefTextBlock(ctx, title, 96, 300, W - 192, 68, '#2b1d35', { maxLines: 4, minSize: 42 })
    drawRefPill(ctx, 130, 624, W - 260, 108, '#71407e', tagText, '#fff', 38, 16)
    drawRefContentText(ctx, 140, 902, W - 280, '', infoLines, '#2b1d35', '#2b1d35')
    drawRefPill(ctx, 190, 1228, W - 380, 96, '#71407e', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_purple_wave') {
    ctx.fillStyle = '#f8f2f8'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff'; ctx.fillRect(60, 70, W - 120, H - 140)
    ctx.fillStyle = '#7a4185'; ctx.beginPath(); ctx.roundRect(60, 70, W - 120, 55, 18); ctx.fill()
    drawRefTextBlock(ctx, title, 96, 222, W - 192, 70, '#2b1d35', { maxLines: 4, minSize: 42 })
    drawRefTextBlock(ctx, tagText, 170, 636, W - 340, 40, '#7a4185', { maxLines: 1, minSize: 30 })
    drawRefContentText(ctx, 120, 810, W - 240, '笔试内容', infoLines, '#2b1d35', '#7a4185')
    ctx.fillStyle = '#e8d9ec'; ctx.beginPath(); ctx.moveTo(60, 1180); ctx.bezierCurveTo(250, 1080, 430, 1245, 610, 1130); ctx.bezierCurveTo(770, 1024, 900, 1120, W - 60, 1192); ctx.lineTo(W - 60, H - 70); ctx.lineTo(60, H - 70); ctx.closePath(); ctx.fill()
    drawRefPill(ctx, 190, 1220, W - 380, 96, '#7a4185', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_blue_sidebar') {
    ctx.fillStyle = '#f0f4f6'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(70, 60, 815, H - 120, 20); ctx.fill()
    ctx.fillStyle = '#38586b'; ctx.beginPath(); ctx.roundRect(110, 714, 710, 112, 18); ctx.fill()
    ctx.fillStyle = '#38586b'; ctx.fillRect(884, 148, 158, 112); ctx.fillRect(884, 574, 158, 112); ctx.fillRect(884, 1000, 158, 112)
    ctx.strokeStyle = '#d4dde3'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(944, 184, 130, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#38586b'; ctx.font = '900 28px "PingFang SC", sans-serif'; ctx.fillText(cardPlan?.cardGoalName || '企业笔试资料', 110, 118)
    drawRefTextBlock(ctx, title, 110, 266, 710, 68, '#243642', { align: 'left', maxLines: 4, minSize: 42 })
    drawRefTextBlock(ctx, tagText, 130, 754, 670, 38, '#fff', { maxLines: 1, minSize: 28 })
    drawRefContentText(ctx, 110, 920, 650, '', infoLines, '#243642', '#243642', 'left')
    drawRefPill(ctx, 190, 1236, W - 380, 96, '#38586b', footerText, '#fff', 26, 48)
    return
  }

  if (style === 'ref_brown_banner') {
    ctx.fillStyle = '#f5f3f0'; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#d1cbc4'; ctx.lineWidth = 3; ctx.strokeRect(60, 88, W - 120, H - 176); ctx.strokeRect(96, 122, W - 192, H - 244)
    ctx.fillStyle = '#5d4938'; ctx.fillRect(0, 70, 904, 148)
    ctx.fillStyle = '#fff'; ctx.font = '900 32px "PingFang SC", sans-serif'; ctx.fillText(cardPlan?.cardGoalName || '企业笔试学习资料', 70, 138)
    ctx.fillStyle = '#e7e3df'; ctx.fillRect(138, 240, W - 138, 178)
    drawRefTextBlock(ctx, title, 160, 244, W - 220, 54, '#3f3228', { maxLines: 3, minSize: 36, family: '"Songti SC", serif' })
    ctx.fillStyle = '#5d4938'; ctx.fillRect(0, 436, 966, 156)
    drawRefTextBlock(ctx, sub || cardPlan?.cardViewpoint || '资料内容与使用方法', 180, 474, 760, 54, '#fff', { maxLines: 1, minSize: 30 })
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(74, 626, W - 148, 696, 28); ctx.fill()
    drawRefTextBlock(ctx, tagText, 160, 730, W - 320, 42, '#5d4938', { maxLines: 1, minSize: 30 })
    drawRefContentText(ctx, 210, 930, W - 420, '', infoLines, '#3f3228', '#3f3228')
    drawRefPill(ctx, 190, 1214, W - 380, 96, '#5d4938', footerText, '#fff', 26, 48)
  }
}

const CONCEPT_CARD_STYLES = new Set([
  'concept_metro','concept_dashboard','concept_answer','concept_track','concept_tree','concept_countdown','concept_radar','concept_stairs','concept_puzzle','concept_compare',
  'concept_matrix','concept_compass','concept_ranking','concept_orbit','concept_elements','concept_funnel','concept_timeline','concept_target','concept_circuit','concept_bars',
])

function drawConceptHeader(ctx, left, right, color, accent) {
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = '800 27px "PingFang SC", sans-serif'
  ctx.fillText(left, 82, 72)
  ctx.textAlign = 'right'
  ctx.fillStyle = accent
  ctx.fillText(right, 998, 72)
  ctx.textAlign = 'left'
}

function drawConceptTitle(ctx, text, color, subColor, top = 180) {
  const { main, sub } = splitCardText(text || '')
  const title = main || 'XX集团笔试'
  const subtitle = sub || '先看资料结构，再安排学习顺序'
  const titleBottom = drawRefTextBlock(ctx, title, 82, top, 916, 72, color, { align: 'left', maxLines: 2, minSize: 54, lineHeight: 1.12 })
  drawRefTextBlock(ctx, subtitle, 82, titleBottom + 24, 916, 39, subColor, { align: 'left', maxLines: 2, minSize: 30, lineHeight: 1.2 })
}

function drawConceptFooter(ctx, color, lineColor, bottomHint) {
  const hint = bottomHint || '不同资料可以分阶段配合使用'
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(82, 1334); ctx.lineTo(998, 1334); ctx.stroke()
  ctx.fillStyle = color
  ctx.font = '700 25px "PingFang SC", sans-serif'
  ctx.fillText('企业笔试 · 学习资料', 82, 1360)
  ctx.textAlign = 'right'
  ctx.fillText(hint, 998, 1360)
  ctx.textAlign = 'left'
}

function drawConceptCardImage(ctx, W, H, style, text, bottomHint, cardPlan = null) {
  const dark = '#253a33'
  const orange = '#cf6347'
  const cream = '#f3f0e8'
  const planItems = cardPlan?.cardItems?.length ? cardPlan.cardItems : ['学习资料', '历年回忆题', '模拟练习', '复盘整理']
  const item = (index, fallback) => planItems[index % planItems.length] || fallback
  const goalName = cardPlan?.cardGoalName || '资料使用'
  const viewpoint = cardPlan?.cardViewpoint || '分步整理'
  const footer = cardPlan?.cardFooter || bottomHint || '先看目录，再安排学习顺序'
  ctx.clearRect(0, 0, W, H)
  ctx.textBaseline = 'top'

  if (style === 'concept_dashboard' || style === 'concept_countdown' || style === 'concept_ranking' || style === 'concept_circuit') {
    ctx.fillStyle = style === 'concept_dashboard' ? '#101b3a' : style === 'concept_circuit' ? '#12322c' : '#181a1d'
  } else if (style === 'concept_radar') ctx.fillStyle = '#eaf2fa'
  else if (style === 'concept_answer') ctx.fillStyle = '#f7f8f4'
  else if (style === 'concept_stairs') ctx.fillStyle = '#f3dfca'
  else if (style === 'concept_compare') {
    ctx.fillStyle = '#eeece7'; ctx.fillRect(0, 0, W / 2, H)
    ctx.fillStyle = '#17201d'; ctx.fillRect(W / 2, 0, W / 2, H)
    ctx.fillStyle = '#ffffff'; ctx.globalCompositeOperation = 'difference'
  } else if (style === 'concept_tree') ctx.fillStyle = '#f6f0df'
  else if (style === 'concept_orbit') ctx.fillStyle = '#f1e9df'
  else if (style === 'concept_elements') ctx.fillStyle = '#eef1e9'
  else if (style === 'concept_funnel') ctx.fillStyle = '#faf3e7'
  else if (style === 'concept_timeline') ctx.fillStyle = '#edf0f5'
  else if (style === 'concept_target') ctx.fillStyle = '#f2f1eb'
  else ctx.fillStyle = cream
  if (style !== 'concept_compare') ctx.fillRect(0, 0, W, H)

  if (style === 'concept_metro') {
    drawConceptHeader(ctx, '企业笔试资料', goalName, '#153b34', orange)
    drawConceptTitle(ctx, text, '#153b34', '#45665e')
    const ys = 780, xs = [150, 410, 670, 930]
    ctx.strokeStyle = '#178a78'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(xs[0], ys); ctx.lineTo(xs[3], ys); ctx.stroke()
    ;[item(0,'资料'),item(1,'练习'),item(2,'整理'),item(3,'复盘')].forEach((label, i) => {
      ctx.fillStyle = cream; ctx.strokeStyle = i % 2 ? orange : '#178a78'; ctx.lineWidth = 20
      ctx.beginPath(); ctx.arc(xs[i], ys, 47, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#153b34'; ctx.font = '900 31px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, xs[i], ys + 82)
      ctx.font = '700 20px sans-serif'; ctx.fillText(`0${i + 1}`, xs[i], ys - 14)
    })
    ctx.textAlign = 'left'; drawConceptFooter(ctx, '#153b34', '#b8c9c2', footer)
    return
  }

  if (style === 'concept_dashboard') {
    drawConceptHeader(ctx, 'WRITTEN TEST', '备考数据看板', '#6ee7d0', '#f5d467')
    drawConceptTitle(ctx, text, '#f7f4e9', '#aebcdb', 160)
    ctx.strokeStyle = '#26365e'; ctx.lineWidth = 50; ctx.beginPath(); ctx.arc(540, 800, 205, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = '#6ee7d0'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(540, 800, 205, -Math.PI / 2, Math.PI * 1.14); ctx.stroke(); ctx.lineCap = 'butt'
    ctx.fillStyle = '#f7f4e9'; ctx.font = '900 88px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('检查', 540, 742)
    ctx.fillStyle = '#8fa0c8'; ctx.font = '700 25px "PingFang SC", sans-serif'; ctx.fillText(viewpoint, 540, 876)
    const metrics = [[item(0,'资料'),'先梳理'],[item(1,'练习'),'再完成'],[item(2,'复盘'),'后检查']]
    metrics.forEach((item, i) => { const x = 95 + i * 305; ctx.fillStyle = '#19284f'; ctx.beginPath(); ctx.roundRect(x, 1080, 270, 125, 22); ctx.fill(); ctx.fillStyle = '#f5d467'; ctx.font = '900 40px sans-serif'; ctx.fillText(item[0], x + 135, 1100); ctx.fillStyle = '#c9d3eb'; ctx.font = '700 22px "PingFang SC", sans-serif'; ctx.fillText(item[1], x + 135, 1152) })
    ctx.textAlign = 'left'; drawConceptFooter(ctx, '#6ee7d0', '#33436c', footer); return
  }

  if (style === 'concept_answer') {
    ctx.strokeStyle = '#b7c7de'; ctx.lineWidth = 3; ctx.strokeRect(42, 42, W - 84, H - 84)
    drawConceptHeader(ctx, '企业招聘考试', 'ANSWER SHEET', '#173d6c', '#2c6eb4')
    ctx.fillStyle = '#2c6eb4'; ctx.fillRect(82, 120, 916, 12)
    drawConceptTitle(ctx, text, '#173d6c', '#56708f', 170)
    const rows = 3, cols = 2
    ctx.font = '700 29px monospace'; ctx.textAlign = 'left'
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const n = r * cols + c + 1, x = 105 + c * 455, y = 650 + r * 115
      ctx.strokeStyle = '#9eb0c5'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 405, 78)
      ctx.fillStyle = '#173d6c'; ctx.fillText(String(n).padStart(2, '0'), x + 20, y + 20)
      ;['A','B','C','D'].forEach((v, i) => { ctx.beginPath(); ctx.arc(x + 125 + i * 70, y + 39, 18, 0, Math.PI * 2); if (i === (n - 1) % 4) ctx.fill(); else ctx.stroke(); ctx.fillStyle = i === (n - 1) % 4 ? '#fff' : '#173d6c'; ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(v, x + 125 + i * 70, y + 29); ctx.textAlign = 'left'; ctx.font = '700 29px monospace' })
    }
    for (let x = 82; x < 998; x += 18) { ctx.fillStyle = x % 36 ? '#173d6c' : '#8194ab'; ctx.fillRect(x, 1080, x % 54 ? 6 : 11, 65) }
    drawConceptFooter(ctx, '#173d6c', '#b7c7de', footer); return
  }

  if (style === 'concept_track') {
    drawConceptHeader(ctx, 'STEP BY STEP', '笔试进阶路线', dark, orange); drawConceptTitle(ctx, text, dark, '#61756d')
    ctx.strokeStyle = dark; ctx.lineWidth = 78; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(150, 1120); ctx.bezierCurveTo(210, 880, 400, 1010, 500, 790); ctx.bezierCurveTo(600, 580, 790, 700, 930, 500); ctx.stroke(); ctx.lineCap = 'butt'
    const pts = [[150,1120],[388,905],[630,710],[930,500]], labels = [item(0,'资料'),item(1,'练习'),item(2,'整理'),item(3,'复盘')]
    pts.forEach((p, i) => { ctx.fillStyle = i === 3 ? dark : orange; ctx.beginPath(); ctx.arc(p[0], p[1], 52, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 25px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[i], p[0], p[1] - 14) })
    ctx.textAlign = 'left'; drawConceptFooter(ctx, dark, '#b9c4bd', footer); return
  }

  if (style === 'concept_tree') {
    drawConceptHeader(ctx, 'KNOWLEDGE MAP', '企业招聘考试', '#173d2f', '#a77b31'); drawConceptTitle(ctx, text, '#173d2f', '#607166')
    ctx.fillStyle = '#7e6232'; ctx.beginPath(); ctx.moveTo(500, 1180); ctx.lineTo(580, 1180); ctx.lineTo(558, 665); ctx.lineTo(520, 665); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#7e6232'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(540, 825); ctx.lineTo(320, 650); ctx.moveTo(540, 760); ctx.lineTo(760, 580); ctx.stroke()
    const leaves = [[220,590,item(0,'资料')],[390,520,item(1,'练习')],[585,490,item(2,'整理')],[790,610,item(3,'复盘')],[690,790,item(4,'检查')]]
    leaves.forEach((p, i) => { ctx.fillStyle = i === 4 ? '#d1b15f' : '#cadbb4'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 100, 66, i % 2 ? .2 : -.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#173d2f'; ctx.font = '900 27px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p[2], p[0], p[1] - 14) })
    ctx.textAlign = 'left'; drawConceptFooter(ctx, '#173d2f', '#c9c2ac', footer); return
  }

  if (style === 'concept_countdown') {
    drawConceptHeader(ctx, '分阶段学习计划', 'STUDY PLAN', '#f5f0df', '#ef7839')
    ;['阶','段'].forEach((n, i) => { const x = 250 + i * 310; const grad = ctx.createLinearGradient(0, 390, 0, 680); grad.addColorStop(0, '#353535'); grad.addColorStop(.49, '#353535'); grad.addColorStop(.5, '#222'); grad.addColorStop(1, '#222'); ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(x, 330, 270, 350, 25); ctx.fill(); ctx.fillStyle = '#f5f0df'; ctx.font = '900 180px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(n, x + 135, 400) })
    ctx.fillStyle = '#ef7839'; ctx.font = '800 27px sans-serif'; ctx.fillText('PLAN', 822, 628)
    ctx.textAlign = 'left'; drawConceptTitle(ctx, text, '#f5f0df', '#b9b6aa', 780)
    drawConceptFooter(ctx, '#ef7839', '#424242', footer); return
  }

  if (style === 'concept_radar') {
    drawConceptHeader(ctx, '笔试能力模型', '企业招聘考试', '#183a63', '#e46755'); drawConceptTitle(ctx, text, '#183a63', '#58708a')
    const cx = 540, cy = 840, radius = 280, angles = [-Math.PI/2,-Math.PI/10,3*Math.PI/10,7*Math.PI/10,11*Math.PI/10]
    const point = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
    ctx.strokeStyle = '#91a9c1'; ctx.lineWidth = 3
    ;[1,.65].forEach(k => { ctx.beginPath(); angles.forEach((a,i) => { const p=point(radius*k,a); i?ctx.lineTo(...p):ctx.moveTo(...p) }); ctx.closePath(); ctx.stroke() })
    angles.forEach(a => { const p=point(radius,a); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(...p); ctx.stroke() })
    const values=[.92,.77,.72,.88,.64]; ctx.fillStyle='rgba(228,103,85,.25)'; ctx.strokeStyle='#e46755'; ctx.lineWidth=7; ctx.beginPath(); angles.forEach((a,i)=>{const p=point(radius*values[i],a);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.fill();ctx.stroke()
    ;[item(0,'资料'),item(1,'练习'),item(2,'整理'),item(3,'复盘'),item(4,'检查')].forEach((v,i)=>{const p=point(radius+62,angles[i]);ctx.fillStyle='#183a63';ctx.font='900 24px "PingFang SC", sans-serif';ctx.textAlign='center';ctx.fillText(v,p[0],p[1]-14)})
    ctx.textAlign='left';drawConceptFooter(ctx,'#183a63','#b9c8d8',footer);return
  }

  if (style === 'concept_stairs') {
    drawConceptHeader(ctx,'4 STEPS','四步学习路径',dark,'#b94e35');drawConceptTitle(ctx,text,dark,'#687970')
    const colors=['#d2a778','#b97e5d','#6b8168',dark], labels=[item(0,'资料'),item(1,'练习'),item(2,'整理'),item(3,'复盘')]
    colors.forEach((c,i)=>{const x=90+i*230,h=170+i*120,y=1190-h;ctx.fillStyle=c;ctx.fillRect(x,y,230,h);ctx.fillStyle=i>1?'#fff':dark;ctx.font='900 28px "PingFang SC", sans-serif';ctx.fillText(`0${i+1}`,x+28,y+30);ctx.font='900 38px "PingFang SC", sans-serif';ctx.fillText(labels[i],x+28,y+78)})
    drawConceptFooter(ctx,dark,'#bcae9d',footer);return
  }

  if (style === 'concept_puzzle') {
    drawConceptHeader(ctx,'完整备考拼图','企业招聘考试','#252c3a','#7657c8');drawConceptTitle(ctx,text,'#252c3a','#5d6470')
    const blocks=[[item(0,'资料'),'先认识内容','#cbe1d4'],[item(1,'练习'),'按顺序完成','#efd28a'],[item(2,'整理'),'记录问题','#bdcbed'],[item(3,'复盘'),'安排下一轮','#e3bbd0']]
    blocks.forEach((b,i)=>{const x=90+(i%2)*455,y=600+Math.floor(i/2)*260;ctx.fillStyle=b[2];ctx.beginPath();ctx.roundRect(x,y,415,220,i%2?[55,18,55,18]:[18,55,18,55]);ctx.fill();ctx.fillStyle='#252c3a';ctx.font='900 48px "PingFang SC",sans-serif';ctx.fillText(b[0],x+42,y+46);ctx.font='700 25px "PingFang SC",sans-serif';ctx.fillText(b[1],x+42,y+120)})
    drawConceptFooter(ctx,'#252c3a','#c7c4bd',footer);return
  }

  if (style === 'concept_compare') {
    ctx.globalCompositeOperation='source-over';drawConceptHeader(ctx,'学习阶段对照','TWO ROUNDS','#303532','#ef6b49')
    const {main,sub}=splitCardText(text||'');ctx.fillStyle='#fff';ctx.globalCompositeOperation='difference';drawRefTextBlock(ctx,main||'企业笔试',82,180,916,72,'#fff',{align:'left',maxLines:2,minSize:54});drawRefTextBlock(ctx,sub||viewpoint,82,300,916,39,'#fff',{align:'left',maxLines:2,minSize:30});ctx.globalCompositeOperation='source-over'
    const cols=[{x:80,color:'#343936',title:'第一轮',items:[item(0,'认识资料'),item(1,'完成练习'),'记录问题']},{x:580,color:'#fff',title:'第二轮',items:['回看记录',item(2,'检查薄弱'),item(3,'完成复盘')]}]
    cols.forEach((col,ci)=>{ctx.fillStyle=ci?'#ef6b49':'#343936';ctx.font='900 42px "PingFang SC",sans-serif';ctx.fillText(col.title,col.x,620);col.items.forEach((v,i)=>{ctx.fillStyle=col.color;ctx.font='700 29px "PingFang SC",sans-serif';ctx.fillText(v,col.x,730+i*115);ctx.strokeStyle=ci?'#52615b':'#b8b5ae';ctx.beginPath();ctx.moveTo(col.x,780+i*115);ctx.lineTo(col.x+390,780+i*115);ctx.stroke()})})
    ctx.fillStyle='#fff';ctx.globalCompositeOperation='difference';drawConceptFooter(ctx,'#fff','#fff',footer);ctx.globalCompositeOperation='source-over';return
  }

  if (style === 'concept_matrix') {
    drawConceptHeader(ctx,'复习优先级矩阵','企业招聘考试',dark,orange);drawConceptTitle(ctx,text,dark,'#65736c')
    const cells=[[item(0,'资料内容'),'先浏览',dark,'#fff'],[item(1,'练习内容'),'按顺序完成','#ddb85d',dark],[item(2,'错误记录'),'集中整理','#e6dfce',dark],[item(3,'复盘内容'),'安排下一轮','#d6e2db',dark]]
    cells.forEach((c,i)=>{const x=90+(i%2)*450,y=610+Math.floor(i/2)*240;ctx.fillStyle=c[2];ctx.fillRect(x,y,430,220);ctx.fillStyle=c[3];ctx.font='700 28px "PingFang SC",sans-serif';ctx.fillText(c[0],x+38,y+45);ctx.font='900 39px "PingFang SC",sans-serif';ctx.fillText(c[1],x+38,y+105)})
    drawConceptFooter(ctx,dark,'#beb8a9',footer);return
  }

  if (style === 'concept_compass') {
    ctx.fillStyle='#e8eee8';ctx.fillRect(0,0,W,H);drawConceptHeader(ctx,'STUDY COMPASS','找准复习方向','#173c35',orange);drawConceptTitle(ctx,text,'#173c35','#60736c')
    const cx=540,cy=870;ctx.strokeStyle='#173c35';ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,280,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#93a69f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy-280);ctx.lineTo(cx,cy+280);ctx.moveTo(cx-280,cy);ctx.lineTo(cx+280,cy);ctx.stroke()
    ctx.fillStyle=orange;ctx.beginPath();ctx.moveTo(cx+115,cy-220);ctx.lineTo(cx+26,cy+20);ctx.lineTo(cx-28,cy-25);ctx.closePath();ctx.fill();ctx.fillStyle='#173c35';ctx.beginPath();ctx.moveTo(cx-115,cy+220);ctx.lineTo(cx-26,cy-20);ctx.lineTo(cx+28,cy+25);ctx.closePath();ctx.fill();ctx.font='900 34px sans-serif';ctx.textAlign='center';ctx.fillText('N',cx,cy-258);ctx.font='900 39px "PingFang SC",sans-serif';ctx.fillText(item(0,'学习资料'),cx,cy-22);ctx.font='700 24px "PingFang SC",sans-serif';ctx.fillText(`${item(1,'练习')} → ${item(2,'整理')} → ${item(3,'复盘')}`,cx,cy+45);ctx.textAlign='left';drawConceptFooter(ctx,'#173c35','#b9c8c1',footer);return
  }

  if (style === 'concept_ranking') {
    drawConceptHeader(ctx,'内容使用顺序','企业笔试资料','#f0f2f3','#f3bd58');drawConceptTitle(ctx,text,'#f0f2f3','#adb7c5')
    const rows=[['01',item(0,'学习资料'),'先认识内容'],['02',item(1,'练习内容'),'按顺序完成'],['03',item(2,'复盘整理'),'回看问题']]
    rows.forEach((r,i)=>{const y=625+i*180;ctx.fillStyle='#263247';ctx.beginPath();ctx.roundRect(90,y,900,140,22);ctx.fill();ctx.fillStyle='#f3bd58';ctx.font='900 54px sans-serif';ctx.fillText(r[0],125,y+39);ctx.fillStyle='#fff';ctx.font='900 36px "PingFang SC",sans-serif';ctx.fillText(r[1],270,y+35);ctx.fillStyle='#aeb8c8';ctx.font='700 24px "PingFang SC",sans-serif';ctx.fillText(r[2],270,y+86)})
    drawConceptFooter(ctx,'#f3bd58','#3a4557',footer);return
  }

  if (style === 'concept_orbit') {
    drawConceptHeader(ctx,'CORE SYSTEM','核心知识轨道',dark,orange);drawConceptTitle(ctx,text,dark,'#6d756f')
    const cx=540,cy=850;ctx.strokeStyle='#9ea69f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,285,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,185,0,Math.PI*2);ctx.stroke();ctx.fillStyle=dark;ctx.beginPath();ctx.arc(cx,cy,120,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 37px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText('笔试核心',cx,cy-20)
    const points=[[cx,cy-285,item(0,'资料')],[cx+285,cy,item(1,'练习')],[cx,cy+285,item(2,'整理')],[cx-285,cy,item(3,'复盘')]];points.forEach(p=>{ctx.fillStyle=orange;ctx.beginPath();ctx.arc(p[0],p[1],50,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 22px "PingFang SC",sans-serif';ctx.fillText(p[2],p[0],p[1]-13)});ctx.textAlign='left';drawConceptFooter(ctx,dark,'#c8beb2',footer);return
  }

  if (style === 'concept_elements') {
    drawConceptHeader(ctx,'笔试考点元素表','企业招聘考试',dark,'#ad5a45');drawConceptTitle(ctx,text,dark,'#68766f')
    const items=[['01',item(0,'资料')],['02',item(1,'练习')],['03',item(2,'整理')],['04',item(3,'复盘')],['05',item(4,'检查')],['06',item(5,'下一轮')]]
    items.forEach((it,i)=>{const x=90+(i%3)*305,y=600+Math.floor(i/3)*260,darkCell=i%2===1;ctx.fillStyle=darkCell?dark:'#f6f7f1';ctx.strokeStyle='#9faa9f';ctx.lineWidth=3;ctx.fillRect(x,y,270,220);ctx.strokeRect(x,y,270,220);ctx.fillStyle=darkCell?'#e5bd6a':'#ad5a45';ctx.font='900 72px sans-serif';ctx.fillText(it[0],x+30,y+30);ctx.fillStyle=darkCell?'#fff':dark;ctx.font='700 28px "PingFang SC",sans-serif';ctx.fillText(it[1],x+32,y+140)})
    drawConceptFooter(ctx,dark,'#b9c2ba',footer);return
  }

  if (style === 'concept_funnel') {
    drawConceptHeader(ctx,'FOCUS','复习范围逐步收紧',dark,orange);drawConceptTitle(ctx,text,dark,'#6c756f')
    const levels=[[item(0,'资料目录'),850,dark],[item(1,'练习内容'),700,'#486158'],[item(2,'问题记录'),560,'#788b74'],[item(3,'薄弱内容'),420,'#b98b5c'],[item(4,'下一轮重点'),300,orange]]
    levels.forEach((l,i)=>{const x=(W-l[1])/2,y=590+i*125;ctx.fillStyle=l[2];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+l[1],y);ctx.lineTo(x+l[1]-55,y+100);ctx.lineTo(x+55,y+100);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.font='900 28px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText(l[0],W/2,y+32)});ctx.textAlign='left';drawConceptFooter(ctx,dark,'#c8bfae',footer);return
  }

  if (style === 'concept_timeline') {
    drawConceptHeader(ctx,'分阶段学习时间轴','企业笔试资料','#243655',orange);drawConceptTitle(ctx,text,'#243655','#66758c')
    ctx.strokeStyle='#243655';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(180,590);ctx.lineTo(180,1180);ctx.stroke();const rows=[['01',item(0,'认识资料')],['02',item(1,'开始练习')],['03',item(2,'整理问题')],['04',item(3,'完成复盘')]]
    rows.forEach((r,i)=>{const y=610+i*170;ctx.fillStyle=orange;ctx.beginPath();ctx.arc(180,y,24,0,Math.PI*2);ctx.fill();ctx.fillStyle='#243655';ctx.font='900 35px sans-serif';ctx.fillText(r[0],245,y-35);ctx.font='900 40px "PingFang SC",sans-serif';ctx.fillText(r[1],430,y-37);ctx.strokeStyle='#b8c2d0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(245,y+35);ctx.lineTo(940,y+35);ctx.stroke()});drawConceptFooter(ctx,'#243655','#bdc7d4',footer);return
  }

  if (style === 'concept_target') {
    drawConceptHeader(ctx,'FOCUS PLAN','集中整理一个重点',dark,'#6b8177');drawConceptTitle(ctx,text,dark,'#687970')
    ctx.fillStyle='#dfe7e1';ctx.beginPath();ctx.arc(540,835,290,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c5d4cc';ctx.beginPath();ctx.arc(540,835,205,0,Math.PI*2);ctx.fill();ctx.fillStyle='#91aa9d';ctx.beginPath();ctx.arc(540,835,125,0,Math.PI*2);ctx.fill();ctx.fillStyle=dark;ctx.beginPath();ctx.arc(540,835,80,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='700 21px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText('本页重点',540,796);ctx.font='900 25px "PingFang SC",sans-serif';ctx.fillText(item(0,'资料使用'),540,835)
    ;[item(1,'明确问题'),item(2,'完成练习'),item(3,'及时复盘')].forEach((v,i)=>{const x=250+i*220;ctx.fillStyle=i===1?'#d5dfd9':'#e2e7e2';ctx.beginPath();ctx.roundRect(x,1160,180,58,29);ctx.fill();ctx.fillStyle='#41574f';ctx.font='700 20px "PingFang SC",sans-serif';ctx.fillText(v,x+90,1175)});ctx.textAlign='left';drawConceptFooter(ctx,'#687970','#c5cec8',footer);return
  }

  if (style === 'concept_circuit') {
    drawConceptHeader(ctx,'解题思路电路图','企业招聘考试','#eef4eb','#70deb0');drawConceptTitle(ctx,text,'#eef4eb','#b8cbc3')
    const labels=[item(0,'开始'),item(1,'练习'),item(2,'整理'),item(3,'复盘')];labels.forEach((v,i)=>{const x=90+i*245,y=720;ctx.strokeStyle='#70deb0';ctx.lineWidth=5;ctx.strokeRect(x,y,150,150);ctx.fillStyle='#eef4eb';ctx.font='900 26px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText(v,x+75,y+55);if(i<3){ctx.strokeStyle='#70deb0';ctx.beginPath();ctx.moveTo(x+150,y+75);ctx.lineTo(x+245,y+75);ctx.stroke();ctx.fillStyle='#70deb0';ctx.beginPath();ctx.moveTo(x+245,y+75);ctx.lineTo(x+220,y+60);ctx.lineTo(x+220,y+90);ctx.closePath();ctx.fill()}});ctx.fillStyle='#70deb0';ctx.font='700 22px monospace';ctx.textAlign='left';ctx.fillText('START',90,980);ctx.textAlign='right';ctx.fillText('REVIEW',990,980);ctx.setLineDash([15,12]);ctx.strokeStyle='#70deb0';ctx.beginPath();ctx.moveTo(90,1040);ctx.lineTo(990,1040);ctx.stroke();ctx.setLineDash([]);ctx.textAlign='left';drawConceptFooter(ctx,'#70deb0','#35584f',footer);return
  }

  if (style === 'concept_bars') {
    drawConceptHeader(ctx,'STUDY STATUS','学习内容状态图',dark,orange);drawConceptTitle(ctx,text,dark,'#68756f')
    const values=[.52,.70,.43,.82,.60],labels=[item(0,'资料'),item(1,'练习'),item(2,'整理'),item(3,'复盘'),item(4,'检查')];ctx.strokeStyle=dark;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(100,1120);ctx.lineTo(980,1120);ctx.stroke();values.forEach((v,i)=>{const x=130+i*175,h=500*v;ctx.fillStyle=i%2?dark:orange;ctx.fillRect(x,1120-h,105,h);ctx.fillStyle=dark;ctx.font='800 21px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText(labels[i],x+52,1147);ctx.font='700 17px "PingFang SC",sans-serif';ctx.fillText(['待开始','进行中','待整理','需复盘','再检查'][i],x+52,1080-h)});ctx.textAlign='left';drawConceptFooter(ctx,dark,'#c1baac',footer);return
  }
}

const VIRTUAL_STYLE_GROUPS = {
  material: [...VIRTUAL_MATERIAL_STYLE_IDS],
  index: [...VIRTUAL_INDEX_STYLE_IDS],
  route: [...VIRTUAL_ROUTE_STYLE_IDS],
  review: [...VIRTUAL_REVIEW_STYLE_IDS],
  focus: [...VIRTUAL_FOCUS_STYLE_IDS],
}

const VIRTUAL_STYLE_PALETTES = [
  { bg: '#f1eadb', paper: '#fffaf0', ink: '#24382f', accent: '#2f6f55', soft: '#d9e6dc' },
  { bg: '#e8eef2', paper: '#fbfdff', ink: '#17324d', accent: '#3976a8', soft: '#dce9f4' },
  { bg: '#f5eee6', paper: '#fffaf5', ink: '#4b3227', accent: '#b65f45', soft: '#efd9cc' },
  { bg: '#ece9f2', paper: '#fdfbff', ink: '#342e4d', accent: '#735ca7', soft: '#e1daef' },
  { bg: '#edf1e8', paper: '#fbfdf7', ink: '#30402f', accent: '#718b58', soft: '#dfe8d5' },
  { bg: '#f4ecec', paper: '#fffafa', ink: '#4c2e32', accent: '#b4515a', soft: '#efd7da' },
  { bg: '#e8f1ef', paper: '#f9fdfc', ink: '#183f3a', accent: '#248278', soft: '#d4e9e5' },
  { bg: '#f3efe5', paper: '#fffdf8', ink: '#403724', accent: '#c08a36', soft: '#eee0bd' },
]

function getVirtualStyleMeta(style) {
  for (const [group, styles] of Object.entries(VIRTUAL_STYLE_GROUPS)) {
    const index = styles.indexOf(style)
    if (index >= 0) return { group, index, palette: VIRTUAL_STYLE_PALETTES[index % VIRTUAL_STYLE_PALETTES.length] }
  }
  return { group: 'material', index: 0, palette: VIRTUAL_STYLE_PALETTES[0] }
}

function pickVirtualLayoutVariant(style) {
  let bag = _CARD_LAYOUT_VARIANT_BAGS.get(style) || []
  if (!bag.length) bag = shuffledCopy([0, 1, 2])
  const variant = bag.pop()
  _CARD_LAYOUT_VARIANT_BAGS.set(style, bag)
  return variant
}

function drawVirtualHeader(ctx, W, text, plan, palette, variant) {
  const { main, sub } = splitCardText(text || '')
  const title = main || '企业名称笔试'
  const topic = sub || plan?.cardViewpoint || plan?.cardGoalName || '资料使用说明'
  const centered = variant === 1
  const left = variant === 2 ? 145 : 76
  const width = variant === 2 ? W - 220 : W - 152
  if (variant === 2) {
    ctx.fillStyle = palette.accent
    ctx.fillRect(0, 0, 92, 560)
    ctx.save(); ctx.translate(29, 470); ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#fff'; ctx.font = '800 25px "PingFang SC", sans-serif'; ctx.fillText(plan?.cardGoalName || '企业笔试', 0, 0); ctx.restore()
  }
  ctx.fillStyle = palette.ink
  ctx.font = '800 24px "PingFang SC", sans-serif'
  ctx.textAlign = centered ? 'center' : 'left'
  ctx.fillText((plan?.cardGoalName || '企业笔试').toUpperCase(), centered ? W / 2 : left, 68)
  const bottom = drawRefTextBlock(ctx, title, left, 118, width, variant === 1 ? 82 : 76, palette.ink, {
    align: centered ? 'center' : 'left', maxLines: 3, minSize: 54, lineHeight: 1.08,
  })
  drawRefTextBlock(ctx, topic, left, bottom + 22, width, 35, palette.accent, {
    align: centered ? 'center' : 'left', maxLines: 2, minSize: 27, lineHeight: 1.18,
  })
  ctx.textAlign = 'left'
  return Math.max(bottom + 92, variant === 1 ? 470 : 430)
}

function drawVirtualFooter(ctx, W, H, palette, plan) {
  ctx.strokeStyle = palette.ink; ctx.globalAlpha = .2; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(76, H - 108); ctx.lineTo(W - 76, H - 108); ctx.stroke(); ctx.globalAlpha = 1
  ctx.fillStyle = palette.ink; ctx.font = '700 24px "PingFang SC", sans-serif'
  ctx.fillText('企业笔试 · 学习资料', 76, H - 78)
  ctx.textAlign = 'right'; ctx.fillText(plan?.cardFooter || '先看目录，再安排学习顺序', W - 76, H - 78); ctx.textAlign = 'left'
}

function drawVirtualMaterial(ctx, W, H, meta, top, plan, variant) {
  const { palette, index } = meta
  const items = (plan?.cardItems?.length ? plan.cardItems : ['学习资料','历年回忆题','模拟练习','使用说明']).slice(0, variant === 1 ? 3 : 4)
  const x = variant === 2 ? 150 : 86, width = W - x - 86
  if (index === 1) { ctx.fillStyle = palette.ink; ctx.beginPath(); ctx.roundRect(x, top, width, 48, [18,18,0,0]); ctx.fill(); ['#ef7b65','#e8b74f','#5fa77e'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+30+i*30,top+24,8,0,Math.PI*2);ctx.fill()}); top += 70 }
  if (index === 2) { ctx.fillStyle = palette.soft; ctx.beginPath(); ctx.arc(W/2,top+80,78,Math.PI,0);ctx.arc(W/2+78,top+80,60,Math.PI,0);ctx.arc(W/2-74,top+84,52,Math.PI,0);ctx.fill(); top += 100 }
  if (index === 4) { ctx.strokeStyle = palette.accent; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W-165,top+70,68,0,Math.PI*2);ctx.stroke();ctx.font='800 23px "PingFang SC"';ctx.fillStyle=palette.accent;ctx.textAlign='center';ctx.fillText('资料归档',W-165,top+55);ctx.textAlign='left' }
  if (index === 6) { for(let y=top+10;y<top+520;y+=72){ctx.strokeStyle='#aaa59b';ctx.lineWidth=8;ctx.beginPath();ctx.arc(x-12,y,22,-Math.PI/2,Math.PI/2);ctx.stroke()} }
  const stacked = index === 3 || index === 5
  items.forEach((label, i) => {
    const yy = top + i * (stacked ? 102 : 124) + (stacked ? i * 8 : 0)
    const xx = x + (stacked ? i * 18 : 0)
    ctx.fillStyle = i % 2 ? palette.paper : palette.soft
    ctx.beginPath(); ctx.roundRect(xx, yy, width - (stacked ? i * 36 : 0), stacked ? 112 : 102, 16); ctx.fill()
    ctx.strokeStyle = palette.ink; ctx.globalAlpha=.18;ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1
    if (index === 0) { ctx.strokeStyle=palette.accent;ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(xx+28,yy+31,74,24,12);ctx.stroke() }
    if (index === 7) { ctx.fillStyle=palette.accent;ctx.beginPath();ctx.arc(xx+54,yy+51,25,0,Math.PI*2);ctx.fill() }
    ctx.fillStyle = palette.ink; ctx.font = '800 31px "PingFang SC", sans-serif'; ctx.fillText(label, xx + (index===0?130:100), yy + 30)
    ctx.font='600 20px "PingFang SC", sans-serif';ctx.fillStyle=palette.accent;ctx.fillText(`0${i+1}`,xx+32,yy+35)
  })
}

function drawVirtualIndex(ctx, W, H, meta, top, plan, variant) {
  const { palette, index } = meta
  const items = (plan?.cardItems?.length ? plan.cardItems : ['学习资料','历年回忆题','模拟练习','复盘整理']).slice(0, variant === 0 ? 4 : 3)
  const x = variant === 2 ? 150 : 82, width = W - x - 82
  ctx.fillStyle=palette.paper;ctx.beginPath();ctx.roundRect(x,top,width,640,18);ctx.fill()
  if ([1,5].includes(index)) { ['A','B','C'].forEach((v,i)=>{ctx.fillStyle=[palette.soft,palette.accent,palette.ink][i];ctx.fillRect(x+38+i*86,top-24,70,28);ctx.fillStyle=i?palette.paper:palette.ink;ctx.font='700 17px sans-serif';ctx.fillText(v,x+65+i*86,top-20)}) }
  if (index === 6) { ctx.strokeStyle=palette.ink;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x+42,top+34,width-84,70,35);ctx.stroke();ctx.beginPath();ctx.arc(x+82,top+69,18,0,Math.PI*2);ctx.stroke();ctx.moveTo(x+95,top+82);ctx.lineTo(x+112,top+99);ctx.stroke();top+=100 }
  items.forEach((label,i)=>{
    const columns = variant === 1 || index === 3 || index === 7
    const cw = columns ? (width-72)/2 : width-72
    const xx=x+36+(columns?(i%2)*(cw+16):0), yy=top+40+(columns?Math.floor(i/2)*190:i*128)
    ctx.fillStyle=i%2?palette.soft:palette.bg;ctx.beginPath();ctx.roundRect(xx,yy,cw,columns?160:102,14);ctx.fill()
    ctx.fillStyle=palette.accent;ctx.font='800 25px monospace';ctx.fillText(String(i+1).padStart(2,'0'),xx+22,yy+20)
    ctx.fillStyle=palette.ink;ctx.font='800 29px "PingFang SC",sans-serif';ctx.fillText(label,xx+72,yy+20)
    if(index===2){ctx.strokeStyle=palette.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(xx+35,yy+62);ctx.lineTo(xx+35,yy+92);ctx.lineTo(xx+65,yy+92);ctx.stroke()}
  })
}

function drawVirtualRoute(ctx, W, H, meta, top, plan, variant) {
  const { palette, index } = meta
  const items = (plan?.cardItems?.length ? plan.cardItems : ['先看目录','开始练习','分类整理','完成复盘']).slice(0,4)
  const left = variant===2?170:120, right=W-110
  if (variant === 1 || index === 4) {
    const cx=W/2,cy=top+300,r=235;ctx.strokeStyle=palette.accent;ctx.lineWidth=18;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke()
    items.forEach((label,i)=>{const a=-Math.PI/2+i*Math.PI/2,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;ctx.fillStyle=palette.paper;ctx.strokeStyle=palette.accent;ctx.lineWidth=10;ctx.beginPath();ctx.arc(x,y,55,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=palette.ink;ctx.font='800 25px "PingFang SC"';ctx.textAlign='center';ctx.fillText(label,x,y+75)});ctx.textAlign='left'
  } else if (variant === 2 || [0,1,3].includes(index)) {
    ctx.strokeStyle=palette.accent;ctx.lineWidth=index===1?14:8;ctx.beginPath();ctx.moveTo(left,top+30);ctx.lineTo(left,top+560);ctx.stroke()
    items.forEach((label,i)=>{const y=top+40+i*150;ctx.fillStyle=palette.accent;ctx.beginPath();ctx.arc(left,y,30,0,Math.PI*2);ctx.fill();ctx.fillStyle=palette.paper;ctx.font='800 20px monospace';ctx.textAlign='center';ctx.fillText(i+1,left,y-11);ctx.textAlign='left';ctx.fillStyle=i%2?palette.soft:palette.paper;ctx.beginPath();ctx.roundRect(left+62,y-48,right-left-62,96,14);ctx.fill();ctx.fillStyle=palette.ink;ctx.font='800 30px "PingFang SC"';ctx.fillText(label,left+90,y-18)});ctx.textAlign='left'
  } else {
    const y=top+280;ctx.strokeStyle=palette.accent;ctx.lineWidth=index===7?22:10;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke()
    items.forEach((label,i)=>{const x=left+i*(right-left)/3;ctx.fillStyle=palette.paper;ctx.strokeStyle=palette.accent;ctx.lineWidth=10;ctx.beginPath();ctx.arc(x,y,43,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=palette.ink;ctx.font='800 25px "PingFang SC"';ctx.textAlign='center';ctx.fillText(label,x,y+72)});ctx.textAlign='left'
  }
}

function drawVirtualReview(ctx, W, H, meta, top, plan, variant) {
  const { palette, index } = meta
  const items = (plan?.cardItems?.length ? plan.cardItems : ['完成情况','错误原因','薄弱内容','下一轮重点']).slice(0,variant===1?3:4)
  const x=variant===2?150:82,width=W-x-82
  if(index===1){
    items.forEach((label,i)=>{const cols=variant!==2,ww=cols?(width-20)/2:width,xx=x+(cols?(i%2)*(ww+20):0),yy=top+(cols?Math.floor(i/2)*230:i*135);ctx.save();ctx.translate(xx,yy);ctx.rotate((i%2?1:-1)*.025);ctx.fillStyle=[palette.soft,'#f2ddb0','#dbe3f0','#efcfca'][i];ctx.fillRect(0,0,ww,cols?200:112);ctx.fillStyle=palette.ink;ctx.font='800 29px "PingFang SC"';ctx.fillText(label,28,55);ctx.restore()})
  } else if(index===4 || index===5){
    const cols=variant===1?3:2,ww=(width-(cols-1)*16)/cols;items.forEach((label,i)=>{const xx=x+(i%cols)*(ww+16),yy=top+Math.floor(i/cols)*210;ctx.fillStyle=i%2?palette.soft:palette.paper;ctx.beginPath();ctx.roundRect(xx,yy,ww,180,18);ctx.fill();ctx.fillStyle=palette.accent;ctx.font='800 40px monospace';ctx.fillText(`0${i+1}`,xx+24,yy+24);ctx.fillStyle=palette.ink;ctx.font='800 25px "PingFang SC"';ctx.fillText(label,xx+24,yy+100)})
  } else {
    items.forEach((label,i)=>{const y=top+i*126;ctx.fillStyle=palette.paper;ctx.beginPath();ctx.roundRect(x,y,width,102,12);ctx.fill();ctx.strokeStyle=palette.accent;ctx.lineWidth=4;ctx.strokeRect(x+26,y+34,28,28);if(index===0||index===6){ctx.beginPath();ctx.moveTo(x+31,y+46);ctx.lineTo(x+39,y+56);ctx.lineTo(x+56,y+34);ctx.stroke()}ctx.fillStyle=palette.ink;ctx.font='800 29px "PingFang SC"';ctx.fillText(label,x+82,y+28);ctx.font='600 20px "PingFang SC"';ctx.fillStyle=palette.accent;ctx.fillText(index===2?'记录原因':index===3?'本轮复盘':'逐项检查',x+82,y+64)})
  }
}

function drawVirtualFocus(ctx, W, H, meta, top, plan, variant) {
  const { palette, index } = meta
  const items = (plan?.cardItems?.length ? plan.cardItems : ['明确问题','查找内容','完成练习','记录结果']).slice(0,4)
  const x=variant===2?150:82,width=W-x-82
  if(index===0 || index===7){
    const count=variant===1?3:4;items.slice(0,count).forEach((label,i)=>{const right=i%2===0,ww=width*(i===0?.76:.64),xx=right?x+width-ww:x,yy=top+i*130;ctx.fillStyle=right?palette.accent:palette.paper;ctx.beginPath();ctx.roundRect(xx,yy,ww,104,[22,22,right?4:22,right?22:4]);ctx.fill();ctx.fillStyle=right?palette.paper:palette.ink;ctx.font='800 27px "PingFang SC"';ctx.fillText(label,xx+26,yy+33)})
  } else if(index===3){
    ctx.strokeStyle=palette.accent;ctx.lineWidth=18;ctx.beginPath();ctx.arc(x+width/2,top+220,150,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+width/2+105,top+325);ctx.lineTo(x+width/2+220,top+440);ctx.stroke();ctx.fillStyle=palette.ink;ctx.font='800 38px "PingFang SC"';ctx.textAlign='center';ctx.fillText(items[0],x+width/2,top+195);ctx.textAlign='left';items.slice(1).forEach((v,i)=>{ctx.fillStyle=palette.soft;ctx.beginPath();ctx.roundRect(x+i*245,top+520,220,72,36);ctx.fill();ctx.fillStyle=palette.ink;ctx.font='700 22px "PingFang SC"';ctx.textAlign='center';ctx.fillText(v,x+i*245+110,top+540)});ctx.textAlign='left'
  } else if(index===5){
    ctx.fillStyle='#25463b';ctx.fillRect(x,top,width,580);ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;for(let y=top+80;y<top+560;y+=80){ctx.beginPath();ctx.moveTo(x+35,y);ctx.lineTo(x+width-35,y);ctx.stroke()}items.forEach((v,i)=>{ctx.fillStyle=i===0?'#f2d16e':'#fff';ctx.font=`${i===0?'800 42':'700 28'}px "PingFang SC"`;ctx.fillText(`${i+1}. ${v}`,x+50,top+55+i*112)})
  } else {
    ctx.fillStyle=palette.paper;ctx.beginPath();ctx.roundRect(x,top,width,590,18);ctx.fill();if(index===1||index===4){ctx.fillStyle=index===4?'#f2d16e':palette.soft;ctx.fillRect(x+38,top+80,width-76,52)}items.forEach((v,i)=>{const y=top+65+i*116;ctx.fillStyle=palette.accent;ctx.font='800 24px monospace';ctx.fillText(`0${i+1}`,x+34,y);ctx.fillStyle=palette.ink;ctx.font='800 29px "PingFang SC"';ctx.fillText(v,x+98,y);ctx.strokeStyle=palette.ink;ctx.globalAlpha=.16;ctx.beginPath();ctx.moveTo(x+34,y+54);ctx.lineTo(x+width-34,y+54);ctx.stroke();ctx.globalAlpha=1})
  }
}

function vRound(ctx,x,y,w,h,r,fill,stroke='',line=2){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke()}}
function vText(ctx,text,x,y,size,color,weight=700,align='left'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px "PingFang SC",sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);ctx.textAlign='left'}
function vExactTitle(ctx,W,text,kicker,topic,p,variant=0){const parts=splitCardText(text);const center=variant===1;const left=variant===2?150:82;const width=variant===2?W-230:W-164;vText(ctx,kicker,center?W/2:left,70,24,p.ink,700,center?'center':'left');const end=drawRefTextBlock(ctx,parts.main||'企业名称笔试',left,118,width,76,p.ink,{align:center?'center':'left',maxLines:3,minSize:58,lineHeight:1.08});drawRefTextBlock(ctx,topic||parts.sub,left,end+22,width,32,p.ink,{align:center?'center':'left',maxLines:2,minSize:25,lineHeight:1.2});return Math.max(390,end+90)}
function vItems(plan,fallback=['学习资料','历年回忆题','模拟练习','复盘记录']){return (plan?.cardItems?.length?plan.cardItems:fallback).slice(0,4)}

function drawExactFileDrawer(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#f4efe5';ctx.fillRect(0,0,W,H);const top=vExactTitle(ctx,W,text,'ENTERPRISE EXAM FILES','资料内容索引',p,v);vRound(ctx,95,top,890,650,22,'#d7c7a8','#263a31',5);vItems(plan).slice(0,v===1?3:4).forEach((s,i)=>{const y=top+45+i*140;vRound(ctx,135,y,810,112,14,'#fffaf0','#8d795d',3);ctx.strokeStyle='#8d795d';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(195,y+37,92,34,17);ctx.stroke();vText(ctx,s,330,y+30,31,p.ink,800);vText(ctx,['先认识内容结构','用于练习与复盘','检查掌握情况','整理下一轮重点'][i],330,y+70,21,p.ink,500)});vRound(ctx,850,58,120,170,0,p.accent);vText(ctx,'资料',910,95,26,'#fff',700,'center');vText(ctx,'索引',910,140,26,'#fff',700,'center');drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactDownload(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[1];ctx.fillStyle='#eef2f5';ctx.fillRect(0,0,W,H);vRound(ctx,70,70,940,1240,34,'#fbfdff','#17324d',5);ctx.strokeStyle=p.ink;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(70,180);ctx.lineTo(1010,180);ctx.stroke();['#ef775e','#e9b850','#5ba47c'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(125+i*38,125,12,0,Math.PI*2);ctx.fill()});const top=vExactTitle(ctx,W,text,'PASSLY / STUDY PACK','资料打开后先看什么？',p,v)+15;vRound(ctx,140,top,800,430,28,'#dfe9f6');vText(ctx,'资料使用顺序',190,top+55,27,p.ink,700);vItems(plan).slice(0,3).forEach((s,i)=>{const y=top+125+i*88;vText(ctx,s,190,y,26,p.ink,600);vText(ctx,['目录','练习','复盘'][i],885,y,23,p.ink,500,'right');ctx.strokeStyle='#aac0d7';ctx.beginPath();ctx.moveTo(190,y+48);ctx.lineTo(890,y+48);ctx.stroke()});vRound(ctx,135,1120,810,130,18,p.ink);vText(ctx,plan?.cardFooter||'先看目录，再安排学习顺序',540,1162,26,'#fff',700,'center')}
function drawExactContentIndex(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#f7f3eb';ctx.fillRect(0,0,W,H);const top=vExactTitle(ctx,W,text,'CONTENT INDEX','三类资料怎么配合使用',p,v);['#e6c864','#da8e69','#7fab8e'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.roundRect(82+i*130,top,105,42,[12,12,0,0]);ctx.fill()});vRound(ctx,82,top+42,916,650,0,'#fff','#b8b3a9',2);vItems(plan).forEach((s,i)=>{const y=top+92+i*132;ctx.fillStyle=p.accent;ctx.beginPath();ctx.arc(175,y+24,38,0,Math.PI*2);ctx.fill();vText(ctx,String(i+1),175,y+7,22,'#fff',700,'center');vText(ctx,s,270,y,28,p.ink,700);vText(ctx,['建立框架','完成练习','检查掌握','整理问题'][i],900,y+2,22,p.ink,500,'right');ctx.setLineDash([7,7]);ctx.strokeStyle='#aaa69e';ctx.beginPath();ctx.moveTo(140,y+78);ctx.lineTo(930,y+78);ctx.stroke();ctx.setLineDash([])});drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactBreadcrumb(ctx,W,H,text,plan,v){const p={...VIRTUAL_STYLE_PALETTES[7],accent:'#f0a23b'};ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);const top=vExactTitle(ctx,W,text,'STUDY PATH / 资料使用路径','第一次准备从哪里开始',p,v);const labels=vItems(plan,['打开资料目录','确定学习顺序','练习并记录问题']);labels.slice(0,3).forEach((s,i)=>{const y=top+60+i*245;vText(ctx,`0${i+1}`,130,y,42,p.accent,500);vText(ctx,s,235,y+4,29,p.ink,700);vText(ctx,['先了解已有内容','拆成可以完成的任务','为下一轮留下依据'][i],235,y+55,22,p.ink,500);if(i<2)vText(ctx,'↓',158,y+145,30,p.accent,500,'center')});drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactReview(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#f3f0e8';ctx.fillRect(0,0,W,H);vRound(ctx,82,75,916,1240,0,'#fff','#aaa69e',2);const top=vExactTitle(ctx,W,text,'REVIEW CHECK','做完一组题后检查这四项',p,v);ctx.save();ctx.translate(875,105);ctx.rotate(.12);ctx.strokeStyle='#c64f43';ctx.lineWidth=4;ctx.strokeRect(-105,-35,210,85);vText(ctx,'复盘记录',0,-15,22,'#c64f43',600,'center');ctx.restore();vItems(plan,['哪些内容已经掌握','错误出现在什么环节','哪些问题需要重新查找','下一轮先处理哪一项']).forEach((s,i)=>{const y=top+60+i*120;ctx.strokeStyle=p.accent;ctx.lineWidth=4;ctx.strokeRect(145,y,38,38);vText(ctx,s,230,y-2,27,p.ink,600)});vRound(ctx,140,top+570,800,170,0,'#f3e9e2');ctx.fillStyle='#ee7b4c';ctx.fillRect(140,top+570,12,170);vText(ctx,'本次记录',200,top+625,27,p.ink,700);drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactQa(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#eef4f0';ctx.fillRect(0,0,W,H);const top=vExactTitle(ctx,W,text,'ONE QUESTION A TIME','资料很多，应该先刷哪部分？',p,v);const items=vItems(plan,['第一次打开资料','先顺着目录','完成练习','记录问题']);vRound(ctx,310,top+40,650,150,[38,38,5,38],p.accent);vText(ctx,`${items[0]}，要全部一起看吗？`,355,top+85,25,'#fff',600);ctx.fillStyle='#e9b850';ctx.beginPath();ctx.arc(135,top+285,42,0,Math.PI*2);ctx.fill();vText(ctx,'答',135,top+270,25,p.ink,700,'center');vRound(ctx,210,top+230,750,185,[38,38,38,5],'#fff');vText(ctx,`先${items[1]}，再${items[2]}。`,260,top+285,26,p.ink,600);vRound(ctx,82,top+480,916,120,22,'#d6e4dc');vText(ctx,plan?.cardFooter||'一次只解决一个具体问题',130,top+520,24,p.ink,600);drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactProof(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#f6f0e5';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ddd3c2';ctx.fillRect(125,92,850,1210);ctx.fillStyle='#fff';ctx.fillRect(100,65,850,1210);const top=vExactTitle(ctx,W,text,'STUDY NOTE / 重点批注','第二轮练习重点看什么',p,v);ctx.fillStyle='#f6d75f';ctx.fillRect(160,top+18,510,24);vText(ctx,'先回看已经记录的问题，再找到对应内容重新练习。',160,top+105,27,p.ink,500);vText(ctx,'把错误原因写清楚，更方便后续检查。',160,top+310,27,p.ink,500);vText(ctx,'← 先看记录',760,top+45,23,'#c64f43',500);ctx.strokeStyle='#c64f43';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(350,top+355,95,42,-.08,0,Math.PI*2);ctx.stroke();vText(ctx,'错误原因',350,top+338,22,'#c64f43',500,'center');drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactSignpost(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[4];ctx.fillStyle='#dce8da';ctx.fillRect(0,0,W,H);ctx.fillStyle='#b8c7a3';ctx.fillRect(0,780,W,H-780);ctx.fillStyle='#f0b65a';ctx.beginPath();ctx.arc(875,115,82,0,Math.PI*2);ctx.fill();const top=vExactTitle(ctx,W,text,'LEARNING DIRECTION','资料使用顺序',p,v);ctx.fillStyle='#654d36';ctx.fillRect(520,top+20,30,680);vItems(plan,['先看资料目录','再完成练习','最后整理问题']).slice(0,3).forEach((s,i)=>{const y=top+65+i*190,flip=i===1;ctx.fillStyle='#f6f0e5';ctx.beginPath();if(!flip){ctx.moveTo(220,y);ctx.lineTo(760,y);ctx.lineTo(845,y+65);ctx.lineTo(760,y+130);ctx.lineTo(220,y+130)}else{ctx.moveTo(860,y);ctx.lineTo(320,y);ctx.lineTo(235,y+65);ctx.lineTo(320,y+130);ctx.lineTo(860,y+130)}ctx.closePath();ctx.fill();vText(ctx,s,540,y+42,27,p.ink,600,'center')});drawVirtualFooter(ctx,W,H,{...p,ink:'#fff'},plan)}
function drawExactSticky(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#eee9df';ctx.fillRect(0,0,W,H);vRound(ctx,65,55,950,1260,0,'#c7b08d');const top=vExactTitle(ctx,W,text,'MY REVIEW BOARD','这一轮练习留下了什么？',p,v);const colors=['#fff0a9','#d8ebdf','#f2cfca','#d9e2f2'];vItems(plan).forEach((s,i)=>{const w=395,h=245,x=120+(i%2)*425,y=top+50+Math.floor(i/2)*275;ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate((i%2?1:-1)*.025);ctx.fillStyle=colors[i];ctx.fillRect(-w/2,-h/2,w,h);vText(ctx,s,-w/2+38,-h/2+55,29,p.ink,700);vText(ctx,['记录进度','回到资料查找','分类整理','先处理薄弱项'][i],-w/2+38,-h/2+105,21,p.ink,500);ctx.restore()});drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactBinder(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[7];ctx.fillStyle='#294b40';ctx.fillRect(0,0,W,H);vRound(ctx,120,60,850,1300,[8,30,30,8],'#f7f3e9');for(let y=160;y<1240;y+=150){ctx.strokeStyle='#aaa59b';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(165,y);ctx.lineTo(225,y);ctx.stroke()}const top=vExactTitle(ctx,W,text,'PASSLY FILE BOOK','资料使用手册',p,v);vItems(plan).slice(0,3).forEach((s,i)=>{const y=top+70+i*205;vText(ctx,s,300,y,29,p.accent,700);vText(ctx,['先了解资料结构和内容分类','用于练习、整理和复盘','完成后检查掌握情况'][i],300,y+58,21,p.ink,500);ctx.strokeStyle='#c9c3b7';ctx.beginPath();ctx.moveTo(300,y+115);ctx.lineTo(870,y+115);ctx.stroke()});['资料','练习','复盘'].forEach((s,i)=>{vRound(ctx,835,350+i*180,135,95,[18,0,0,18],['#e4b452','#df8d6d','#8db79b'][i]);vText(ctx,s,902,380+i*180,23,p.ink,600,'center')});drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactMaterialKit(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);const top=vExactTitle(ctx,W,text,'STUDY MATERIAL KIT','完整复习需要哪些环节',p,v);const colors=['#dce9e0','#f2ddb0','#dbe3f0','#efcfca'];vItems(plan).forEach((s,i)=>{const x=90+(i%2)*465,y=top+40+Math.floor(i/2)*330;vRound(ctx,x,y,430,285,24,colors[i]);vText(ctx,`PART 0${i+1}`,x+35,y+35,21,p.ink,600);vText(ctx,s,x+35,y+135,28,p.ink,700);vText(ctx,['梳理内容','完成练习','检查掌握','调整下一轮'][i],x+35,y+190,20,p.ink,500);vText(ctx,'+',x+385,y+225,42,p.ink,400,'center')});drawVirtualFooter(ctx,W,H,p,plan)}
function drawExactManual(ctx,W,H,text,plan,v){const p=VIRTUAL_STYLE_PALETTES[0];ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);const top=vExactTitle(ctx,W,text,'USER MANUAL','资料怎么用，一页说清',p,v);ctx.strokeStyle=p.ink;ctx.lineWidth=4;ctx.strokeRect(830,55,170,150);vText(ctx,'NO.',865,82,23,p.ink,500);vText(ctx,'01',865,135,23,p.ink,500);ctx.strokeStyle=p.ink;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(82,top+35);ctx.lineTo(998,top+35);ctx.stroke();vItems(plan,['认识内容','完成练习','留下记录']).slice(0,3).forEach((s,i)=>{const y=top+90+i*190;vText(ctx,`0${i+1}`,82,y,48,'#ee7042',500);vText(ctx,s,270,y+5,28,p.ink,700);vText(ctx,['先浏览目录与资料分类','一次处理一组具体内容','写下问题和错误原因'][i],270,y+58,21,p.ink,500);ctx.strokeStyle='#b8b3aa';ctx.beginPath();ctx.moveTo(82,y+135);ctx.lineTo(998,y+135);ctx.stroke()});ctx.strokeStyle='#ee7042';ctx.strokeRect(82,top+670,916,105);vText(ctx,'提醒：按自己的基础调整使用顺序',112,top+705,22,'#c64f43',500)}

const EXACT_VIRTUAL_RENDERERS={
  virtual_file_drawer:drawExactFileDrawer,virtual_download_window:drawExactDownload,virtual_content_index:drawExactContentIndex,virtual_breadcrumb_path:drawExactBreadcrumb,
  virtual_review_diagnosis:drawExactReview,virtual_qa_dialogue:drawExactQa,virtual_proofread_note:drawExactProof,virtual_study_signpost:drawExactSignpost,
  virtual_sticky_wall:drawExactSticky,virtual_ring_binder:drawExactBinder,virtual_material_kit:drawExactMaterialKit,virtual_user_manual:drawExactManual,
}

const VIRTUAL_UNIQUE_CONFIGS={
  virtual_cloud_drive:{slot:1,decor:'cloud',density:3},virtual_pdf_stack:{slot:2,decor:'pages',density:4},virtual_archive_seal:{slot:0,decor:'seal',density:3},virtual_course_pack:{slot:1,decor:'strap',density:4},
  virtual_az_index:{slot:2,decor:'alphabet',density:4},virtual_file_tree:{slot:0,decor:'branches',density:4},virtual_split_catalog:{slot:1,decor:'columns',density:4},virtual_book_toc:{slot:2,decor:'folio',density:3},virtual_folder_tabs:{slot:0,decor:'tabs',density:4},virtual_search_panel:{slot:1,decor:'search',density:3},virtual_module_map:{slot:2,decor:'modules',density:4},
  virtual_bus_route:{slot:0,decor:'stops',density:4},virtual_mountain_route:{slot:1,decor:'peak',density:3},virtual_circular_route:{slot:2,decor:'orbit',density:4},virtual_task_flow:{slot:0,decor:'flow',density:4},virtual_assembly_steps:{slot:1,decor:'parts',density:3},virtual_workflow_pipeline:{slot:2,decor:'pipeline',density:4},
  virtual_error_report:{slot:0,decor:'report',density:4},virtual_review_log:{slot:1,decor:'log',density:3},virtual_status_board:{slot:2,decor:'board',density:4},virtual_round_compare:{slot:0,decor:'compare',density:4},virtual_checklist_sheet:{slot:1,decor:'checks',density:3},virtual_progress_journal:{slot:2,decor:'journal',density:4},
  virtual_magnifier_focus:{slot:0,decor:'magnifier',density:3},virtual_highlighter_page:{slot:1,decor:'highlight',density:4},virtual_teacher_board:{slot:2,decor:'chalk',density:3},virtual_memo_note:{slot:0,decor:'memo',density:4},virtual_question_cards:{slot:1,decor:'questions',density:3},
}

function drawUniqueConfigDecor(ctx,W,config,palette){ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle=palette.accent;ctx.fillStyle=palette.accent;ctx.lineWidth=5;const d=config?.decor||'';if(['cloud','orbit','magnifier'].includes(d)){ctx.beginPath();ctx.arc(W-125,120,d==='orbit'?92:68,0,Math.PI*2);ctx.stroke();if(d==='magnifier'){ctx.beginPath();ctx.moveTo(W-78,168);ctx.lineTo(W-24,222);ctx.stroke()}}else if(['pages','columns','pipeline','branches'].includes(d)){for(let i=0;i<3;i++)ctx.fillRect(W-220+i*38,55+i*18,125,14)}else if(['alphabet','folio','log','journal'].includes(d)){vText(ctx,d==='alphabet'?'A · B · C':'01 / 02 / 03',W-80,72,23,palette.accent,700,'right')}else if(['tabs','strap','seal','report'].includes(d)){ctx.fillRect(W-170,0,72,170)}else{for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(W-70-i*38,70,8,0,Math.PI*2);ctx.fill()}}ctx.restore()}

function drawVirtualCardImage(ctx, W, H, style, text, cardPlan = null) {
  const meta=getVirtualStyleMeta(style), { palette, group }=meta, pickedVariant=pickVirtualLayoutVariant(style), config=VIRTUAL_UNIQUE_CONFIGS[style]
  const variant=config?(pickedVariant+config.slot)%3:pickedVariant
  ctx.clearRect(0,0,W,H);ctx.fillStyle=palette.bg;ctx.fillRect(0,0,W,H);ctx.textBaseline='top'
  if(EXACT_VIRTUAL_RENDERERS[style]){EXACT_VIRTUAL_RENDERERS[style](ctx,W,H,text,cardPlan,variant);return}
  if(variant===1){ctx.fillStyle=palette.soft;ctx.beginPath();ctx.arc(W-95,95,180,0,Math.PI*2);ctx.fill()}
  drawUniqueConfigDecor(ctx,W,config,palette)
  const top=drawVirtualHeader(ctx,W,text,cardPlan,palette,variant)
  if(group==='material')drawVirtualMaterial(ctx,W,H,meta,top,cardPlan,variant)
  else if(group==='index')drawVirtualIndex(ctx,W,H,meta,top,cardPlan,variant)
  else if(group==='route')drawVirtualRoute(ctx,W,H,meta,top,cardPlan,variant)
  else if(group==='review')drawVirtualReview(ctx,W,H,meta,top,cardPlan,variant)
  else drawVirtualFocus(ctx,W,H,meta,top,cardPlan,variant)
  drawVirtualFooter(ctx,W,H,palette,cardPlan)
}

// Editorial cards use a 360 × 480 design coordinate system, matching the reviewed HTML.
function drawEditorialCard(ctx, style, text, plan) {
  ctx.save(); ctx.scale(3,3); ctx.textBaseline='top'
  const { main }=splitCardText(text)
  const ink='#20392f', cream='#faf7ef'
  const box=(x,y,w,h,c,r=0)=>vRound(ctx,x,y,w,h,r,c)
  const line=(y,x=30,w=300,c=ink)=>{ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke()}
  const txt=(s,x,y,size=14,c=ink,weight=500,align='left')=>vText(ctx,s,x,y,size,c,weight,align)
  const paragraph=(s,x,y,w=300,size=14,c=ink,family='"PingFang SC",sans-serif')=>drawRefTextBlock(ctx,s,x,y,w,size,c,{align:'left',maxLines:8,minSize:size,weight:500,lineHeight:1.7,family})
  const title=(x=30,y=78,w=300,c=ink,serif=false)=>drawRefTextBlock(ctx,main||'企业名称笔试',x,y,w,36,c,{align:'left',maxLines:3,minSize:24,weight:900,lineHeight:1.12,family:serif?'"Songti SC",serif':'"PingFang SC",sans-serif'})
  const foot=(s,c=ink)=>paragraph(s,30,432,300,12,c)
  const actual=vItems(plan,['资料目录','使用说明','练习记录'])
  box(0,0,360,480,cream)
  if(style==='editorial_edition'){
    box(0,0,360,12,'#d35c3d');txt('STUDY EDITION / 资料专刊',30,35,11);line(65);const end=title(30,85,300,ink,true);txt('先读目录，再开始这一轮',30,end+22,18,ink,800);line(end+60);actual.slice(0,4).forEach((s,i)=>{const x=30+i%2*160,y=end+85+Math.floor(i/2)*65;txt(s,x,y,14);txt('认识内容 · 分步使用',x,y+25,11)});foot('让每类资料，都有自己的使用位置。')
  }else if(style==='editorial_cobalt'){
    box(0,0,360,480,'#244fdd');txt('ONE FOCUS / 一个重点',30,30,11,'#fff');title(30,95,300,'#fff');ctx.save();ctx.translate(25,265);ctx.rotate(-.05);box(0,0,310,125,'#f5e95f');paragraph('这一轮，先把问题找出来。',20,20,270,20,'#183d9c');txt('完成练习 → 记录原因 → 查找资料',20,88,12,'#183d9c');ctx.restore();foot('做完以后，留一点时间给复盘。','#fff')
  }else if(style==='editorial_spine'){
    box(0,0,360,480,'#efe5d4');box(0,0,52,480,'#6c342b');ctx.save();ctx.translate(18,380);ctx.rotate(-Math.PI/2);txt('STUDY COMPANION',0,0,14,'#fff');ctx.restore();txt('学习资料 · 使用笔记',78,35,11);const end=title(78,82,250,ink,true);line(end+25,78,250);paragraph('建立自己的资料索引',78,end+50,230,22);paragraph('按内容分类\n按问题查找\n按练习记录回看',78,end+120,230,14)
  }else if(style==='editorial_receipt'){
    box(0,0,360,480,'#243b32');box(28,28,304,424,'#fffaf0');txt('STUDY RECEIPT',50,50,11);const end=title(50,85,260);txt('本轮练习，留下什么？',50,end+22,17);['完成内容','错误原因','待查问题'].forEach((s,i)=>{const y=end+65+i*48;txt(s,50,y);txt(['记下来','分分类','回头看'][i],310,y,14,ink,500,'right');ctx.setLineDash([3,3]);line(y+30,50,260);ctx.setLineDash([])});paragraph('下一轮重点，来自这一次的记录。',50,388,260,13);for(let x=28;x<332;x+=16){ctx.fillStyle='#243b32';ctx.beginPath();ctx.moveTo(x,452);ctx.lineTo(x+8,442);ctx.lineTo(x+16,452);ctx.fill()}
  }else if(style==='editorial_orange'){
    box(0,0,360,480,'#ef7547');txt('START SMALL / 从一件事开始',30,30,11);title();ctx.fillStyle='#f8ebd6';ctx.beginPath();ctx.arc(180,320,110,0,Math.PI*2);ctx.fill();txt('资料太多？',180,270,24,ink,800,'center');txt('今天先选一类。',180,317,15,ink,500,'center');txt('看目录，做一组，记一个问题。',180,350,12,ink,500,'center');foot('把任务缩小，才方便真正开始。')
  }else if(style==='editorial_gallery'){
    box(0,0,360,480,'#f0eee7');txt('COLLECTION / 资料内容',30,30,11);box(30,75,300,275,'#fffdf8');ctx.strokeStyle='#a8a59a';ctx.strokeRect(30,75,300,275);drawRefTextBlock(ctx,main,55,110,250,34,ink,{align:'center',maxLines:3,minSize:24,family:'"Songti SC",serif'});line(267,55,250);paragraph(actual.join(' / '),55,288,250,12);txt('先认识资料，再安排顺序',180,378,18,ink,800,'center');txt('分阶段配合使用',180,414,13,ink,500,'center')
  }else if(style==='editorial_ribbon'){
    box(0,0,360,480,'#edf0f6');txt('REVIEW NOTES',30,30,11,'#26375b');title(30,100,300,'#26375b');ctx.save();ctx.translate(0,280);ctx.transform(1,-.087,0,1,0,0);box(0,0,360,135,'#26375b');txt('第二轮，先回看问题记录。',30,25,20,'#fff',800);paragraph('找到对应内容，再完成一次练习。',30,77,300,14,'#fff');ctx.restore();foot('这一次，把注意力放在错误原因上。')
  }else if(style==='editorial_split'){
    box(0,0,360,480,'#fff');box(0,0,360,225,'#dfe9de');txt('企业笔试 / 资料配合方法',30,30,11);title(30,72);box(0,225,360,8,ink);txt('先搭框架',30,260,20,ink,800);txt('浏览已有资料，认识内容结构。',30,297,14);line(334);txt('再做练习',30,355,20,ink,800);txt('结合练习记录，整理具体问题。',30,392,14);foot('把阅读和练习连接起来。')
  }else if(style==='editorial_letter'){
    box(0,0,360,480,'#f8f1e6');txt('A NOTE FOR YOUR STUDY',35,35,11);const end=title(35,80,290,ink,true);box(35,end+30,3,175,'#b64d3d');txt('给刚打开资料的你：',55,end+34,18,ink,800);paragraph('先不用急着全部看完。\n花一点时间读目录，选择一部分开始。做完以后，记下哪里还不清楚。',55,end+79,260,14);foot('一步一步，整理自己的节奏。','#b64d3d')
  }else if(style==='editorial_architect'){
    box(0,0,360,480,'#e5e9e4');txt('FRAMEWORK / 学习框架',30,30,11);title();txt('01',215,305,125,'#c3ccc1',700);box(30,260,2,145,'#52684f');paragraph('把资料拆成具体任务',54,260,260,22);paragraph('浏览一个分类\n完成一组练习\n整理一类问题',54,320,260,14);foot('从可以完成的一步开始。')
  }else if(style==='editorial_ticket'){
    box(0,0,360,480,'#eee4d6');vRound(ctx,30,30,300,420,20,'#fffaf0','#4a3c2f');txt('STUDY PASS / 学习路线',52,53,11);const end=title(52,92,256);txt('从目录到复盘',52,end+20,20,ink,800);paragraph('起点　认识资料\n途中　分步练习\n终点　本轮复盘',52,end+65,256,14);ctx.setLineDash([4,4]);line(350,30,300,'#a69986');ctx.setLineDash([]);txt('每一步，都留下下一步的线索。',52,370,12);for(let x=52;x<305;x+=8)box(x,407,x%3+1,25,'#4a3c2f')
  }else if(style==='editorial_night'){
    box(0,0,360,480,'#172e35');txt('QUIET STUDY / 专注一页',30,30,11,'#f4e9ce');title(30,80,300,'#f4e9ce');vRound(ctx,30,250,300,162,[90,90,15,15],'#203e43','#557276');ctx.fillStyle='#e8b354';ctx.beginPath();ctx.arc(180,278,5,0,Math.PI*2);ctx.fill();txt('这一页，只解决一个疑问',180,308,18,'#f4e9ce',700,'center');txt('先写下问题，再回到资料中找答案',180,355,13,'#f4e9ce',500,'center');foot('先把这一点弄清。','#f4e9ce')
  }else if(style==='editorial_accordion'){
    box(0,0,360,480,'#f3ece6');txt('FOLDING GUIDE / 使用指南',30,30,11);title();['打开资料 → 先看分类','开始练习 → 记录疑问','完成本轮 → 整理原因','准备下轮 → 选择重点'].forEach((s,i)=>{ctx.save();ctx.translate(30,248+i*40);ctx.transform(1,-.052,0,1,0,0);box(0,0,300,40,i%2?'#f1ded3':'#e6c8b8');txt(s,18,12,14);ctx.restore()});foot('让每次练习都有清楚的前后顺序。')
  }else if(style==='editorial_annotation'){
    box(0,0,360,480,'#fffdf6');txt('STUDY THOUGHT / 方法摘录',30,30,11);title();box(155,290,122,13,'#f5d569');paragraph('复盘时，\n别只写正确答案。\n再写一句：\n我为什么做错？',30,250,300,25,ink,'"Songti SC",serif');box(30,425,2,27,'#aa4a37');txt('记录原因，方便下一轮针对性回看。',45,429,12,'#aa4a37')
  }else if(style==='editorial_museum'){
    box(0,0,360,480,'#d8e2df');txt('MATERIAL STUDY',30,30,11);title(30,100,300,'#203c37',true);box(30,295,300,155,'#fffefa');box(30,295,300,5,'#203c37');txt('本页主题 / CONTENT',52,318,11);txt('资料内容，各有用途',52,346,19,ink,800);paragraph(actual.join(' / '),52,385,256,13)
  }
  ctx.restore()
}

async function renderTemplateCardImage(text, templateStyle, bottomHint, cardPlan = null) {
  const SCALE = 3
  const W = 360 * SCALE, H = 480 * SCALE
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const style = templateStyle || rndPick(CARD_TEMPLATE_STYLES)
  const effectivePlan = cardPlan || buildTemplateDemoPlan(style, CARD_TEMPLATE_STYLES.indexOf(style))
  const effectiveBottomHint = effectivePlan.cardFooter || bottomHint
  if (EDITORIAL_CARDS.some(([id]) => id === style)) {
    drawEditorialCard(ctx, style, text, effectivePlan)
    return offscreenToDataUrl(canvas)
  }
  if (VIRTUAL_CARD_STYLE_IDS.has(style)) {
    drawVirtualCardImage(ctx, W, H, style, text, effectivePlan)
    return offscreenToDataUrl(canvas)
  }
  if (CONCEPT_CARD_STYLES.has(style)) {
    drawConceptCardImage(ctx, W, H, style, text, effectiveBottomHint, effectivePlan)
    return offscreenToDataUrl(canvas)
  }
  if (REFERENCE_TEA_THEME_MAP[style]) {
    drawRefCardImage(ctx, W, H, REFERENCE_TEA_THEME_MAP[style], text, effectivePlan)
    applyTeaReferenceTheme(ctx, W, H, REFERENCE_TEA_THEME_PALETTES[style])
    return offscreenToDataUrl(canvas)
  }
  if (REFERENCE_CARD_STYLES.has(style)) {
    drawRefCardImage(ctx, W, H, style, text, effectivePlan)
    return offscreenToDataUrl(canvas)
  }
  const palette = getTemplateCardPalette(style)
  const variant = pickCardAntiVariant(style)
  drawTemplateCardBackground(ctx, W, H, style, SCALE)
  if (variant.showTexture) drawCardSubtleTexture(ctx, W, H, SCALE, palette)
  drawTemplateCardDecor(ctx, W, H, style, palette, SCALE, effectivePlan)

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
    drawCardInfoChips(ctx, 42 * SCALE, 94 * SCALE, W - 84 * SCALE, palette, SCALE, variant.chipCount, effectivePlan.cardItems)
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
    drawCardInfoChips(ctx, layout.align === 'center' ? 58 * SCALE : layout.x, infoY, layout.align === 'center' ? W - 116 * SCALE : layout.width, palette, SCALE, variant.chipCount, effectivePlan.cardItems)
  }

  ctx.fillStyle = palette.accent
  ctx.beginPath(); ctx.roundRect(baseX, H - 78 * SCALE, rndInt(34, 72) * SCALE, 5 * SCALE, 3 * SCALE); ctx.fill()
  drawCardBottomVariant(ctx, W, H, SCALE, variant.bottomMode, effectiveBottomHint, palette, baseX, W - baseX * 2, effectivePlan)
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
async function runBatch({ productDetails, onlyDirImages, generationMode = 'complete', bgPool, borderColor, titlePool, cardTitleTemplatePool, useCardTitleTemplates, historyTitlePool, mockTitlePool, cardSchemes, replaceCardWithCover }) {
  _TITLE_POOL                = titlePool             || []
  _CARD_TITLE_TEMPLATE_POOL  = cardTitleTemplatePool || []
  _USE_CARD_TITLE_TEMPLATES  = !!useCardTitleTemplates
  _CARD_TEXT_TITLE_BAG       = []
  _HISTORY_TITLE_POOL        = historyTitlePool      || []
  _MOCK_TITLE_POOL           = mockTitlePool         || []
  _CARD_SCHEMES              = cardSchemes           || []
  _CARD_TEMPLATE_STYLE_BAG = []
  _CARD_SCHEME_BAG = []
  _CARD_LAYOUT_VARIANT_BAGS = new Map()
  _borderColor        = borderColor      || '#F9863B'
  const bgImagePool   = bgPool           || []

  const total = productDetails.length
  let done = 0

  for (const { id, company, detail, contentPlan } of productDetails) {
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

    // 生成卡片文案：卡片图或封面图都会复用它作为笔记标题
    let cardText = String(contentPlan?.cardText || '').trim()
    if (!cardText) {
      try { cardText = buildCardText(detail) } catch (_) { cardText = '' }
    }

    if (replaceCardWithCover) {
      log(`  └ 已开启封面图替换卡片图，跳过卡片图生成`, 'info')
    } else {
      log(`  └ 生成卡片图中...`, 'info')
      try {
        const scheme = pickCardScheme() || { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' }
        const cardDataUrl = contentPlan?.coverTemplateStyle
          ? await renderTemplateCardImage(cardText, contentPlan.coverTemplateStyle, contentPlan.cardFooter || pickCardBottomHint(), contentPlan)
          : await renderCardImage(cardText, scheme)
        images.push({ label: '卡片图', base64: cardDataUrl.replace(/^data:image\/png;base64,/, '') })
        log(`  └ 卡片图 ✓`, 'success')
      } catch (e) {
        log(`  └ 卡片图失败：${e.message}`, 'error')
      }
    }

    // 把本商品所有图片发回主线程（主线程负责：笔记生成 + docx + ZIP + 飞书）
    // cardText：卡片/封面使用的文案，主线程直接用于笔记标题，无需重新随机
    post({ type: 'product-images', id, company, images, cardText })

    done++; prog(done, total)
  }

  post({ type: 'done' })
}

async function buildCardTemplatePreviews({ sampleText, cardSchemes }) {
  _CARD_SCHEMES = cardSchemes || []
  _CARD_SCHEME_BAG = []
  _CARD_TEMPLATE_STYLE_BAG = []
  _CARD_LAYOUT_VARIANT_BAGS = new Map()
  const text = sampleText || '示例企业笔试，资料怎么分步使用'
  const previews = []
  for (let index = 0; index < CARD_TEMPLATE_STYLES.length; index++) {
    const style = CARD_TEMPLATE_STYLES[index]
    const cardPlan = buildTemplateDemoPlan(style, index)
    const dataUrl = await renderTemplateCardImage(text, style, cardPlan.cardFooter, cardPlan)
    previews.push({
      id: style,
      name: CARD_TEMPLATE_STYLE_NAMES[style] || style,
      goal: cardPlan.cardGoalName,
      viewpoint: cardPlan.cardViewpoint,
      base64: dataUrl.replace(/^data:image\/png;base64,/, ''),
    })
  }
  return previews
}

// ── Worker 入口 ──────────────────────────────────────────────────────
self.onmessage = async (e) => {
  if (e.data.type === 'generate-card-image') {
    try {
      _CARD_SCHEMES = e.data.cardSchemes || []
      _CARD_SCHEME_BAG = []
      _CARD_TEMPLATE_STYLE_BAG = []
      _CARD_LAYOUT_VARIANT_BAGS = new Map()
      const text = String(e.data.text || '').trim()
      const templateStyle = String(e.data.templateStyle || '').trim()
      const scheme = pickCardScheme() || { bg: '#d4f7d4', text: '#2d4a2d', accent: '#52c07a' }
      const dataUrl = templateStyle
        ? await renderTemplateCardImage(text, templateStyle, pickCardBottomHint())
        : await renderCardImage(text, scheme)
      post({
        type: 'single-card-image',
        base64: dataUrl.replace(/^data:image\/png;base64,/, ''),
      })
    } catch (err) {
      post({ type: 'single-card-image-error', message: err.message || '卡片图生成失败' })
    }
    return
  }
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
