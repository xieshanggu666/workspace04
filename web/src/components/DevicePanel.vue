<template>
  <div class="device-panel panel">
    <div class="panel-head">
      <span v-if="device">
        <span class="tag" :class="device.type">{{ typeText }}</span>
        <b class="name">{{ device.name }}</b>
      </span>
      <span v-else class="empty-title">设备列表</span>
      <button v-if="device" class="close" @click="$emit('close')">×</button>
    </div>

    <!-- 未选中：设备清单 -->
    <div v-if="!device" class="device-list">
      <div
        v-for="(d, i) in devices"
        :key="`${d.id ?? 'n'}-${i}`"
        class="list-row"
        :class="{ fault: isFaulted(d) }"
        @click="$emit('select', d, i)"
      >
        <span class="ico">{{ icon(d.type) }}</span>
        <span class="row-name">{{ d.name }}</span>
        <span class="row-spec">{{ spec(d) }}</span>      </div>
      <p v-if="!devices.length" class="no-data">画布暂无设备，请在规划模式下添加</p>
    </div>

    <!-- 选中详情 -->
    <div v-else class="detail">
      <div v-if="hourResult" class="live">
        <template v-if="device.type === 'pv'">
          <div class="live-row"><span>当前出力</span><b class="pv">{{ livePv.toFixed(1) }} kW</b></div>
          <div class="live-row"><span>额定容量</span><b>{{ device.params.capacityKw }} kWp</b></div>
        </template>
        <template v-else-if="device.type === 'building'">
          <div class="live-row"><span>当前负载</span><b>{{ liveBuilding.toFixed(1) }} kW</b></div>
          <div class="live-row"><span>建筑面积</span><b>{{ device.params.areaM2 }} ㎡</b></div>
          <div class="live-row"><span>基础负载</span><b>{{ device.params.baseLoadKw }} kW</b></div>
        </template>
        <template v-else-if="device.type === 'charger'">
          <div class="live-row"><span>当前负载</span><b class="charger">{{ liveCharger.toFixed(1) }} kW</b></div>
          <div class="live-row"><span>充电桩数</span><b>{{ device.params.count }} × {{ device.params.powerKw }}kW</b></div>
        </template>
        <template v-else>
          <div class="live-row">
            <span>当前状态</span>
            <b :class="batFlowClass">{{ batFlowText }}</b>
          </div>
          <div class="live-row"><span>SOC</span><b :style="{ color: socColor }">{{ soc?.toFixed(0) ?? '—' }}%</b></div>
          <div class="soc-bar">
            <div class="soc-fill" :style="{ width: (soc ?? 0) + '%', background: socColor }" />
          </div>
          <div class="live-row"><span>容量 / 功率</span><b>{{ device.params.capacityKwh }}kWh / {{ device.params.powerKw }}kW</b></div>
        </template>
        <div v-if="isFaulted(device)" class="fault-box">
          ⚠ {{ faultText }}
        </div>
      </div>

      <!-- 规划模式：编辑参数 -->
      <div v-if="mode === 'plan' && index != null" class="edit-form">
        <div class="form-title">容量参数编辑</div>
        <label v-for="f in editableFields" :key="f.key" class="form-row">
          <span>{{ f.label }}</span>
          <input
            v-if="f.type === 'number'"
            type="number"
            :value="device.params[f.key]"
            @input="updateParam(f.key, Number(($event.target as HTMLInputElement).value))"
          />
          <input v-else :value="device[f.key as keyof PlanDevice]" @input="updateField(f.key, ($event.target as HTMLInputElement).value)" />
        </label>

        <div class="form-title">故障注入（用于回放推演）</div>
        <div class="fault-inject">
          <label>起 <input type="number" min="0" max="23" :value="device.injectedFault?.startHour ?? 0"
            @input="patchFault('startHour', Number(($event.target as HTMLInputElement).value))" /></label>
          <label>止 <input type="number" min="0" max="23" :value="device.injectedFault?.endHour ?? 0"
            @input="patchFault('endHour', Number(($event.target as HTMLInputElement).value))" /></label>
        </div>
        <input class="fault-msg" placeholder="故障描述，如：逆变器通讯中断"
          :value="device.injectedFault?.message ?? ''"
          @input="patchFault('message', ($event.target as HTMLInputElement).value)" />
        <div class="form-actions">
          <button class="btn danger" @click="$emit('remove', index)">
            {{ device.isNew ? '删除设备' : '从方案移除' }}
          </button>
        </div>
      </div>

      <!-- 管理员模式：实际设备故障操作 -->
      <div v-else-if="mode === 'operation' && device.id" class="manager-actions">
        <div class="form-title">运行操作</div>
        <button v-if="!isFaulted(device)" class="btn danger" @click="setFault(true)">
          置为故障（触发告警回放）
        </button>
        <button v-else class="btn primary" @click="setFault(false)">解除故障恢复运行</button>
        <input
          v-if="!isFaulted(device)"
          class="fault-msg"
          placeholder="故障描述，如：配电柜跳闸"
          v-model="faultDraft"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HourResult } from '../types';
