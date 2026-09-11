import { defineStore } from 'pinia';
import { api } from '../api';

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: 'manager' | 'planner';
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('mg_token') || '',
    user: JSON.parse(localStorage.getItem('mg_user') || 'null') as UserInfo | null,
  }),
  getters: {
    isManager: (s) => s.user?.role === 'manager',
    isPlanner: (s) => s.user?.role === 'planner',
  },
  actions: {
    async login(username: string, password: string) {
      const res = await api.login(username, password);
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('mg_token', res.token);
      localStorage.setItem('mg_user', JSON.stringify(res.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('mg_token');
      localStorage.removeItem('mg_user');
      if (location.pathname !== '/login') location.href = '/login';
    },
  },
});
