import { request } from './request'

const ensureId = (id, name = 'id') => {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} 不合法`)
  return n
}

export const getAiContentOverview = (productId) =>
  request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/overview`)

export const createAiContentJob = (productId, body) =>
  request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/jobs`, {
    method: 'POST',
    body,
  })

export const getAiContentJob = (jobId) =>
  request(`/api/ai-content/jobs/${ensureId(jobId)}`)

export const cancelAiContentJob = (jobId) =>
  request(`/api/ai-content/jobs/${ensureId(jobId)}/cancel`, {
    method: 'POST',
    body: {},
  })

export const analyzeAiContentDocuments = (productId, body) =>
  request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/analyze-documents`, {
    method: 'POST',
    body,
  })

export const getAiContentOutputs = (productId) =>
  request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/outputs`)

export const getAiContentAssets = (productId) =>
  request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/assets`)

export const updateAiContentOutput = (id, body) =>
  request(`/api/ai-content/outputs/${ensureId(id)}`, {
    method: 'PUT',
    body,
  })

export const getAiContentQuestions = (productId, params = {}) => {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/questions${query ? '?' + query : ''}`)
}

export const getAiContentKnowledge = (productId, params = {}) => {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.page) qs.set('page', params.page)
  if (params.pageSize) qs.set('pageSize', params.pageSize)
  const query = qs.toString()
  return request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/knowledge${query ? '?' + query : ''}`)
}

export const getAiContentKnowledgeSources = (id) =>
  request(`/api/ai-content/knowledge/${ensureId(id)}/sources`)

// Phase 2 — 选题
export const generateAiTopics = (productId, body) =>
  request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/topics/generate`, { method: 'POST', body })

export const getAiTopics = (productId, params = {}) => {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  return request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/topics${query ? '?' + query : ''}`)
}

export const updateAiTopic = (id, body) =>
  request(`/api/ai-content/topics/${ensureId(id)}`, { method: 'PUT', body })

export const deleteAiTopic = (id) =>
  request(`/api/ai-content/topics/${ensureId(id)}`, { method: 'DELETE' })

// Phase 3 — 笔记
export const generateNoteFromTopic = (topicId, body) =>
  request(`/api/ai-content/topics/${ensureId(topicId, 'topic_id')}/notes/generate`, { method: 'POST', body })

export const regenerateNoteTitles = (noteId, body) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}/titles/regenerate`, { method: 'POST', body })

export const getAiNotes = (productId, params = {}) => {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  return request(`/api/regular-products/${ensureId(productId, 'product_id')}/ai-content/notes${query ? '?' + query : ''}`)
}

export const getAiNote = (noteId) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}`)

export const updateAiNote = (noteId, body) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}`, { method: 'PUT', body })

// Phase 4 — 图片脚本
export const generateImageScripts = (noteId, body) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}/image-scripts/generate`, { method: 'POST', body })

export const getImageScripts = (noteId) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}/image-scripts`)

export const updateImageScript = (scriptId, body) =>
  request(`/api/ai-content/image-scripts/${ensureId(scriptId, 'script_id')}`, { method: 'PUT', body })

export const deleteImageScript = (scriptId) =>
  request(`/api/ai-content/image-scripts/${ensureId(scriptId, 'script_id')}`, { method: 'DELETE' })

export const regenerateImageScript = (scriptId, body) =>
  request(`/api/ai-content/image-scripts/${ensureId(scriptId, 'script_id')}/regenerate`, { method: 'POST', body })

export const reorderImageScripts = (noteId, ids) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}/image-scripts/reorder`, { method: 'POST', body: { ids } })

export const generateScriptImage = (scriptId) =>
  request(`/api/ai-content/image-scripts/${ensureId(scriptId, 'script_id')}/generate-image`, { method: 'POST', body: {} })

export const getGeneratedImages = (noteId) =>
  request(`/api/ai-content/notes/${ensureId(noteId, 'note_id')}/generated-images`)
