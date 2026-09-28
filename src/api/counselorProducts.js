import { request } from './request'

export const getCounselorProductList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/counselor-products${query ? '?' + query : ''}`)
}

export const getCounselorProductDetail = (id) => request(`/api/counselor-products/${id}`)

export const createCounselorProduct = (data) =>
  request('/api/counselor-products', { method: 'POST', body: data })

export const updateCounselorProduct = (id, data) =>
  request(`/api/counselor-products/${id}`, { method: 'PUT', body: data })

export const deleteCounselorProduct = (id) =>
  request(`/api/counselor-products/${id}`, { method: 'DELETE' })
