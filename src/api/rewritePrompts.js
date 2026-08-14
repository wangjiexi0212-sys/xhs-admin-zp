import { request } from './request'

export const getRewritePromptList = () => request('/api/rewrite-prompts')

export const createRewritePrompt = (data) =>
  request('/api/rewrite-prompts', { method: 'POST', body: data })

export const updateRewritePrompt = (id, data) =>
  request(`/api/rewrite-prompts/${id}`, { method: 'PUT', body: data })

export const deleteRewritePrompt = (id) =>
  request(`/api/rewrite-prompts/${id}`, { method: 'DELETE' })

export const resetRewritePrompt = (id) =>
  request(`/api/rewrite-prompts/${id}/reset`, { method: 'POST' })
