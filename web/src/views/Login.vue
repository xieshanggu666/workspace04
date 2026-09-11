<template>
  <div class="login-page">
    <div class="login-card panel">
      <div class="title">
        <span class="logo">⚡</span>
        <h1>校园微电网推演沙盘</h1>
      </div>
      <p class="subtitle">光伏 · 储能 · 充电桩 · 楼宇负载 调度仿真平台</p>

      <div class="input-row">
        <label>账号</label>
        <input v-model="username" placeholder="manager / planner" @keyup.enter="doLogin" />
      </div>
      <div class="input-row">
        <label>密码</label>
        <input v-model="password" type="password" placeholder="manager123 / planner123" @keyup.enter="doLogin" />
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <button class="btn primary login-btn" :disabled="loading" @click="doLogin">
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <div class="quick">
        <div class="quick-title">演示账号（点击填充）</div>
        <button class="chip" @click="fill('manager', 'manager123')">
          能源管理员 · 日常运行 / 故障处置
        </button>
        <button class="chip" @click="fill('planner', 'planner123')">
          规划师 · 容量方案模拟 / 对比
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const username = ref('manager');
const password = ref('manager123');
const error = ref('');
const loading = ref(false);
const auth = useAuthStore();
const router = useRouter();

function fill(u: string, p: string) {
  username.value = u;
  password.value = p;
  error.value = '';
}

async function doLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入账号和密码';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.login(username.value, password.value);
    router.push('/sandbox');
  } catch (e: any) {
    error.value = e.message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 0%, #14233f 0%, #0b1220 60%);
}
.login-card {
  width: 420px;
  padding: 34px 36px 28px;
}
.title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo {
  font-size: 26px;
}
h1 {
  font-size: 19px;
  margin: 0;
}
.subtitle {
  color: var(--text-dim);
  font-size: 12.5px;
  margin: 8px 0 22px;
}
.input-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}
.input-row label {
  width: 44px;
  color: var(--text-dim);
  font-size: 13px;
}
.input-row input {
  flex: 1;
  padding: 9px 12px;
}
.error {
  color: var(--critical);
  font-size: 12.5px;
  margin-bottom: 10px;
}
.login-btn {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  margin-top: 4px;
}
.quick {
  margin-top: 20px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.quick-title {
  color: var(--text-dim);
  font-size: 12px;
  margin-bottom: 8px;
}
.chip {
  display: block;
  width: 100%;
  text-align: left;
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 12.5px;
  margin-bottom: 6px;
}
.chip:hover {
  color: var(--text);
  border-color: #3d6bb3;
}
</style>
