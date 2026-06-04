const KEY = 'xhs_llm_configs'

export function getLlmConfigs() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function setLlmConfigs(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function getLlmConfig(id) {
  return getLlmConfigs().find(item => item.id === Number(id)) || null
}

export function createLlmConfig(data) {
  const list = getLlmConfigs()
  const item = { id: Date.now(), ...data }
  list.unshift(item)
  setLlmConfigs(list)
  return item
}

export function updateLlmConfig(id, data) {
  const list = getLlmConfigs()
  const idx = list.findIndex(item => item.id === Number(id))
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...data, id: list[idx].id }
  setLlmConfigs(list)
  return list[idx]
}

export function deleteLlmConfig(id) {
  const list = getLlmConfigs().filter(item => item.id !== Number(id))
  setLlmConfigs(list)
}

export function getActiveLlmConfig() {
  return getLlmConfigs().find(item => item.in_use) || null
}

export function setActiveLlmConfig(id) {
  const target = Number(id)
  const list = getLlmConfigs().map(item => ({
    ...item,
    in_use: item.id === target,
  }))
  setLlmConfigs(list)
  return list.find(item => item.id === target) || null
}

export function clearActiveLlmConfig() {
  const list = getLlmConfigs().map(item => ({ ...item, in_use: false }))
  setLlmConfigs(list)
}
