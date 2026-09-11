<template>
  <AppLayout>
    <div class="sandbox">
      <!-- 顶部工具栏 -->
      <div class="toolbar panel">
        <div class="mode-switch">
          <button
            class="mode-btn"
            :class="{ active: grid.mode === 'operation' }"
            :disabled="!auth.isManager"
            @click="grid.setMode('operation')"
            title="能源管理员：日常运行"
          >
            🛠 运行模式
          </button>
          <button
            class="mode-btn"
            :class="{ active: grid.mode === 'plan' }"
            :disabled="!auth.isPlanner"
            @click="grid.setMode('plan')"
            title="规划师：方案模拟"
          >
            📐 规划模式
          </button>
        </div>

        <div class="tool-group">
          <label class="tool-label">天气日</label>
          <select v-model="grid.weatherDate">
            <option v-for="w in grid.weatherDays" :key="w.date" :value="w.date">
              {{ w.date }} · {{ w.label }}
            </option>
          </select>
        </div>

        <template v-if="grid.mode === 'plan'">
          <div class="tool-group">
            <label class="tool-label">预置方案</label>
            <select :value="grid.selectedScenarioId ?? ''" @change="onPickScenario">
              <option value="">— 当前画布（未保存）—</option>
              <option v-for="s in grid.scenarios.filter((x) => x.mode === 'plan')" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>
          <div class="add-group">
            <span class="tool-label">布置设备：</span>
            <button class="btn small" @click="grid.addPlanDevice('pv')">＋光伏</button>
            <button class="btn small" @click="grid.addPlanDevice('battery')">＋储能</button>
            <button class="btn small" @click="grid.addPlanDevice('charger')">＋充电桩</button>
            <button class="btn small" @click="grid.addPlanDevice('building')">＋楼宇</button>
          </div>
          <button class="btn" @click="grid.resetPlanFromBase(); grid.selectedScenarioId = null">重置画布</button>
        </template>

        <div class="spacer" />

        <button class="btn primary run-btn" :disabled="grid.loading" @click="runSim">
          {{ grid.loading ? '推演中…' : '▶ 运行推演' }}
        </button>
        <button v-if="grid.mode === 'plan' && auth.isPlanner" class="btn" @click="saveDialog = true">
          💾 保存方案
        </button>
      </div>

      <!-- KPI -->
      <KpiBar v-if="grid.kpi" :kpi="grid.kpi" />

      <!-- 主体三栏 -->
      <div class="main-grid">
        <div class="map-area">
          <CampusMap
            ref="mapRef"
            :devices="grid.visibleDevices"
            :hour-result="grid.currentHourResult"
            :soc-by-battery="socByBattery"
            :selected-name="selected?.name"
            :draggable="grid.mode === 'plan' || auth.isManager"
            :current-hour="grid.currentHour"
            @select="onSelect"
            @move="onMove"
          />
        </div>

        <aside class="side">
          <DevicePanel
            :devices="grid.visibleDevices"
            :device="selected"
            :index="selectedIndex"
            :hour-result="grid.currentHourResult"
            :soc-by-battery="socByBattery"
            :mode="grid.mode"
            :current-hour="grid.currentHour"
            @close="clearSelection"
            @select="onSelect"
            @remove="onRemoveDevice"
            @update="onUpdatePlanDevice"
            @set-fault="onSetFault"
          />
        </aside>

        <aside class="side alarm-side">
          <AlarmRail :alarms="grid.activeAlarmAtHour" :current-hour="grid.currentHour" />
        </aside>
      </div>

      <!-- 图表 + 时间轴 -->
      <div class="bottom">
        <div class="chart-wrap panel">
          <div class="chart-head">
            <span>24 小时调度曲线（{{ grid.scenarioName }} · {{ grid.weatherDate }}）</span>
            <span class="legend-hint">底色：<i class="p-valley">谷段</i> <i class="p-flat">平段</i> <i class="p-peak">峰段</i>，点击曲线可跳转时刻</span>
          </div>
          <div class="chart-body">
            <DispatchChart
              :hours="grid.hours"
              :current-hour="grid.currentHour"
              @seek="(h) => grid.setHour(h)"
            />
          </div>
        </div>
        <Timeline
          :hours="grid.hours"
          :current-hour="grid.currentHour"
          :playing="grid.playing"
          @seek="(h) => grid.setHour(h)"
          @toggle-play="grid.togglePlay()"
        />
      </div>

      <!-- 保存方案弹窗 -->
      <div v-if="saveDialog" class="modal-mask" @click.self="saveDialog = false">
        <div class="modal panel">
          <h3>保存容量方案</h3>
          <input v-model="scenarioName" placeholder="方案名称，如：方案D：光储扩容二期" />
          <div class="modal-actions">
            <button class="btn" @click="saveDialog = false">取消</button>
            <button class="btn primary" @click="doSave">保存</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import AppLayout from '../components/AppLayout.vue';
