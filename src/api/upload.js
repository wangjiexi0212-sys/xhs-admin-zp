import { getToken } from './request'

export async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', {
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
