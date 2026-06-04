import { request } from './request'

export const getExamTemplateList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.job_type_id) qs.set('job_type_id', params.job_type_id)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/exam-templates${query ? '?' + query : ''}`)
}

export const getExamTemplateDetail = (id) =>
  request(`/api/exam-templates/${id}`)

export const createExamTemplate = (data) =>
  request('/api/exam-templates', { method: 'POST', body: data })

export const updateExamTemplate = (id, data) =>
  request(`/api/exam-templates/${id}`, { method: 'PUT', body: data })

export const deleteExamTemplate = (id) =>
  request(`/api/exam-templates/${id}`, { method: 'DELETE' })
