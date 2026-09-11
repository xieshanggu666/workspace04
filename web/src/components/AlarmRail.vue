<template>
  <div class="alarm-rail panel">
    <div class="rail-head">
      <span>当前时刻告警 · {{ timeText }}</span>
      <span class="count" :class="level">{{ alarms.length }}</span>
    </div>
    <div class="rail-body">
      <p v-if="!alarms.length" class="ok">✅ 当前时段运行正常，无告警</p>
      <div v-for="(a, i) in alarms" :key="i" class="alarm-row" :class="a.severity">
        <span class="dot" />
        <div class="alarm-content">
          <div class="alarm-title">
            <span class="sev">{{ sevText(a.severity) }}</span>
            <span class="cat">{{ a.category }}</span>
            <span class="dev">{{ a.deviceName }}</span>
          </div>
          <div class="alarm-msg">{{ a.message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AlarmEvent } from '../types';

const props = defineProps<{ alarms: AlarmEvent[]; currentHour: number }>();

const timeText = computed(() => `${String(props.currentHour).padStart(2, '0')}:00`);
const level = computed(() => {
  if (props.alarms.some((a) => a.severity === 'critical')) return 'critical';
  if (props.alarms.some((a) => a.severity === 'warning')) return 'warning';
  return 'info';
});
function sevText(s: string) {
  return { critical: '严重', warning: '警告', info: '提示' }[s] || s;
}
</script>

<style scoped>
.alarm-rail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.rail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
}
.count {
  min-width: 22px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 10px;
  font-size: 12px;
  background: #26354f;
  color: var(--text-dim);
}
.count.critical { background: rgba(255, 82, 82, 0.2); color: #ff8a8a; }
.count.warning { background: rgba(255, 192, 46, 0.16); color: var(--warning); }
.rail-body {
  overflow-y: auto;
  padding: 8px;
  flex: 1;
}
.ok {
  text-align: center;
  color: #5dbb8e;
  font-size: 12.5px;
  margin-top: 24px;
}
.alarm-row {
  display: flex;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 7px;
  margin-bottom: 6px;
  background: var(--panel-2);
  border-left: 3px solid;
}
.alarm-row.critical { border-color: var(--critical); }
.alarm-row.warning { border-color: var(--warning); }
.alarm-row.info { border-color: #4a86d8; }
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 5px;
  flex: none;
}
.critical .dot { background: var(--critical); box-shadow: 0 0 6px var(--critical); }
.warning .dot { background: var(--warning); }
.info .dot { background: #4a86d8; }
.alarm-title {
  display: flex;
  gap: 7px;
  font-size: 11.5px;
  margin-bottom: 3px;
}
.sev { color: #ff8a8a; }
.warning .sev { color: var(--warning); }
.info .sev { color: #7db4ff; }
.cat { color: var(--text-dim); }
.dev { color: var(--text-dim); }
.alarm-msg {
  font-size: 12.5px;
  line-height: 1.45;
}
</style>
