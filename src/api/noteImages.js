import { request } from './request'

export const NOTE_IMAGE_CATEGORIES = [
  { code: 'public_basic', name: '公共基础知识' },
  { code: 'job_professional', name: '岗位专业知识' },
  { code: 'civil_service', name: '行测复习资料' },
  { code: 'comprehensive', name: '综合能力测试' },
  { code: 'essay_writing', name: '申论写作知识' },
]

export const getNoteImageList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/note-images${query ? '?' + query : ''}`)
}

export const getNoteImageDetail = (id) => request(`/api/note-images/${id}`)

export const createNoteImage = (data) =>
  request('/api/note-images', { method: 'POST', body: data })

export const updateNoteImage = (id, data) =>
  request(`/api/note-images/${id}`, { method: 'PUT', body: data })

export const deleteNoteImage = (id) =>
  request(`/api/note-images/${id}`, { method: 'DELETE' })
