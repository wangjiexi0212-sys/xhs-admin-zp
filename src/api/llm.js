import { request } from './request'

// 测试 LLM 配置可达性
export const testLlm = (config) =>
  request('/api/llm/test', { method: 'POST', body: config })

/**
 * 代理一次 chat completion
 * @param {{provider, api_key, base_url, model, messages, max_tokens?, temperature?}} payload
 * @returns {Promise<{content: string, latency: number, raw: any}>}
 */
export const chatLlm = (payload) =>
  request('/api/llm/chat', { method: 'POST', body: payload })
