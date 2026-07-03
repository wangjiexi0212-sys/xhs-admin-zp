import { request } from './request'

export const getBaiduAuthUrl = () => request('/api/baidu/auth-url')

export const exchangeBaiduCode = (code) =>
  request('/api/baidu/exchange-code', { method: 'POST', body: { code } })

export const getBaiduTokenStatus = () => request('/api/baidu/token-status')

export const getBaiduFiles = (path) =>
  request(`/api/baidu/files?path=${encodeURIComponent(path)}`)
