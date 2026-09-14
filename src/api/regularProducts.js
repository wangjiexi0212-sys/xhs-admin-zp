import { request } from './request'

export const getRegularProductList = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/regular-products${query ? '?' + query : ''}`)
}

export const getRegularProductDetail = (id) => request(`/api/regular-products/${id}`)

export const createRegularProduct = (data) =>
  request('/api/regular-products', { method: 'POST', body: data })

export const updateRegularProduct = (id, data) =>
  request(`/api/regular-products/${id}`, { method: 'PUT', body: data })

export const deleteRegularProduct = (id) =>
  request(`/api/regular-products/${id}`, { method: 'DELETE' })
