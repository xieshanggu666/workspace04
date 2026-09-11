<template>
  <div class="map-wrap panel">
    <div class="map-head">
      <span>校园平面图（1000 × 700）</span>
      <span class="hint">拖拽图标移动设备 · 点击查看详情 / 操作</span>
    </div>
    <div class="map-scroll">
      <svg
        class="map"
        viewBox="0 0 1000 700"
        @mousemove="onMouseMove"
        @mouseup="endDrag"
        @mouseleave="endDrag"
      >
        <!-- 校园底图：道路与地块 -->
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2940" stroke-width="0.5" />
          </pattern>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#101d31" />
            <stop offset="100%" stop-color="#0d1626" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="1000" height="700" fill="url(#ground)" />
        <rect x="0" y="0" width="1000" height="700" fill="url(#grid)" />

        <!-- 道路 -->
        <line x1="0" y1="380" x2="1000" y2="380" stroke="#233149" stroke-width="26" />
        <line x1="0" y1="380" x2="1000" y2="380" stroke="#2c3e5e" stroke-width="2" stroke-dasharray="14 10" />
        <line x1="400" y1="0" x2="400" y2="700" stroke="#233149" stroke-width="22" />
        <line x1="820" y1="0" x2="820" y2="700" stroke="#233149" stroke-width="18" />
        <text x="600" y="372" fill="#44597a" font-size="13">校园中央大道</text>

        <!-- 校区边界与校门 -->
        <rect x="10" y="10" width="980" height="680" fill="none" stroke="#2b3c58" stroke-width="2" rx="6" />
        <g>
          <rect x="385" y="686" width="30" height="16" fill="#3a5178" />
          <text x="400" y="678" fill="#6d82a3" font-size="12" text-anchor="middle">南门</text>
          <rect x="974" y="372" width="16" height="30" fill="#3a5178" />
          <text x="950" y="362" fill="#6d82a3" font-size="12" text-anchor="end">东门</text>
        </g>

        <!-- 并网点 -->
        <g :transform="`translate(${grid.x},${grid.y})`">
          <circle r="20" :fill="gridOverload ? '#5a1f1f' : '#1f3557'" stroke="#4a86d8" stroke-width="2" />
          <text text-anchor="middle" dy="6" font-size="18">🔌</text>
          <text y="-30" text-anchor="middle" fill="#8db8ef" font-size="12">并网点</text>
          <text y="38" text-anchor="middle" :fill="gridOverload ? '#ff8a8a' : '#7db4ff'" font-size="12" font-weight="700">
            {{ gridText }}
          </text>
        </g>

        <!-- 功率流动线（当前小时） -->
        <g v-if="hourResult">
          <!-- 光伏 -> 储能/并网点 -->
          <line
            v-for="(flow, i) in flows"
            :key="'flow' + i"
            :x1="flow.x1"
            :y1="flow.y1"
            :x2="flow.x2"
            :y2="flow.y2"
            :stroke="flow.color"
            :stroke-width="flow.width"
            stroke-linecap="round"
            opacity="0.55"
            :stroke-dasharray="`${flow.dash} 14`"
            class="flow-line"
          />
        </g>

        <!-- 设备 -->
        <g
          v-for="(d, i) in devices"
          :key="(d.id ?? 'new') + '-' + i"
          :transform="`translate(${d.x},${d.y})`"
          class="device"
          :class="{ fault: isFaulted(d), selected: selectedName === d.name }"
          @mousedown="startDrag($event, i)"
          @click.stop="$emit('select', d, i)"
        >
          <circle v-if="isFaulted(d)" r="26" fill="none" stroke="#ff5252" stroke-width="2">
            <animate attributeName="r" values="22;30;22" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle r="21" :fill="iconBg(d.type)" :stroke="iconStroke(d.type)" stroke-width="1.5" />
          <text text-anchor="middle" dy="7" font-size="18">{{ icon(d.type) }}</text>
          <text y="-28" text-anchor="middle" fill="#cfe0f7" font-size="12.5" font-weight="600">
            {{ d.name }}
          </text>
          <text y="40" text-anchor="middle" :fill="isFaulted(d) ? '#ff8a8a' : powerColor(d)" font-size="11.5" font-weight="700">
            {{ powerLabel(d) }}
          </text>
          <!-- 电池 SOC 环 -->
          <g v-if="d.type === 'battery' && socOf(d) != null">
            <circle r="27" fill="none" stroke="#23344f" stroke-width="4" />
            <circle
              r="27"
              fill="none"
              :stroke="socColor(socOf(d))"
              stroke-width="4"
              :stroke-dasharray="`${(socOf(d)! / 100) * 169.6} 169.6`"
              transform="rotate(-90)"
              stroke-linecap="round"
            />
          </g>
          <text v-if="isFaulted(d)" y="55" text-anchor="middle" fill="#ff8a8a" font-size="10.5">
            ⚠ {{ faultText(d) }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HourResult } from '../types';