import type { PlanDevice } from '../stores/grid';

const props = defineProps<{
  devices: PlanDevice[];
  device: PlanDevice | null;
  index: number | null;
  hourResult: HourResult | null;
  socByBattery: Record<string, number>;
  mode: 'operation' | 'plan';
  currentHour: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', d: PlanDevice, i: number): void;
  (e: 'remove', i: number): void;
  (e: 'update', i: number, patch: Partial<PlanDevice>): void;
  (e: 'setFault', id: number, fault: boolean, msg: string): void;
}>();

const faultDraft = ref('配电柜跳闸');

function icon(t: string) {
  return { pv: '🔆', battery: '🔋', charger: '🚗', building: '🏫' }[t] || '❔';
}
const typeText = computed(
  () => ({ pv: '光伏', battery: '储能', charger: '充电桩', building: '楼宇' }[props.device?.type ?? 'pv']),
);

function isFaulted(d: PlanDevice) {
  if (d.status === 'fault' && !d.injectedFault) return true;
  const f = d.injectedFault;
  return !!f && props.currentHour >= f.startHour && props.currentHour <= f.endHour;
}
const faultText = computed(() => {
  const d = props.device!;
  const f = d.injectedFault;
  return (f && props.currentHour >= f.startHour && props.currentHour <= f.endHour ? f.message : d.faultMessage) || '设备故障';
});

function spec(d: PlanDevice) {
  const p = d.params;
  if (d.type === 'pv') return `${p.capacityKw}kWp`;
  if (d.type === 'battery') return `${p.capacityKwh}kWh/${p.powerKw}kW`;
  if (d.type === 'charger') return `${p.count}×${p.powerKw}kW`;
  return `${p.baseLoadKw}kW 基载`;
}

// —— 实时值（按额定容量分摊聚合值） ——
function share(type: string, key: string, mulKey?: string) {
  const d = props.device!;
  const same = props.devices.filter((x) => x.type === type && !isFaulted(x));
  const val = (x: PlanDevice) => (x.params[key] || 0) * (mulKey ? x.params[mulKey] || 1 : 1);
  const total = same.reduce((s, x) => s + val(x), 0);
  return total ? val(d) / total : 0;
}
const livePv = computed(() => (props.hourResult?.pvKw ?? 0) * share('pv', 'capacityKw'));
const liveBuilding = computed(() => (props.hourResult?.buildingLoadKw ?? 0) * share('building', 'baseLoadKw'));
const liveCharger = computed(() => (props.hourResult?.chargerLoadKw ?? 0) * share('charger', 'powerKw', 'count'));

const soc = computed(() => (props.device ? props.socByBattery[props.device.name] : null));
const socColor = computed(() => {
  const s = soc.value ?? 0;
  if (s <= 15) return '#ff6b6b';
  if (s <= 35) return '#ffc02e';
  return '#36c2cf';
});

const batFlow = computed(() => {
  const h = props.hourResult;
  if (!h || isFaulted(props.device!)) return { text: '故障停机', cls: 'fault-text' };
  const s = share('battery', 'powerKw');
  if (h.batteryChargeKw > 0.01 && s > 0) return { text: `充电 ${(h.batteryChargeKw * s).toFixed(1)} kW`, cls: 'charge-text' };
  if (h.batteryDischargeKw > 0.01 && s > 0) return { text: `放电 ${(h.batteryDischargeKw * s).toFixed(1)} kW`, cls: 'discharge-text' };
  return { text: '待机', cls: '' };
});
const batFlowText = computed(() => batFlow.value.text);
const batFlowClass = computed(() => batFlow.value.cls);

