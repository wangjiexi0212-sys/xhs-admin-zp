import { request } from './request'

export const getTitleFormulaList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.job_type_id) qs.set('job_type_id', params.job_type_id)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/title-formulas${query ? '?' + query : ''}`)
}

export const getTitleFormulaDetail = (id) =>
  request(`/api/title-formulas/${id}`)

export const createTitleFormula = (data) =>
  request('/api/title-formulas', { method: 'POST', body: data })

export const updateTitleFormula = (id, data) =>
  request(`/api/title-formulas/${id}`, { method: 'PUT', body: data })

export const deleteTitleFormula = (id) =>
  request(`/api/title-formulas/${id}`, { method: 'DELETE' })

export const getRandomTitleFormula = (jobTypeId) =>
  request(`/api/title-formulas/random?job_type_id=${jobTypeId}`)
