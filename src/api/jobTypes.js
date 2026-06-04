import { request } from './request'

export const getJobTypeList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/job-types${query ? '?' + query : ''}`)
}

export const createJobType = (name) =>
  request('/api/job-types', { method: 'POST', body: { name } })

export const updateJobType = (id, name) =>
  request(`/api/job-types/${id}`, { method: 'PUT', body: { name } })

export const deleteJobType = (id) =>
  request(`/api/job-types/${id}`, { method: 'DELETE' })
