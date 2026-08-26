import { request } from './request'
import { getActiveLlmConfig } from './llmConfig'

const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * 把 XHS CDN URL（sns-webpic-qc.xhscdn.com 等）转为经 Worker 代理的地址，
 * 绕过防盗链 403。非 XHS CDN URL 原样返回。
 */
export function xhsImgProxyUrl(url) {
  if (!url) return url
  if (/xhscdn\.com|xiaohongshu\.com/i.test(url)) {
    return `${API_BASE}/api/xhs-rewrite/img-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

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
 * 把 XHS CDN 图片通过 Worker 服务端代理存入 R2，返回公开 URL。
 * 优先走服务端（绕过浏览器 CORS）；若服务端也被 CDN 拒绝，降级到浏览器 fetch 方案。
 */
export async function uploadXhsImageViaWorker(xhsUrl) {
  // 优先尝试服务端代理（Worker 用 XHS Cookie 拉取，无 CORS 限制）
  try {
    const proxyRes = await request('/api/xhs-rewrite/proxy-to-r2', {
      method: 'POST',
      body: { url: xhsUrl },
    })
    // request() 已解包 data.data，proxyRes 即 { url: '...' }
    if (proxyRes?.url) return proxyRes
  } catch (_) { /* 服务端失败时降级到浏览器方案 */ }

  // 降级：浏览器 fetch + base64 上传
  const dataUrl = await loadImageAsDataUrl(xhsUrl)
  const mimeType = dataUrl.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'
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
  // 强制升级到 HTTPS，避免 Mixed Content 被浏览器拦截
  const secureUrl = url.replace(/^http:\/\//i, 'https://')
  // fetch 在浏览器中对同一 CDN 的请求不受跨域 canvas 限制（只要不操作 canvas 像素）
  // 但 XHS CDN 对直接 fetch 也可能 403，此时给出明确错误
  const res = await fetch(secureUrl, {
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

/** 解析电商商品链接，返回商品标题和图片列表 */
export const parseProductLink = (data) =>
  request('/api/xhs-rewrite/parse-product', { method: 'POST', body: data })

/** 用 AI 绘图改写图片（单张），返回新图 URL */
export const rewriteImage = (data) =>
  request('/api/xhs-rewrite/image', { method: 'POST', body: data })

/**
 * 把 AI 生成图片通过 Worker 服务端代理存入 R2，返回可跨域访问的 URL。
 * 用于绕过 quanneng / jimeng CDN 的 CORS 限制，使浏览器 canvas 可以读取像素。
 */
export async function proxyImageForDownload(url) {
  return request('/api/xhs-rewrite/proxy-to-r2', {
    method: 'POST',
    body: { url },
  })
}
export async function uploadLocalImageToR2(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const mimeType = file.type || 'image/jpeg'
  return request('/api/xhs-rewrite/upload-image', {
    method: 'POST',
    body: { dataUrl, mimeType },
  })
}