import type { PlanDevice } from '../stores/grid';

const props = defineProps<{
  devices: PlanDevice[];
  hourResult: HourResult | null;
  socByBattery: Record<string, number>;
  selectedName?: string;
  draggable?: boolean;
  currentHour: number;
}>();

const emit = defineEmits<{
  (e: 'select', d: PlanDevice, i: number): void;
  (e: 'move', d: PlanDevice, x: number, y: number): void;
}>();

const grid = { x: 500, y: 380 };
const dragging = ref<{ index: number; dx: number; dy: number } | null>(null);

function icon(t: string) {
  return { pv: '🔆', battery: '🔋', charger: '🚗', building: '🏫' }[t] || '❔';
}
function iconBg(t: string) {
  return { pv: '#3d2c0c', battery: '#0e3438', charger: '#2c1b45', building: '#1e2a3e' }[t];
}
function iconStroke(t: string) {
  return { pv: '#f5a623', battery: '#36c2cf', charger: '#b06ef7', building: '#7d93b2' }[t];
}

function isFaulted(d: PlanDevice) {
  if (d.status === 'fault' && !d.injectedFault) return true;
  const f = d.injectedFault;
  return !!f && props.currentHour >= f.startHour && props.currentHour <= f.endHour;
}
function faultText(d: PlanDevice) {
  const f = d.injectedFault;
  return (f && props.currentHour >= f.startHour && props.currentHour <= f.endHour
    ? f.message
    : d.faultMessage) || '故障';
}

const gridImport = computed(() => props.hourResult?.gridImportKw ?? 0);
const gridExport = computed(() => props.hourResult?.gridExportKw ?? 0);
const gridOverload = computed(
  () => gridImport.value > 600 && props.hourResult?.period === 'peak',
);
const gridText = computed(() => {
  if (!props.hourResult) return '— kW';
  if (gridExport.value > 0) return `上网 ${gridExport.value.toFixed(0)}kW`;
  return `购电 ${gridImport.value.toFixed(0)}kW`;
});

function socOf(d: PlanDevice) {
  return props.socByBattery[d.name] ?? null;
}
function socColor(soc: number) {
  if (soc <= 15) return '#ff6b6b';
  if (soc <= 35) return '#ffc02e';
  return '#36c2cf';
}

function powerLabel(d: PlanDevice) {
  const h = props.hourResult;
  if (!h) return '';
  if (isFaulted(d)) return '0 kW';
  if (d.type === 'pv') {
    const share = pvShare(d);
    return `${(h.pvKw * share).toFixed(0)} kW`;
  }
  if (d.type === 'building') {
    const share = loadShare(d);
    return `${(h.buildingLoadKw * share).toFixed(0)} kW`;
  }
  if (d.type === 'charger') {
    const share = chargerShare(d);
    return `${(h.chargerLoadKw * share).toFixed(0)} kW`;
  }
  if (d.type === 'battery') {
    if (h.batteryChargeKw > 0 && batteryShare(d) > 0) return `充 ${(h.batteryChargeKw * batteryShare(d)).toFixed(0)}kW`;
    if (h.batteryDischargeKw > 0 && batteryShare(d) > 0) return `放 ${(h.batteryDischargeKw * batteryShare(d)).toFixed(0)}kW`;
    return '待机';
  }
  return '';
}

