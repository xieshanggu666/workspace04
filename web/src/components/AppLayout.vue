<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo">⚡</span>
        <span>校园微电网推演沙盘</span>
      </div>
      <nav class="nav">
        <router-link to="/sandbox" class="nav-item" :class="{ active: $route.path === '/sandbox' }">
          地图推演
        </router-link>
        <router-link to="/compare" class="nav-item" :class="{ active: $route.path === '/compare' }">
          容量方案对比
        </router-link>
        <router-link to="/alarms" class="nav-item" :class="{ active: $route.path === '/alarms' }">
          故障告警回放
          <span v-if="alarmCount" class="alarm-badge">{{ alarmCount }}</span>
        </router-link>
      </nav>
      <div class="user-box">
        <span class="tag" :class="auth.user?.role">{{ roleText }}</span>
        <span class="user-name">{{ auth.user?.displayName }}</span>
        <button class="btn" @click="auth.logout()">退出</button>
      </div>
    </header>

    <main class="content">
      <slot />
    </main>

    <transition name="toast">
      <div v-if="grid.toast" class="toast">{{ grid.toast }}</div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useGridStore } from '../stores/grid';

const auth = useAuthStore();
const grid = useGridStore();

const roleText = computed(() => (auth.isManager ? '能源管理员' : '规划师'));
const alarmCount = computed(
  () => grid.alarmsList.filter((a) => a.status === 'active' && a.severity === 'critical').length,
);

onMounted(async () => {
  if (!grid.devices.length) {
    await grid.loadAll();
    await grid.loadAlarms();
  }
});
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  height: 56px;
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 28px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
}
.logo {
  font-size: 20px;
}
.nav {
  display: flex;
  gap: 4px;
}
.nav-item {
  position: relative;
  padding: 7px 14px;
  border-radius: 6px;
  color: var(--text-dim);
  text-decoration: none;
  font-size: 13.5px;
}
.nav-item:hover {
  color: var(--text);
  background: var(--panel-2);
}
.nav-item.active {
  color: #7db4ff;
  background: rgba(43, 125, 233, 0.12);
}
.alarm-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--critical);
  color: #fff;
  border-radius: 9px;
  font-size: 10px;
  min-width: 17px;
  height: 17px;
  line-height: 17px;
  text-align: center;
  padding: 0 4px;
}
.user-box {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-name {
  color: var(--text-dim);
  font-size: 13px;
}
.content {
  flex: 1;
  min-height: 0;
  padding: 14px;
}
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f3557;
  border: 1px solid #3d6bb3;
  padding: 10px 22px;
  border-radius: 8px;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