import CampusMap from '../components/CampusMap.vue';
import DevicePanel from '../components/DevicePanel.vue';
import AlarmRail from '../components/AlarmRail.vue';
import Timeline from '../components/Timeline.vue';
import DispatchChart from '../components/DispatchChart.vue';
import KpiBar from '../components/KpiBar.vue';
import { useAuthStore } from '../stores/auth';
import { useGridStore, type PlanDevice } from '../stores/grid';

const auth = useAuthStore();
const grid = useGridStore();

const selected = ref<PlanDevice | null>(null);
const selectedIndex = ref<number | null>(null);
const saveDialog = ref(false);
const scenarioName = ref('');

const socByBattery = computed<Record<string, number>>(() => {
  const h = grid.currentHourResult;
  const map: Record<string, number> = {};
  if (h) {
    grid.batteryDevices.forEach((b, i) => {
      map[b.name] = h.batterySoc[i] ?? 0;
    });
  }
  return map;
});

function onSelect(d: PlanDevice, i: number) {
  selected.value = d;
  selectedIndex.value = i;
}
function clearSelection() {
  selected.value = null;
  selectedIndex.value = null;
}

function onPickScenario(e: Event) {
  const id = Number((e.target as HTMLSelectElement).value);
  if (!id) {
    grid.resetPlanFromBase();
    grid.selectedScenarioId = null;
    return;
  }
  const s = grid.scenarios.find((x) => x.id === id);
  if (s) {
    grid.applyScenario(s);
    clearSelection();
  }
}

async function onMove(d: PlanDevice, x: number, y: number) {
  // 规划模式：只改画布；运行模式：落库（管理员）
  if (grid.mode === 'operation' && d.id && auth.isManager) {
    await grid.persistMoveDevice(d.id, x, y);
  }
}

function onRemoveDevice(i: number) {
  grid.removePlanDevice(i);
  clearSelection();
}
function onUpdatePlanDevice(i: number, patch: Partial<PlanDevice>) {
  grid.updatePlanDevice(i, patch);
  selected.value = grid.visibleDevices[i];
}
async function onSetFault(id: number, fault: boolean, msg: string) {
  await grid.setDeviceFault(id, fault, msg);
  selected.value = grid.visibleDevices.find((d) => d.id === id) ?? null;
  await runSim();
}

async function runSim() {
  clearSelection();
  await grid.simulate();
  grid.setHour(grid.currentHour);
}

async function doSave() {
  if (!scenarioName.value.trim()) return;
  await grid.saveScenario(scenarioName.value.trim());
  saveDialog.value = false;
  scenarioName.value = '';
}

// 播放循环
let timer: number | undefined;
watch(
  () => grid.playing,
  (playing) => {
    if (playing) {
      timer = window.setInterval(() => {
        if (grid.currentHour >= 23) {
          grid.setHour(0);
        } else {
          grid.setHour(grid.currentHour + 1);
        }
      }, 1200);
    } else if (timer) {
      clearInterval(timer);
    }
  },
);

onMounted(async () => {
  if (!grid.devices.length) {
    await grid.loadAll();
    await grid.loadAlarms();
  }
  grid.setMode(auth.isPlanner ? 'plan' : 'operation');
  await runSim();
});

onUnmounted(() => {
  grid.playing = false;
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.sandbox {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  flex-wrap: wrap;
}
.mode-switch {
  display: flex;
  background: var(--panel-2);
  border-radius: 8px;
  padding: 3px;
}
.mode-btn {
  border: none;
  background: transparent;
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
}
.mode-btn.active {
  background: linear-gradient(135deg, #2b7de9, #1f5fbd);
  color: #fff;
}
.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tool-label {
  color: var(--text-dim);
  font-size: 12.5px;
  white-space: nowrap;
}
.add-group {
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}
.spacer {
  flex: 1;
}
.run-btn {
  padding: 7px 22px;
}

.main-grid {
  flex: 1;
  min-height: 320px;
  display: grid;
  grid-template-columns: 1fr 290px 290px;
  gap: 10px;
  min-height: 0;
}
.map-area {
  min-height: 0;
  min-width: 0;
}
.side {
  min-height: 0;
  overflow: hidden;
}

.bottom {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 300px;
}
.chart-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.chart-head {
  flex: none;
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 12.5px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}
.legend-hint i {
  font-style: normal;
  padding: 0 6px;
  border-radius: 3px;
  margin: 0 2px;
}
.p-valley { background: rgba(94, 211, 163, 0.25); color: var(--valley); }
.p-flat { background: rgba(255, 209, 102, 0.22); color: var(--flat); }
.p-peak { background: rgba(255, 122, 122, 0.22); color: var(--peak); }
.chart-body {
  flex: 1;
  min-height: 0;
  padding: 4px 8px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(5, 10, 20, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
}
.modal {
  width: 420px;
  padding: 22px;
}
.modal h3 {
  margin: 0 0 14px;
}
.modal input {
  width: 100%;
  padding: 9px 12px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>
