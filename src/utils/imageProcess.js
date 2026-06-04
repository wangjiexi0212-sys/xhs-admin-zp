/**
 * 防 AI 图检测处理：通过对像素做不可见的微调 + 重新编码，改变图像的二进制指纹与哈希，
 * 让平台 AI 图判定模型更难直接识别。
 *
 * 处理步骤：
 *   1. 拉成 blob，避免 canvas 被 CORS 污染
 *   2. 随机 1~3px 边缘裁剪（视觉无感）
 *   3. 像素噪声：约 30% 像素每通道 ±0~2
 *   4. 轻微亮度/对比度抖动
 *   5. 输出为 JPEG，随机质量 0.88~0.95（改变压缩签名）
 */
export async function processImageForDownload(srcUrl) {
  const resp = await fetch(srcUrl, { mode: 'cors' })
  if (!resp.ok) throw new Error('图片获取失败')
  const sourceBlob = await resp.blob()

  const objUrl = URL.createObjectURL(sourceBlob)
  try {
    const img = await loadImage(objUrl)

    const cropL = 1 + Math.floor(Math.random() * 3)
    const cropR = 1 + Math.floor(Math.random() * 3)
    const cropT = 1 + Math.floor(Math.random() * 3)
    const cropB = 1 + Math.floor(Math.random() * 3)
    const W = img.naturalWidth - cropL - cropR
    const H = img.naturalHeight - cropT - cropB
    if (W <= 0 || H <= 0) throw new Error('图片尺寸过小')

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, -cropL, -cropT)

    const id = ctx.getImageData(0, 0, W, H)
    const data = id.data

    const brightShift = (Math.random() - 0.5) * 4   // -2 ~ +2
    const contrastK = 1 + (Math.random() - 0.5) * 0.02 // 0.99 ~ 1.01

    for (let i = 0; i < data.length; i += 4) {
      const useNoise = Math.random() < 0.3
      const n = useNoise ? Math.floor(Math.random() * 5) - 2 : 0
      for (let c = 0; c < 3; c++) {
        let v = data[i + c]
        v = (v - 128) * contrastK + 128 + brightShift + n
        if (v < 0) v = 0
        else if (v > 255) v = 255
        data[i + c] = v
      }
    }
    ctx.putImageData(id, 0, 0)

    const q = 0.88 + Math.random() * 0.07
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('编码失败'))),
        'image/jpeg',
        q,
      )
    })
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('图片加载失败'))
    im.src = src
  })
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
