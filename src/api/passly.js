import { request } from './request'

const qs = (params = {}) => {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, v)
  })
  const q = s.toString()
  return q ? `?${q}` : ''
}

export const getPasslyDashboard = () => request('/api/admin/passly/dashboard')

export const getPasslyUsers = (params) => request(`/api/admin/passly/users${qs(params)}`)
export const updatePasslyUser = (id, data) =>
  request(`/api/admin/passly/users/${id}`, { method: 'PATCH', body: data })

export const getPasslyLoginCodes = (params) => request(`/api/admin/passly/login-codes${qs(params)}`)
export const createPasslyLoginCodes = (data) =>
  request('/api/admin/passly/login-codes', { method: 'POST', body: data })
export const updatePasslyLoginCode = (id, data) =>
  request(`/api/admin/passly/login-codes/${id}`, { method: 'PATCH', body: data })
export const getPasslyLoginCodeUsers = (id) => request(`/api/admin/passly/login-codes/${id}/users`)

export const getPasslyCategories = () => request('/api/admin/passly/categories')
export const createPasslyCategory = (data) =>
  request('/api/admin/passly/categories', { method: 'POST', body: data })
export const updatePasslyCategory = (id, data) =>
  request(`/api/admin/passly/categories/${id}`, { method: 'PUT', body: data })
export const updatePasslyCategoryStatus = (id, status) =>
  request(`/api/admin/passly/categories/${id}/status`, { method: 'PATCH', body: { status } })
export const syncPasslyCategoryPan = (id) =>
  request(`/api/admin/passly/categories/${id}/pan/sync`, { method: 'POST' })

export const getPasslyResources = (params) => request(`/api/admin/passly/resources${qs(params)}`)
export const updatePasslyResourceStatus = (id, status) =>
  request(`/api/admin/passly/resources/${id}/status`, { method: 'PATCH', body: { status } })
export const deletePasslyResource = (id) =>
  request(`/api/admin/passly/resources/${id}`, { method: 'DELETE' })

export const getPasslySettings = () => request('/api/admin/passly/settings')
export const updatePasslySettings = (data) =>
  request('/api/admin/passly/settings', { method: 'PUT', body: data })

export const getPasslyQuestions = (params) => request(`/api/admin/passly/questions${qs(params)}`)
export const updatePasslyQuestion = (id, data) =>
  request(`/api/admin/passly/questions/${id}`, { method: 'PATCH', body: data })
export const updatePasslyQuestionStatus = (id, status) =>
  request(`/api/admin/passly/questions/${id}/status`, { method: 'PATCH', body: { status } })
