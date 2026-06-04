import { defineStore } from 'pinia';
import { login as apiLogin, fetchMe } from '@/api/auth';
import { setToken, getToken } from '@/api/request';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: null,   // { id, username, nickname, avatar, roles: [] }
  }),
  getters: {
    isLogin: s => !!s.token,
    roles: s => s.user?.roles ?? [],
    hasRole: s => code => (s.user?.roles ?? []).includes(code),
  },
  actions: {
    async login(username, password) {
      const data = await apiLogin(username, password);
      this.token = data.token;
      this.user = data.user;
      setToken(data.token);
      return data.user;
    },
    async loadMe() {
      if (!this.token) return null;
      this.user = await fetchMe();
      return this.user;
    },
    logout() {
      this.token = '';
      this.user = null;
      setToken('');
    },
  },
});
