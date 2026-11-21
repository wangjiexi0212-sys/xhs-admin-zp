import { request } from './request'

export const getProductImageList = () => request('/api/product-images')

export const createProductImage = (data) =>
  request('/api/product-images', { method: 'POST', body: data })

export const deleteProductImage = (id) =>
  request(`/api/product-images/${id}`, { method: 'DELETE' })
