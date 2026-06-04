import { request } from './request'

export const getContentTemplateList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.job_type_id) qs.set('job_type_id', params.job_type_id)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/content-templates${query ? '?' + query : ''}`)
}

export const getContentTemplateDetail = (id) =>
  request(`/api/content-templates/${id}`)

export const createContentTemplate = (data) =>
  request('/api/content-templates', { method: 'POST', body: data })

export const updateContentTemplate = (id, data) =>
  request(`/api/content-templates/${id}`, { method: 'PUT', body: data })

export const deleteContentTemplate = (id) =>
  request(`/api/content-templates/${id}`, { method: 'DELETE' })
