import { request } from './request'
import { getActiveLlmConfig } from './llmConfig'

/** 把当前激活的 LLM 配置注入到请求体 */
function withLlm(data = {}) {
  const llm = getActiveLlmConfig()
  if (!llm) return data
  return {
    ...data,
    llm_provider: llm.provider,
    llm_api_key: llm.api_key,
    llm_base_url: llm.base_url,
    llm_model: llm.default_model,
    llm_api_format: llm.api_format ?? '',
  }
}

/** 解析小红书链接，返回笔记原始内容（标题 + 正文 + 图片列表） */
export const parseXhsLink = (data) =>
  request('/api/xhs-rewrite/parse', { method: 'POST', body: data })

/** 调用 LLM 改写标题 + 正文（自动附带当前 LLM 配置） */
export const rewriteContent = (data) =>
  request('/api/xhs-rewrite/content', { method: 'POST', body: withLlm(data) })

/**
 * 把 XHS CDN 图片在浏览器侧转为 base64，上传到 Worker R2，返回公开 URL。
 * XHS CDN 防外链，Worker 无法直接下载，必须由浏览器中转。
 */
export async function uploadXhsImageViaWorker(xhsUrl) {
  // 1. 浏览器 fetch（无 CORS 模式，只读 response，不读 body 内容）
  //    改用 Image + Canvas 方案：可绕过 CORS 读取限制
  const dataUrl = await loadImageAsDataUrl(xhsUrl)
  const mimeType = dataUrl.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'
  // 2. 上传到 Worker
  return request('/api/xhs-rewrite/upload-image', {
    method: 'POST',
    body: { dataUrl, mimeType },
  })
}

/**
 * 把跨域图片 URL 通过 <img> + Canvas 转为 base64 DataURL。
 * 注意：若 CDN 返回的响应不含 CORS 头，canvas 会被污染（tainted）。
 * XHS CDN 对浏览器正常放行，但 canvas.toDataURL() 会因 tainted 报错。
 * 因此改用 fetch + blob → createObjectURL 方案（不污染 canvas，可读 blob）。
 */
async function loadImageAsDataUrl(url) {
  // fetch 在浏览器中对同一 CDN 的请求不受跨域 canvas 限制（只要不操作 canvas 像素）
  // 但 XHS CDN 对直接 fetch 也可能 403，此时给出明确错误
  const res = await fetch(url, {
    headers: {
      Referer: 'https://www.xiaohongshu.com/',
    },
  }).catch(() => null)

  if (!res || !res.ok) {
    throw new Error(
      `无法读取原图（HTTP ${res?.status ?? '网络错误'}）。\n` +
      'XHS 图片 CDN 防外链，请在浏览器中打开图片链接后手动保存，再使用「上传图片」功能。'
    )
  }

  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** 用 AI 绘图改写图片（单张），返回新图 URL */
export const rewriteImage = (data) =>
  request('/api/xhs-rewrite/image', { method: 'POST', body: data })

