import { getToken } from '@/api/request'

export const PRODUCT_DETAIL_IMAGE_CONFIG = {
  exam: { title: '资料目录', filename: '资料目录' },
  history: { title: '历年真题（回忆版）', filename: '历年真题（回忆版）' },
  mock: { title: '模拟题', filename: '模拟题' },
  interview: { title: '面试资料', filename: '面试资料' },
}

function truncateDirectoryFileName(ctx, name, maxWidth) {
  const text = String(name || '未命名文件')
  if (ctx.measureText(text).width <= maxWidth) return text
  const suffix = '…'
  let result = ''
  for (const char of text) {
    if (ctx.measureText(result + char + suffix).width > maxWidth) break
    result += char
  }
  return `${result}${suffix}`
}

function drawDirectoryFolderIcon(ctx, x, y, size) {
  ctx.fillStyle = '#ffc627'
  ctx.beginPath()
  ctx.roundRect(x, y + size * 0.19, size, size * 0.67, size * 0.08)
  ctx.fill()
  ctx.fillStyle = '#ffd85b'
  ctx.beginPath()
  ctx.roundRect(x + size * 0.08, y, size * 0.42, size * 0.28, size * 0.06)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.35)'
  ctx.fillRect(x + size * 0.1, y + size * 0.28, size * 0.8, size * 0.1)
}

function drawDirectoryPdfIcon(ctx, x, y, size) {
  ctx.fillStyle = '#ff7180'
  ctx.beginPath()
  ctx.roundRect(x, y, size * 0.74, size, size * 0.1)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${Math.round(size * 0.25)}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PDF', x + size * 0.37, y + size * 0.56)
}

export function drawProductDetailDirectoryImage(type, files) {
  const config = PRODUCT_DETAIL_IMAGE_CONFIG[type]
  const W = 1080
  const headerHeight = 240
  // 商品详情图必须完整展示该目录，不做条目上限截断；例如“时政”目录
  // 即使排在后面也要保留。这里也不调用目录图的敏感词遮盖逻辑。
  const displayFiles = files || []
  const rowStartY = headerHeight + 72
  const rowGap = 82
  // 高度随条目数量变化：给最后一行保留图标和底部红框所需的安全边距，
  // 避免 3～4 条资料仍生成一张大面积留白的长图。
  const lastRowY = rowStartY + Math.max(0, displayFiles.length - 1) * rowGap
  const H = Math.max(590, Math.ceil(lastRowY + 112))
  const red = '#cf130d'
  const yellow = '#fac817'
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // 标题保持纯黄底；红框仅包住下方的目录内容区。
  ctx.fillStyle = yellow
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = red
  ctx.fillRect(0, headerHeight, W, H - headerHeight)
  ctx.fillStyle = '#fff'
  ctx.fillRect(22, headerHeight + 20, W - 44, H - headerHeight - 42)

  // 参考图的白字黑描边大标题；历史真题标题较长时自动缩放，保持一行优先。
  let titleFontSize = config.title.length > 8 ? 94 : 124
  ctx.font = `900 ${titleFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  while (ctx.measureText(config.title).width > W - 80 && titleFontSize > 46) {
    titleFontSize -= 2
    ctx.font = `900 ${titleFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 17
  ctx.strokeStyle = '#090909'
  ctx.strokeText(config.title, W / 2, headerHeight / 2 + 2)
  ctx.fillStyle = '#fff'
  ctx.fillText(config.title, W / 2, headerHeight / 2 + 2)

  const iconSize = 38
  const textX = 116
  const maxTextWidth = W - textX - 54
  const fontSize = displayFiles.length > 8 ? 24 : 28

  ctx.font = `500 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  displayFiles.forEach((file, index) => {
    const y = rowStartY + index * rowGap
    if (Number(file?.isdir) === 1) drawDirectoryFolderIcon(ctx, 54, y - iconSize / 2, iconSize)
    else drawDirectoryPdfIcon(ctx, 56, y - iconSize / 2, iconSize)
    // PDF 图标会临时调整画布字体，绘制文件名之前必须恢复统一字号。
    ctx.font = `500 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#252525'
    ctx.fillText(truncateDirectoryFileName(ctx, file?.name, maxTextWidth), textX, y + 1)
  })

  return canvas
}

async function renderBaiduPdfFirstPageToCanvas(file, ensurePdfjs) {
  const lib = await ensurePdfjs()
  const pdf = await lib.getDocument({
    url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(file.path)}`,
    httpHeaders: { Authorization: `Bearer ${getToken()}` },
  }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.6 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas
}

export async function drawInterviewProductDetailImage(files, questionPdf, ensurePdfjs) {
  const W = 1080
  const headerHeight = 240
  const rowStartY = headerHeight + 68
  const rowGap = 72
  const leftPanelW = 628
  const list = files || []
  const lastRowY = rowStartY + Math.max(0, list.length - 1) * rowGap
  const pdfSource = await renderBaiduPdfFirstPageToCanvas(questionPdf, ensurePdfjs)
  const pdfX = 474
  const pdfY = Math.max(headerHeight + 190, Math.min(lastRowY - 175, 500))
  const pdfW = 572
  const pdfH = Math.round(pdfW * (pdfSource.height / pdfSource.width))
  const H = Math.max(1110, lastRowY + 100, pdfY + pdfH + 42)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#fac817'
  ctx.fillRect(0, 0, W, headerHeight)
  ctx.fillStyle = '#cf130d'
  ctx.fillRect(0, headerHeight, W, H - headerHeight)

  ctx.font = '900 124px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 17
  ctx.strokeStyle = '#090909'
  ctx.strokeText('面试资料', W / 2, headerHeight / 2 + 2)
  ctx.fillStyle = '#fff'
  ctx.fillText('面试资料', W / 2, headerHeight / 2 + 2)

  // 左侧为原始网盘目录，完整保留所有文件和文件夹。
  ctx.fillStyle = '#fff'
  ctx.fillRect(22, headerHeight + 20, leftPanelW, H - headerHeight - 42)
  const iconSize = 34
  const textX = 108
  ctx.font = '500 22px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  list.forEach((file, index) => {
    const y = rowStartY + index * rowGap
    if (Number(file?.isdir) === 1) drawDirectoryFolderIcon(ctx, 48, y - iconSize / 2, iconSize)
    else drawDirectoryPdfIcon(ctx, 50, y - iconSize / 2, iconSize)
    ctx.font = '500 22px "PingFang SC", "Microsoft YaHei", sans-serif'
    // PDF 图标绘制会修改 textAlign；面试资料目录必须恢复正常的左对齐全文字。
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#252525'
    // 不截断、不加省略号。右下的 PDF 首页会自然覆盖其重叠部分。
    ctx.fillText(String(file?.name || '未命名文件'), textX, y + 1)
  })

  // 与参考样式一致，在右下角叠放指定“50道高频题”PDF 的第一页。
  ctx.fillStyle = '#fff'
  ctx.fillRect(pdfX - 10, pdfY - 10, pdfW + 20, pdfH + 20)
  ctx.drawImage(pdfSource, pdfX, pdfY, pdfW, pdfH)
  return canvas
}

