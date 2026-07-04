import { request, getToken, setToken } from './request'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// 全能绘图 - 原始代理（用于「连接测试」等场景）
export const drawQuanneng = (params) =>
  request('/api/draw/quanneng', { method: 'POST', body: params })

// md2card - 原始代理（用于「连接测试」）
export const drawMd2Card = (params) =>
  request('/api/draw/md2card', { method: 'POST', body: params })

// 商品封面图 - SSE 流式，回调：onProgress(event) / onDone(data) / onError(err)
export async function drawCoverStream(params, { onProgress, onDone, onError } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(API_BASE + '/api/draw/cover', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
  } catch (e) {
    onError?.(e)
    return
  }

  if (res.status === 401) {
    setToken('')
    if (location.pathname !== '/login') location.href = '/login'
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'progress') onProgress?.(event)
          else if (event.type === 'done') onDone?.(event.data)
          else if (event.type === 'error') onError?.(new Error(event.message))
        } catch { /* ignore malformed line */ }
      }
    }
  } catch (e) {
    onError?.(e)
  }
}
