<template>
  <div class="timeline panel">
    <button class="play-btn" @click="$emit('toggle-play')">
      {{ playing ? '⏸' : '▶' }}
    </button>
    <div class="time-label">{{ timeText }}</div>
    <div class="period" :class="period">{{ periodText }}</div>
    <div class="track-wrap">
      <!-- 分时电价底色 -->
      <div class="periods-bar">
        <div
          v-for="(h, i) in hours"
          :key="i"
          class="period-cell"
          :class="h.period"
        />
      </div>
      <input
        class="range"
        type="range"
        min="0"
        max="23"
        step="1"
        :value="currentHour"
        @input="onInput"
      />
      <div class="ticks">
        <span v-for="h in [0, 4, 8, 12, 16, 20, 23]" :key="h">{{ String(h).padStart(2, '0') }}</span>
      </div>
    </div>
    <div class="weather" v-if="hours[currentHour]">
      <span title="辐照">🔆 {{ hours[currentHour].irradiance }}W/㎡</span>
      <span title="温度">🌡 {{ hours[currentHour].temperature.toFixed(0) }}℃</span>
      <span title="云量">☁ {{ (hours[currentHour].cloudCover * 100).toFixed(0) }}%</span>
      <span title="电价">💰 {{ hours[currentHour].price.toFixed(2) }}元</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HourResult } from '../types';

const props = defineProps<{
  hours: HourResult[];
  currentHour: number;
  playing: boolean;
}>();

const emit = defineEmits<{ (e: 'seek', h: number): void; (e: 'toggle-play'): void }>();

const timeText = computed(() => {
  const h = props.currentHour;
  return `${String(h).padStart(2, '0')}:00 — ${String((h + 1) % 24).padStart(2, '0')}:00`;
});
const period = computed(() => props.hours[props.currentHour]?.period ?? 'flat');
const periodText = computed(
  () => ({ valley: '谷段', flat: '平段', peak: '峰段' }[period.value] as string),
);

function onInput(e: Event) {
  emit('seek', Number((e.target as HTMLInputElement).value));
}
</script>

<style scoped>
.timeline {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
}
.play-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #2b7de9, #1f5fbd);
  color: #fff;
  font-size: 15px;
  flex: none;
}
.time-label {
  font-weight: 700;
  font-size: 15px;
  min-width: 104px;
}
.period {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  flex: none;
}
.period.peak { background: rgba(255, 122, 122, 0.16); color: var(--peak); }
.period.flat { background: rgba(255, 209, 102, 0.14); color: var(--flat); }
.period.valley { background: rgba(94, 211, 163, 0.14); color: var(--valley); }

.track-wrap {
  flex: 1;
  position: relative;
  padding-top: 4px;
}
.periods-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
}
.period-cell {
  flex: 1;
}
.period-cell.peak { background: rgba(255, 122, 122, 0.45); }
.period-cell.flat { background: rgba(255, 209, 102, 0.4); }
.period-cell.valley { background: rgba(94, 211, 163, 0.45); }

.range {
  width: 100%;
  accent-color: #2b7de9;
  padding: 0;
  height: 18px;
}
.ticks {
  display: flex;
  justify-content: space-between;
  color: #5f7397;
  font-size: 10px;
  padding: 0 2px;
}
.weather {
  display: flex;
  gap: 12px;
  color: var(--text-dim);
  font-size: 12px;
  flex: none;
}
</style>
