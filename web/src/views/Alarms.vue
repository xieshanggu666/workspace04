<template>
  <AppLayout>
    <div class="alarms-page">
      <div class="head panel">
        <div>
          <h2>故障告警回放</h2>
          <p>
            按时间轴回放当日调度过程中的设备故障、峰值越限、天气波动与高温告警；
            管理员可在「地图推演」中设置设备故障后重新推演并同步告警。
          </p>
        </div>
        <div class="head-actions">
          <label>天气日：
            <select v-model="grid.weatherDate">
              <option v-for="w in grid.weatherDays" :key="w.date" :value="w.date">
                {{ w.date }} · {{ w.label }}
              </option>
            </select>
          </label>
          <button v-if="auth.isManager" class="btn" @click="sync">🔄 重新推演并同步告警</button>
          <button class="btn primary" :disabled="playing" @click="playAll">▶ 全日回放</button>
        </div>
      </div>

      <!-- 24 小时告警密度条 -->
      <div class="panel density">
        <div
          v-for="h in 24"
          :key="h - 1"
          class="hour-cell"
          :class="hourLevel(h - 1)"
          @click="grid.setHour(h - 1)"
        >
          <span class="hour-num">{{ h - 1 }}</span>
          <span class="hour-count">{{ alarmsAt(h - 1).length }}</span>
        </div>
      </div>

      <div class="main">
        <!-- 时间轴 -->
        <div class="panel replay-timeline">
          <button class="btn" @click="step(-1)">◀</button>
          <div class="clock">{{ timeText }}</div>
          <button class="btn" @click="step(1)">▶</button>
          <input
            type="range"
            min="0"
            max="23"
            v-model.number="grid.currentHour"
            class="slider"
          />
        </div>

        <!-- 当前时刻 -->
        <div class="panel now-panel">
          <div class="now-title">
            {{ timeText }} 时刻（{{ periodText }}）
            <span class="total">共 {{ currentAlarms.length }} 条告警</span>
          </div>
          <div v-if="!currentAlarms.length" class="no-alarm">✅ 该小时运行正常</div>
          <div v-for="(a, i) in currentAlarms" :key="i" class="alarm-card" :class="a.severity">
            <div class="card-top">
              <span class="sev" :class="a.severity">{{ sevText(a.severity) }}</span>
              <span class="cat">{{ a.category }}</span>
              <span class="device">@ {{ a.deviceName }}</span>
            </div>
            <div class="msg">{{ a.message }}</div>
            <div class="card-foot">
              <span class="status" :class="a.status">{{ statusText(a.status) }}</span>
              <button
                v-if="auth.isManager && a.id && a.status !== 'resolved'"
                class="btn tiny"
                @click="ack(a)"
              >
                {{ a.status === 'acknowledged' ? '标记已解决' : '确认告警' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 全日告警流水 -->
        <div class="panel log-panel">
          <div class="log-title">全日告警流水（{{ grid.alarmsList.length }} 条，按时间排序）</div>
          <div class="log-body">
            <div
              v-for="a in grid.alarmsList"
              :key="a.id"
              class="log-row"
              :class="[a.severity, { focus: a.hour === grid.currentHour }]"
              @click="grid.setHour(a.hour)"
            >
              <span class="log-time">{{ String(a.hour).padStart(2, '0') }}:00</span>
              <span class="log-sev">{{ sevText(a.severity) }}</span>
              <span class="log-cat">{{ a.category }}</span>
              <span class="log-msg">{{ a.message }}</span>
              <span class="log-status" :class="a.status">{{ statusText(a.status) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import AppLayout from '../components/AppLayout.vue';
import { useAuthStore } from '../stores/auth';
import { useGridStore } from '../stores/grid';
import { api } from '../api';
import type { AlarmEvent } from '../types';

const auth = useAuthStore();
const grid = useGridStore();
const playing = ref(false);
let timer: number | undefined;

const timeText = computed(
  () => `${String(grid.currentHour).padStart(2, '0')}:00 — ${String((grid.currentHour + 1) % 24).padStart(2, '0')}:00`,
);
const periodText = computed(() => {
  const h = grid.hours[grid.currentHour];
  if (!h) return '';
  return { valley: '电价谷段', flat: '电价平段', peak: '电价峰段' }[h.period];
});

const currentAlarms = computed(() =>
  grid.alarmsList
    .filter((a) => a.hour === grid.currentHour)
    .sort((a, b) => rank(b.severity) - rank(a.severity)),
);

function alarmsAt(h: number) {
  return grid.alarmsList.filter((a) => a.hour === h);
}
function hourLevel(h: number) {
  const list = alarmsAt(h);
  if (list.some((a) => a.severity === 'critical')) return 'critical';
  if (list.some((a) => a.severity === 'warning')) return 'warning';
  if (list.length) return 'info';
  return '';
}
function sevText(s: string) {
  return { critical: '严重', warning: '警告', info: '提示' }[s] || s;
}
function statusText(s?: string) {
  return { active: '未处理', acknowledged: '已确认', resolved: '已解决' }[s ?? 'active'];
}
function rank(s: string) {
  return s === 'critical' ? 3 : s === 'warning' ? 2 : 1;
}

function step(d: number) {
  grid.setHour(grid.currentHour + d);
}

async function sync() {
  await api.syncAlarms(grid.weatherDate);
  await grid.loadAlarms();
  grid.showToast('已按最新设备状态重新推演并同步告警');
}

async function ack(a: AlarmEvent) {
  if (!a.id) return;
  const next = a.status === 'acknowledged' ? 'resolved' : 'acknowledged';
  await api.updateAlarm(a.id, next);
  await grid.loadAlarms();
}

async function ensureSim() {
  if (!grid.hours.length) await grid.simulate();
}

function playAll() {
  playing.value = true;
  grid.setHour(0);
  timer = window.setInterval(() => {
    if (grid.currentHour >= 23) {
      playing.value = false;
      clearInterval(timer);
      return;
    }
    grid.setHour(grid.currentHour + 1);
  }, 900);
}

watch(
  () => grid.weatherDate,
  async () => {
    await Promise.all([grid.loadAlarms(), grid.simulate()]);
    // 该天气日尚未生成过基线告警时，管理员自动按日推演同步一次
    if (auth.isManager && grid.alarmsList.length === 0) {
      try {
        await sync();
      } catch {}
    }
  },
);

onMounted(async () => {
  if (!grid.devices.length) await grid.loadAll();
  await grid.loadAlarms();
  ensureSim();
});
onUnmounted(() => {
  playing.value = false;
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.alarms-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.head {
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  gap: 16px;
}
.head h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.head p {
  margin: 0;
  color: var(--text-dim);
  font-size: 12.5px;
  max-width: 680px;
}
.head-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: none;
}

.density {
  flex: none;
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 3px;
  padding: 8px;
}
.hour-cell {
  height: 46px;
  border-radius: 5px;
  background: var(--panel-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid transparent;
}
.hour-cell:hover {
  border-color: #3d6bb3;
}
.hour-cell.info { background: rgba(74, 134, 216, 0.3); }
.hour-cell.warning { background: rgba(255, 192, 46, 0.32); }
.hour-cell.critical { background: rgba(255, 82, 82, 0.4); }
.hour-num {
  font-size: 11px;
  color: var(--text-dim);
}
.hour-count {
  font-size: 14px;
  font-weight: 700;
}

.main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 340px 1fr;
  grid-template-rows: auto 1fr;
  gap: 12px;
}
.replay-timeline {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}
.clock {
  font-size: 17px;
  font-weight: 700;
  min-width: 110px;
}
.slider {
  flex: 1;
  accent-color: #2b7de9;
}

.now-panel,
.log-panel {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.now-title {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}
.total {
  float: right;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
}
.no-alarm {
  padding: 40px 16px;
  text-align: center;
  color: #5dbb8e;
  font-size: 13px;
}
.alarm-card {
  margin: 10px 12px 0;
  border-radius: 8px;
  padding: 11px 13px;
  background: var(--panel-2);
  border-left: 4px solid;
}
.alarm-card.critical { border-color: var(--critical); }
.alarm-card.warning { border-color: var(--warning); }
.alarm-card.info { border-color: #4a86d8; }
.card-top {
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.sev {
  font-weight: 700;
}
.sev.critical { color: #ff8a8a; }
.sev.warning { color: var(--warning); }
.sev.info { color: #7db4ff; }
.cat {
  color: var(--text-dim);
}
.device {
  color: var(--text-dim);
}
.msg {
  margin: 6px 0;
  font-size: 13px;
}
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.status {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 9px;
}
.status.active { background: rgba(255, 82, 82, 0.16); color: #ff8a8a; }
.status.acknowledged { background: rgba(255, 192, 46, 0.14); color: var(--warning); }
.status.resolved { background: rgba(46, 204, 113, 0.14); color: var(--green); }
.btn.tiny {
  padding: 3px 10px;
  font-size: 11.5px;
}

.log-title {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 13px;
  flex: none;
}
.log-body {
  overflow-y: auto;
  flex: 1;
}
.log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid #1a2538;
  cursor: pointer;
  font-size: 12.5px;
}
.log-row:hover {
  background: var(--panel-2);
}
.log-row.focus {
  background: rgba(43, 125, 233, 0.1);
  box-shadow: inset 3px 0 #2b7de9;
}
.log-time {
  color: #8db8ef;
  font-weight: 600;
  flex: none;
  width: 42px;
}
.log-sev {
  flex: none;
  width: 34px;
  font-size: 11px;
}
.log-row.critical .log-sev { color: #ff8a8a; }
.log-row.warning .log-sev { color: var(--warning); }
.log-row.info .log-sev { color: #7db4ff; }
.log-cat {
  flex: none;
  color: var(--text-dim);
  width: 64px;
  font-size: 11.5px;
}
.log-msg {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.log-status {
  flex: none;
  font-size: 11px;
  color: var(--text-dim);
}
.log-status.active { color: #ff8a8a; }
.log-status.resolved { color: var(--green); }
</style>
