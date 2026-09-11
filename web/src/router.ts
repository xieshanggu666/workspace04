import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue'), meta: { public: true } },
    { path: '/', redirect: '/sandbox' },
    { path: '/sandbox', component: () => import('./views/Sandbox.vue') },
    { path: '/compare', component: () => import('./views/Compare.vue') },
    { path: '/alarms', component: () => import('./views/Alarms.vue') },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.token) return '/login';
  if (to.path === '/login' && auth.token) return '/sandbox';
});
