import { request } from './request'

export const getXhsCookie = () => request('/api/settings/xhs-cookie')

export const saveXhsCookie = (data) =>
  request('/api/settings/xhs-cookie', { method: 'POST', body: data })
