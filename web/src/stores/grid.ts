import { defineStore } from 'pinia';
import { api } from '../api';
import {
  AlarmEvent,
  Device,
  HourResult,
  Kpi,
  Scenario,
  WeatherDay,
} from '../types';

export interface PlanDevice {
  id?: number; // 有 id=基于实际设备修改，无 id=规划新增
  type: Device['type'];
  name: string;
  x: number;
  y: number;
  params: Record<string, any>;
  status?: 'normal' | 'fault';
  faultMessage?: string;
  /** 方案内临时故障注入 */
  injectedFault?: { startHour: number; endHour: number; message?: string };
  isNew?: boolean;
  removed?: boolean;
}

type Mode = 'operation' | 'plan';

interface GridState {
  loading: boolean;
  mode: Mode;
  devices: Device[];
  planDevices: PlanDevice[];
  weatherDays: WeatherDay[];
  weatherDate: string;
  scenarios: Scenario[];
  selectedScenarioId: number | null;

  scenarioName: string;
  hours: HourResult[];
  kpi: Kpi | null;
  alarms: AlarmEvent[];
  currentHour: number;
  playing: boolean;

  compareItems: Array<{ name: string; kpi: Kpi; delta: any }>;

  alarmsList: AlarmEvent[];
  toast: string;
}

const DEFAULT_PARAMS: Record<Device['type'], Record<string, any>> = {
  pv: { capacityKw: 300 },
  battery: { capacityKwh: 1000, powerKw: 300, minSoc: 10, maxSoc: 90, initialSoc: 50, eff: 0.92 },
  charger: { powerKw: 60, count: 8 },
  building: { areaM2: 10000, baseLoadKw: 200, coolingFactor: 0.12 },
};

