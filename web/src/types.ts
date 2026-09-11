export type DeviceType = 'pv' | 'battery' | 'charger' | 'building';

export interface Device {
  id: number;
  type: DeviceType;
  name: string;
  x: number;
  y: number;
  params: Record<string, any>;
  status: 'normal' | 'fault';
  faultMessage: string;
}

export interface WeatherDay {
  id: number;
  date: string;
  label: string;
  irradiance: number[];
  temperature: number[];
  cloudCover: number[];
}

export interface Tariff {
  id?: number;
  name: string;
  periods: Array<'valley' | 'flat' | 'peak'>;
  valleyPrice: number;
  flatPrice: number;
  peakPrice: number;
  sellPrice: number;
  demandCharge: number;
}

export interface HourResult {
  hour: number;
  period: 'valley' | 'flat' | 'peak';
  price: number;
  irradiance: number;
  temperature: number;
  cloudCover: number;
  pvKw: number;
  buildingLoadKw: number;
  chargerLoadKw: number;
  loadKw: number;
  netBeforeStorageKw: number;
  batteryChargeKw: number;
  batteryDischargeKw: number;
  batterySoc: number[];
  batteryEnergyKwh: number[];
  gridImportKw: number;
  gridExportKw: number;
  importEnergyKwh: number;
  exportEnergyKwh: number;
  energyCostYuan: number;
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
  renewableSelfConsumptionRate: number;
  renewableCoverageRate: number;
  energyCostYuan: number;
  demandCostYuan: number;
  totalCostYuan: number;
  batteryThroughputKwh: number;
  batteryMaxChargeKw: number;
  batteryMaxDischargeKw: number;
}

export interface AlarmEvent {
  id?: number;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  deviceName: string;
  message: string;
  hour: number;
  scenario?: string;
  status?: 'active' | 'acknowledged' | 'resolved';
}

export interface SimulationResult {
  date: string;
  hours: HourResult[];
  kpi: Kpi;
  alarms: AlarmEvent[];
}

export interface Scenario {
  id: number;
  name: string;
  mode: 'baseline' | 'plan';
  isDefault: boolean;
  config: Record<string, any>;
}
