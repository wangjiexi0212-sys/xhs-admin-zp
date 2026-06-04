import { request } from './request'

// 全能绘图 - 原始代理（用于「连接测试」等场景）
export const drawQuanneng = (params) =>
  request('/api/draw/quanneng', { method: 'POST', body: params })

// md2card - 原始代理（用于「连接测试」）
export const drawMd2Card = (params) =>
  request('/api/draw/md2card', { method: 'POST', body: params })

// 商品封面图 - 后端读取当前使用中的绘图渠道分发
export const drawCover = (params) =>
  request('/api/draw/cover', { method: 'POST', body: params })
