import { request } from './request'

export const getFeishuConfig = () => request('/api/settings/feishu')

export const saveFeishuConfig = (data) =>
  request('/api/settings/feishu', { method: 'POST', body: data })

export const testFeishuConfig = (data) =>
  request('/api/settings/feishu/test', { method: 'POST', body: data })

/**
 * 批量写入记录到飞书多维表格
 * records: Array<{ title, body, tags, status, error_info, created_at, updated_at, file_tokens? }>
 */
export const writeFeishuBitableRecords = (records) =>
  request('/api/feishu/bitable/records', { method: 'POST', body: { records } })

/**
 * 上传单张图片到飞书素材库，返回 file_token
 * data: { base64: string (不含 data:... 头), filename: string }
 */
export const uploadFeishuBitableImage = (data) =>
  request('/api/feishu/bitable/upload-image', { method: 'POST', body: data })
