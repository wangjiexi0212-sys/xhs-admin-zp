import { request, getToken } from './request'

export const createInterviewJob = (body) =>
  request('/api/interview-jobs', { method: 'POST', body })

export const getLatestInterviewJob = (productId) =>
  request(`/api/interview-jobs/product/${productId}/latest`)

export const getInterviewJob = (id) =>
  request(`/api/interview-jobs/${id}`)

export async function downloadInterviewJob(id, filename) {
  const res = await fetch(`/api/interview-jobs/${id}/download`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || `下载失败 ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `面试题-${id}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
