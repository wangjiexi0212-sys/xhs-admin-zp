import { request } from './request'

export const getCardPromptList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.job_type_id) qs.set('job_type_id', params.job_type_id)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/card-prompts${query ? '?' + query : ''}`)
}

export const createCardPrompt = (data) =>
  request('/api/card-prompts', { method: 'POST', body: data })

export const updateCardPrompt = (id, data) =>
  request(`/api/card-prompts/${id}`, { method: 'PUT', body: data })

export const deleteCardPrompt = (id) =>
  request(`/api/card-prompts/${id}`, { method: 'DELETE' })
