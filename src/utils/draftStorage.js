const KEY = 'xhs_publish_drafts'
const EXPIRE_MS = 10 * 24 * 60 * 60 * 1000   // 10 天

/** 读取全部草稿（自动清理过期，按 savedAt 倒序） */
export function loadDrafts() {
  const all = _readRaw()
  const now = Date.now()
  const valid = all.filter(d => !d.expiresAt || new Date(d.expiresAt).getTime() > now)
  if (valid.length !== all.length) _writeRaw(valid)
  return [...valid].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
}

/**
 * 保存草稿。有 data.id 则更新，无则新建。
 * @returns {Object} 保存后的草稿对象（含自动生成的 id / savedAt / expiresAt）
 */
export function saveDraft(data) {
  const all = _readRaw()
  const now = new Date()
  const item = {
    ...data,
    id: data.id || `d_${Date.now()}`,
    savedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPIRE_MS).toISOString(),
  }
  const idx = all.findIndex(d => d.id === item.id)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.unshift(item)
  }
  _writeRaw(all)
  return item
}

/** 删除指定草稿 */
export function deleteDraft(id) {
  _writeRaw(_readRaw().filter(d => d.id !== id))
}

/** 获取单条草稿 */
export function getDraft(id) {
  return _readRaw().find(d => d.id === id) ?? null
}

function _readRaw() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function _writeRaw(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)) } catch { /* storage full */ }
}
