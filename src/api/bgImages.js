import { request } from './request'

export const getBgImageList = () => request('/api/bg-images')

export const createBgImage = (url) =>
  request('/api/bg-images', { method: 'POST', body: { url } })

export const deleteBgImage = (id) =>
  request(`/api/bg-images/${id}`, { method: 'DELETE' })
