import { request } from './request'

export const getProductList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.job_type_id) qs.set('job_type_id', params.job_type_id)
  if (params.status !== undefined && params.status !== null && params.status !== '')
    qs.set('status', params.status)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/products${query ? '?' + query : ''}`)
}

export const getProductDetail = (id) => request(`/api/products/${id}`)

export const createProduct = (data) =>
  request('/api/products', { method: 'POST', body: data })

export const updateProduct = (id, data) =>
  request(`/api/products/${id}`, { method: 'PUT', body: data })

export const deleteProduct = (id) =>
  request(`/api/products/${id}`, { method: 'DELETE' })