// 同类型多设备时按额定容量分摊当前小时聚合功率（可视化近似）
function pvShare(d: PlanDevice) {
  const total = props.devices.filter((x) => x.type === 'pv' && !isFaulted(x)).reduce((s, x) => s + (x.params.capacityKw || 0), 0);
  return total ? (d.params.capacityKw || 0) / total : 0;
}
function loadShare(d: PlanDevice) {
  const total = props.devices.filter((x) => x.type === 'building' && !isFaulted(x)).reduce((s, x) => s + (x.params.baseLoadKw || 0), 0);
  return total ? (d.params.baseLoadKw || 0) / total : 0;
}
function chargerShare(d: PlanDevice) {
  const total = props.devices.filter((x) => x.type === 'charger' && !isFaulted(x)).reduce((s, x) => s + (x.params.powerKw || 0) * (x.params.count || 1), 0);
  const cap = (d.params.powerKw || 0) * (d.params.count || 1);
  return total ? cap / total : 0;
}
function batteryShare(d: PlanDevice) {
  const bats = props.devices.filter((x) => x.type === 'battery' && !isFaulted(x));
  const total = bats.reduce((s, x) => s + (x.params.powerKw || 0), 0);
  return total ? (d.params.powerKw || 0) / total : 0;
}
function powerColor(d: PlanDevice) {
  if (d.type === 'pv') return '#f5a623';
  if (d.type === 'charger') return '#c79bff';
  if (d.type === 'battery') return '#6fd9e3';
  return '#a9bcd8';
}

const flows = computed(() => {
  const h = props.hourResult;
  if (!h) return [];
  const list: any[] = [];
  const pvs = props.devices.filter((d) => d.type === 'pv');
  const bats = props.devices.filter((d) => d.type === 'battery');
  const chargers = props.devices.filter((d) => d.type === 'charger');

  // 光伏 -> 并网中心（黄色）
  if (h.pvKw > 1) {
    for (const p of pvs) {
      list.push({
        x1: p.x, y1: p.y, x2: grid.x, y2: grid.y,
        color: '#f5a623', width: Math.min(8, 1.5 + (h.pvKw * pvShare(p)) / 80),
        dash: 6,
      });
    }
  }
  // 储能 -> 中心（放电，青色）
  if (h.batteryDischargeKw > 1) {
    for (const b of bats) {
      list.push({
        x1: b.x, y1: b.y, x2: grid.x, y2: grid.y,
        color: '#36c2cf', width: Math.min(8, 1.5 + (h.batteryDischargeKw * batteryShare(b)) / 80),
        dash: 6,
      });
    }
  }
  // 中心 -> 储能（充电，青色虚线反向）
  if (h.batteryChargeKw > 1) {
    for (const b of bats) {
      list.push({
        x1: grid.x, y1: grid.y, x2: b.x, y2: b.y,
        color: '#36c2cf', width: Math.min(8, 1.5 + (h.batteryChargeKw * batteryShare(b)) / 80),
        dash: 6,
      });
    }
  }
  // 充电桩 -> 中心用电（紫色，视觉上向负荷）
  for (const c of chargers) {
    if (h.chargerLoadKw * chargerShare(c) > 5) {
      list.push({
        x1: grid.x, y1: grid.y, x2: c.x, y2: c.y,
        color: '#b06ef7', width: Math.min(7, 1 + (h.chargerLoadKw * chargerShare(c)) / 120),
        dash: 4,
      });
    }
  }
  return list;
});

function svgPoint(e: MouseEvent) {
  const svg = (e.currentTarget as HTMLElement).closest('svg')!;
  const rect = svg.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 1000,
    y: ((e.clientY - rect.top) / rect.height) * 700,
  };
}

function startDrag(e: MouseEvent, index: number) {
  if (props.draggable === false) return;
  const p = svgPoint(e);
  const d = props.devices[index];
  dragging.value = { index, dx: p.x - d.x, dy: p.y - d.y };
}
function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return;
  const p = svgPoint(e);
  const d = props.devices[dragging.value.index];
  d.x = Math.max(30, Math.min(970, p.x - dragging.value.dx));
  d.y = Math.max(30, Math.min(670, p.y - dragging.value.dy));
}
function endDrag() {
  if (dragging.value) {
    const d = props.devices[dragging.value.index];
    emit('move', d, Math.round(d.x), Math.round(d.y));
    dragging.value = null;
  }
}
</script>

<style scoped>
.map-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.map-head {
  flex: none;
  display: flex;
  justify-content: space-between;
  padding: 9px 14px;
  color: var(--text-dim);
  font-size: 12.5px;
  border-bottom: 1px solid var(--border);
}
.hint {
  font-size: 11.5px;
  color: #5f7397;
}
.map-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.map {
  width: 100%;
  height: 100%;
}
.device {
  cursor: grab;
}
.device:active {
  cursor: grabbing;
}
.device.selected circle:first-of-type {
  filter: drop-shadow(0 0 8px rgba(125, 180, 255, 0.9));
}
.flow-line {
  animation: flow 0.9s linear infinite;
}
@keyframes flow {
  to {
    stroke-dashoffset: -20;
  }
}
</style>