export const useGridStore = defineStore('grid', {
  state: (): GridState => ({
    loading: false,
    mode: (localStorage.getItem('mg_mode') as Mode) || 'operation',
    devices: [],
    planDevices: [],
    weatherDays: [],
    weatherDate: '',
    scenarios: [],
    selectedScenarioId: null,
    scenarioName: '',
    hours: [],
    kpi: null,
    alarms: [],
    currentHour: 12,
    playing: false,
    compareItems: [],
    alarmsList: [],
    toast: '',
  }),

  getters: {
    currentHourResult(state): HourResult | null {
      return state.hours[state.currentHour] ?? null;
    },
    visibleDevices(state): PlanDevice[] {
      if (state.mode === 'plan') return state.planDevices.filter((d) => !d.removed);
      return state.devices.map((d) => ({ ...d, params: { ...d.params } }));
    },
    batteryDevices(state): PlanDevice[] {
      return (state.mode === 'plan' ? state.planDevices.filter((d) => !d.removed) : state.devices).filter(
        (d) => d.type === 'battery',
      );
    },
    activeAlarmAtHour(state): AlarmEvent[] {
      return state.alarms
        .filter((a) => a.hour === state.currentHour)
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    },
  },

  actions: {
    showToast(msg: string) {
      this.toast = msg;
      setTimeout(() => (this.toast = ''), 3000);
    },

    setMode(mode: Mode) {
      this.mode = mode;
      localStorage.setItem('mg_mode', mode);
      this.playing = false;
      if (mode === 'plan' && this.planDevices.length === 0) {
        this.resetPlanFromBase();
      }
    },

    resetPlanFromBase() {
      this.planDevices = this.devices.map((d) => ({
        id: d.id,
        type: d.type,
        name: d.name,
        x: d.x,
        y: d.y,
        params: { ...d.params },
        status: d.status,
        faultMessage: d.faultMessage,
      }));
    },

    async loadAll() {
      const [devices, weather, scenarios] = await Promise.all([
        api.devices(),
        api.weather(),
        api.scenarios(),
      ]);
      this.devices = devices;
      this.weatherDays = weather;
      this.weatherDate = weather[0]?.date ?? '';
      this.scenarios = scenarios;
      this.resetPlanFromBase();
    },

    async loadAlarms() {
      this.alarmsList = await api.alarms(this.weatherDate || undefined);
    },

    setHour(h: number) {
      this.currentHour = Math.max(0, Math.min(23, h));
    },

    togglePlay() {
      this.playing = !this.playing;
    },

    // —— 设备编辑（规划画布，不落库）——
    addPlanDevice(type: Device['type']) {
      const nameMap = { pv: '新增光伏', battery: '新增储能', charger: '新增充电桩', building: '新增楼宇' };
      const count = this.planDevices.filter((d) => d.type === type && d.isNew).length + 1;
      this.planDevices.push({
        type,
        name: `${nameMap[type]}${count}`,
        x: 120 + Math.round(Math.random() * 600),
        y: 120 + Math.round(Math.random() * 380),
        params: { ...DEFAULT_PARAMS[type] },
        status: 'normal',
        isNew: true,
      });
    },

    updatePlanDevice(index: number, patch: Partial<PlanDevice>) {
      this.planDevices[index] = { ...this.planDevices[index], ...patch };
    },

    removePlanDevice(index: number) {
      const d = this.planDevices[index];
      if (d.isNew) this.planDevices.splice(index, 1);
      else this.planDevices[index] = { ...d, removed: true };
    },

    /** 把画布方案转为后端 ScenarioConfig */
    buildConfig() {
      const configDevices = this.planDevices.map((d) => {
        const item: any = {
          id: d.id,
          type: d.type,
          name: d.name,
          x: d.x,
          y: d.y,
          params: d.params,
        };
        if (d.removed) item.removed = true;
        if (d.injectedFault) item.injectedFault = d.injectedFault;
        return item;
      });
      return {
        weatherDate: this.weatherDate,
        devices: configDevices,
        removedDeviceIds: this.planDevices.filter((d) => d.removed).map((d) => d.id),
      };
    },

    applyScenario(scenario: Scenario) {
      this.selectedScenarioId = scenario.id;
      const cfg = scenario.config || {};
      // 用方案配置重建画布
      const overrides = new Map<number, any>((cfg.devices || []).filter((d: any) => d.id).map((d: any) => [d.id, d]));
      const added = (cfg.devices || []).filter((d: any) => d.id == null);
      const removed = new Set<number>(cfg.removedDeviceIds || (cfg.devices || []).filter((d: any) => d.removed).map((d: any) => d.id));
      this.planDevices = this.devices
        .filter((d) => !removed.has(d.id))
        .map((d) => {
          const ov = overrides.get(d.id);
          return ov
            ? {
                id: d.id,
                type: ov.type ?? d.type,
                name: ov.name ?? d.name,
                x: ov.x ?? d.x,
                y: ov.y ?? d.y,
                params: { ...d.params, ...(ov.params ?? {}) },
                status: d.status,
                injectedFault: ov.injectedFault,
              }
            : { id: d.id, type: d.type, name: d.name, x: d.x, y: d.y, params: { ...d.params }, status: d.status };
        });
      for (const a of added) {
        this.planDevices.push({
          type: a.type,
          name: a.name,
          x: a.x ?? 200,
          y: a.y ?? 200,
          params: { ...(a.params ?? {}) },
          status: 'normal',
          isNew: true,
          injectedFault: a.injectedFault,
        });
      }
      if (cfg.weatherDate) this.weatherDate = cfg.weatherDate;
    },

    /** 推演：根据当前模式选择基线（含缓存）或方案 */
    async simulate() {
      this.loading = true;
      try {
        if (this.mode === 'operation') {
          const res = await api.baseline(this.weatherDate);
          this.scenarioName = res.scenarioName;
          this.hours = res.result.hours;
          this.kpi = res.result.kpi;
          this.alarms = res.result.alarms;
        } else {
          const useSaved = this.selectedScenarioId;
          const body = useSaved
            ? { scenarioId: this.selectedScenarioId, weatherDate: this.weatherDate }
            : { config: this.buildConfig(), weatherDate: this.weatherDate, name: '未命名方案' };
          const res = await api.run(body);
          this.scenarioName = useSaved
            ? this.scenarios.find((s) => s.id === useSaved)?.name ?? '方案'
            : '画布方案（未保存）';
          this.hours = res.result.hours;
          this.kpi = res.result.kpi;
          this.alarms = res.result.alarms;
        }
        if (this.currentHour > 23) this.currentHour = 12;
      } finally {
        this.loading = false;
      }
    },

    /** 容量方案对比：基线 + 预置规划方案 + 当前画布 */
    async compareScenarios() {
      this.loading = true;
      try {
        const items: any[] = [{ name: '当前运行基线' }];
        for (const s of this.scenarios.filter((s) => s.mode === 'plan')) {
          items.push({ name: s.name, scenarioId: s.id });
        }
        items.push({ name: '当前画布方案', config: this.buildConfig() });
        const res = await api.compareScenarios({ items, weatherDate: this.weatherDate });
        this.compareItems = res.items.map((it: any) => ({ name: it.name, kpi: it.kpi, delta: it.delta }));
      } finally {
        this.loading = false;
      }
    },

    async saveScenario(name: string) {
      const saved = await api.saveScenario({ name, mode: 'plan', config: this.buildConfig() });
      this.scenarios = await api.scenarios();
      this.selectedScenarioId = saved.id;
      this.showToast(`方案「${name}」已保存`);
    },

    // —— 管理员：实际设备操作 ——
    async persistMoveDevice(id: number, x: number, y: number) {
      const updated = await api.moveDevice(id, x, y);
      const i = this.devices.findIndex((d) => d.id === id);
      if (i >= 0) this.devices[i] = updated;
    },

    async setDeviceFault(id: number, fault: boolean, message?: string) {
      const updated = await api.setDeviceStatus(id, fault ? 'fault' : 'normal', message);
      const i = this.devices.findIndex((d) => d.id === id);
      if (i >= 0) this.devices[i] = updated;
      await api.syncAlarms(this.weatherDate);
      await this.loadAlarms();
      this.showToast(fault ? `已设置故障：${updated.faultMessage}` : '故障已解除');
    },
  },
});

function severityRank(s: string) {
  return s === 'critical' ? 3 : s === 'warning' ? 2 : 1;
}
