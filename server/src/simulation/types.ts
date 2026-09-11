/** 仿真引擎输入输出类型定义 */

export interface BatteryState {
  kwh: number;
  soc: number;
}

export interface SimDevice {
  id?: number;
  type: 'pv' | 'battery' | 'charger' | 'building';
  name: string;
  x?: number;
  y?: number;
  status?: 'normal' | 'fault';
  faultMessage?: string;
  params: Record<string, any>;
  /** 方案内的临时故障时段（含起止小时），用于故障回放推演 */
  injectedFault?: { startHour: number; endHour: number; message?: string };
}

export interface WeatherInput {
  date: string;
  irradiance: number[]; // W/m2，长度 24
  temperature: number[]; // ℃，长度 24
  cloudCover: number[]; // 0-1，长度 24
}

export interface TariffInput {
  periods: ('valley' | 'flat' | 'peak')[]; // 长度 24
  valleyPrice: number;
  flatPrice: number;
  peakPrice: number;
  sellPrice: number;
  demandCharge: number; // 元/kW·月
}

export interface HourResult {
  hour: number;
  period: 'valley' | 'flat' | 'peak';
  price: number;
  irradiance: number; // W/m2
  temperature: number;
  cloudCover: number;

  pvKw: number; // 光伏出力
  buildingLoadKw: number; // 楼宇负载
  chargerLoadKw: number; // 充电桩负载
  loadKw: number; // 总负载 = 楼宇 + 充电桩
  netBeforeStorageKw: number; // 负载 - 光伏

  batteryChargeKw: number; // 电池充电功率（正）
  batteryDischargeKw: number; // 电池放电功率（正）—— 与充电严格互斥
  batterySoc: number[]; // 各电池荷电状态 %
  batteryEnergyKwh: number[]; // 各电池剩余电量

  gridImportKw: number; // 电网购电（正）
  gridExportKw: number; // 电网送电（正）
  importEnergyKwh: number;
  exportEnergyKwh: number;
  energyCostYuan: number; // 当小时电费（购电-售电）

  /** 本小时处于故障的设备名 */
  activeFaults: string[];
}

export interface Kpi {
  pvGenerationKwh: number;
  buildingEnergyKwh: number;
  chargerEnergyKwh: number;
  loadEnergyKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  peakImportKw: number;
  renewableSelfConsumptionRate: number; // 光伏自发自用率 %
  renewableCoverageRate: number; // 负载中可再生能源占比 %
  energyCostYuan: number; // 电量电费（日）
  demandCostYuan: number; // 基本电费（日，按月费/30 折算）
  totalCostYuan: number;
  batteryThroughputKwh: number;
  batteryMaxChargeKw: number;
  batteryMaxDischargeKw: number;
}

export interface AlarmEvent {
  severity: 'info' | 'warning' | 'critical';
  category: string;
  deviceName: string;
  message: string;
  hour: number;
}

export interface SimulationResult {
  date: string;
  hours: HourResult[];
  kpi: Kpi;
  alarms: AlarmEvent[];
}

export interface SimulationInput {
  date: string;
  devices: SimDevice[];
  weather: WeatherInput;
  tariff: TariffInput;
  scenarioName?: string;
}
