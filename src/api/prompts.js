import { request } from './request'

export const getPromptList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.scene) qs.set('scene', params.scene)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/prompts${query ? '?' + query : ''}`)
}

export const getPromptDetail = (id) =>
  request(`/api/prompts/${id}`)

export const createPrompt = (data) =>
  request('/api/prompts', { method: 'POST', body: data })

export const updatePrompt = (id, data) =>
  request(`/api/prompts/${id}`, { method: 'PUT', body: data })

export const deletePrompt = (id) =>
  request(`/api/prompts/${id}`, { method: 'DELETE' })
