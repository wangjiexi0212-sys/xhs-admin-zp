import { getToken } from './request'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || (data.code && data.code !== 200)) {
    throw new Error(data.message || '上传失败')
  }
  return data.data
}