// —— 编辑 ——
const FIELDS: Record<string, Array<{ key: string; label: string; type: string }>> = {
  pv: [{ key: 'capacityKw', label: '装机容量 (kWp)', type: 'number' }],
  battery: [
    { key: 'capacityKwh', label: '额定容量 (kWh)', type: 'number' },
    { key: 'powerKw', label: '额定功率 (kW)', type: 'number' },
    { key: 'initialSoc', label: '初始 SOC (%)', type: 'number' },
    { key: 'minSoc', label: 'SOC 下限 (%)', type: 'number' },
    { key: 'maxSoc', label: 'SOC 上限 (%)', type: 'number' },
  ],
  charger: [
    { key: 'count', label: '充电桩数量', type: 'number' },
    { key: 'powerKw', label: '单桩功率 (kW)', type: 'number' },
  ],
  building: [
    { key: 'baseLoadKw', label: '基础负载 (kW)', type: 'number' },
    { key: 'areaM2', label: '建筑面积 (㎡)', type: 'number' },
    { key: 'coolingFactor', label: '制冷敏感系数', type: 'number' },
  ],
};
const editableFields = computed(() => [
  { key: 'name', label: '设备名称', type: 'text' },
  ...(FIELDS[props.device?.type ?? 'pv'] || []),
]);

function updateParam(key: string, value: number) {
  if (props.index == null) return;
  emit('update', props.index, { params: { ...props.device!.params, [key]: value } });
}
function updateField(key: string, value: string) {
  if (props.index == null) return;
  emit('update', props.index, { [key]: value } as any);
}
function patchFault(key: string, value: any) {
  if (props.index == null) return;
  const cur = props.device!.injectedFault ?? { startHour: 0, endHour: 2, message: '设备故障' };
  emit('update', props.index, { injectedFault: { ...cur, [key]: value } });
}

function setFault(fault: boolean) {
  if (props.device?.id) emit('setFault', props.device.id, fault, faultDraft.value);
}
</script>

<style scoped>
.device-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
}
.name {
  margin-left: 8px;
  font-size: 14px;
}
.close {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 20px;
}
.device-list {
  overflow-y: auto;
  flex: 1;
  padding: 6px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.list-row:hover {
  background: var(--panel-2);
}
.list-row.fault .row-name {
  color: #ff8a8a;
}
.ico {
  font-size: 16px;
}
.row-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-spec {
  color: #5f7397;
  font-size: 11.5px;
}
.no-data {
  color: #5f7397;
  text-align: center;
  margin-top: 30px;
  font-size: 12.5px;
}
.detail {
  padding: 12px 14px;
  overflow-y: auto;
  flex: 1;
}
.live-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed #20304b;
}
.live-row span {
  color: var(--text-dim);
}
.live-row b.pv { color: var(--pv); }
.live-row b.charger { color: var(--charger); }
.charge-text { color: #7dd8e3; }
.discharge-text { color: #36c2cf; }
.fault-text { color: var(--critical); }
.soc-bar {
  height: 8px;
  background: #16223a;
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0 4px;
}
.soc-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}
.fault-box {
  margin-top: 10px;
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.35);
  color: #ff9b9b;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}
.form-title {
  margin: 16px 0 8px;
  color: #8db8ef;
  font-size: 12.5px;
  font-weight: 600;
}
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
  font-size: 12.5px;
  color: var(--text-dim);
}
.form-row input {
  width: 130px;
}
.fault-inject {
  display: flex;
  gap: 10px;
}
.fault-inject label {
  flex: 1;
  font-size: 12px;
  color: var(--text-dim);
}
.fault-inject input {
  width: 100%;
  margin-top: 3px;
}
.fault-msg {
  width: 100%;
  margin-top: 8px;
}
.form-actions {
  margin-top: 12px;
}
.manager-actions .fault-msg {
  margin: 10px 0;
}
</style>
