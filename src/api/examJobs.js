import { request, getToken } from './request'

export const createExamJob = (body) =>
  request('/api/exam-jobs', { method: 'POST', body })

export const getLatestExamJob = (productId) =>
  request(`/api/exam-jobs/product/${productId}/latest`)

export const getExamJob = (id) =>
  request(`/api/exam-jobs/${id}`)

export const retryExamPart = (jobId, body) =>
  request(`/api/exam-jobs/${jobId}/retry-part`, { method: 'POST', body })

export const cancelExamJob = (id) =>
  request(`/api/exam-jobs/${id}/cancel`, { method: 'POST', body: {} })

async function downloadBlob(url, filename, fallback) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || `下载失败 ${res.status}`)
  }
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename || fallback
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
}

export function downloadExamJob(id, filename) {
  return downloadBlob(`/api/exam-jobs/${id}/download`, filename, `笔试题-${id}.zip`)
}

export function downloadExamPart(id, partIndex, filename) {
  return downloadBlob(
    `/api/exam-jobs/${id}/download/${partIndex}`,
    filename,
    `笔试题-${id}-${partIndex}.docx`,
  )
}
