import { defineStore } from 'pinia'
import {
  getActiveLlmConfig,
  setActiveLlmConfig,
  clearActiveLlmConfig,
} from '@/api/llmConfig'

export const useLlmStore = defineStore('llm', {
  state: () => ({
    active: null,    // 当前使用中的配置
    checked: false,  // 是否已完成首次加载
  }),
  getters: {
    hasActive: s => !!s.active,
    activeProvider: s => s.active?.provider || '',
    activeModel: s => s.active?.default_model || '',
  },
  actions: {
    load() {
      this.active = getActiveLlmConfig()
      this.checked = true
      return this.active
    },
    setActive(id) {
      const item = setActiveLlmConfig(id)
      this.active = item
      return item
    },
    clearActive() {
      clearActiveLlmConfig()
      this.active = null
    },
  },
})
