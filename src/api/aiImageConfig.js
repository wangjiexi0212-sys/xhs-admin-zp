import { request } from './request'

// 列出所有 provider 配置
export const listAiImageConfigs = () =>
  request('/api/ai-image-configs', { method: 'GET' })

// 当前使用中的 provider 配置（含字段）
export const getActiveAiImageConfig = () =>
  request('/api/ai-image-configs/active', { method: 'GET' })

// 单个 provider 的配置
export const getAiImageConfig = (provider) =>
  request(`/api/ai-image-configs/${provider}`, { method: 'GET' })

// upsert 单个 provider
export const saveAiImageConfig = (provider, data) =>
  request(`/api/ai-image-configs/${provider}`, { method: 'PUT', body: data })

// 设为使用中
export const activateAiImageConfig = (provider) =>
  request(`/api/ai-image-configs/${provider}/activate`, { method: 'POST' })

// 停用全部
export const deactivateAiImageConfig = () =>
  request('/api/ai-image-configs/deactivate', { method: 'POST' })
