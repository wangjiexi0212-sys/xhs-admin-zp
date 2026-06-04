import { defineStore } from 'pinia'
import {
  listAiImageConfigs,
  activateAiImageConfig,
  deactivateAiImageConfig,
} from '@/api/aiImageConfig'

export const useAiImageStore = defineStore('aiImage', {
  state: () => ({
    configs: [],          // 全部 provider 配置数组
    activeProvider: null, // 当前使用中的 provider
    loaded: false,
  }),
  getters: {
    hasActive: s => !!s.activeProvider,
    activeConfig: s => s.configs.find(c => c.provider === s.activeProvider) || null,
  },
  actions: {
    findConfig(provider) {
      return this.configs.find(c => c.provider === provider) || null
    },
    async fetchAll() {
      const list = await listAiImageConfigs()
      this.configs = Array.isArray(list) ? list : []
      const active = this.configs.find(c => c.in_use === 1 || c.in_use === true)
      this.activeProvider = active ? active.provider : null
      this.loaded = true
    },
    async ensureLoaded() {
      if (!this.loaded) await this.fetchAll()
    },
    async setActive(provider) {
      await activateAiImageConfig(provider)
      await this.fetchAll()
    },
    async clearActive() {
      await deactivateAiImageConfig()
      await this.fetchAll()
    },
  },
})
