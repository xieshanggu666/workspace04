import {
  AlarmEvent,
  HourResult,
  Kpi,
  SimDevice,
  SimulationInput,
  SimulationResult,
  TariffInput,
} from './types';

/** 单充/放效率（sqrt(0.92)≈0.959，往返效率约 92%） */
const ONE_WAY_EFF = 0.96;
const PV_TEMP_COEFF = -0.004; // 晶硅组件温度系数 -0.4%/℃
const PV_STC_TEMP = 25;

function isFaulted(d: SimDevice, hour: number): boolean {
  if (d.status === 'fault' && !d.injectedFault) return true;
  const f = d.injectedFault;
  if (f && hour >= f.startHour && hour <= f.endHour) return true;
  return false;
}

/**
 * 光伏出力：标准测试容量 × (辐照/1000) × 温度修正 × 云量波动
 * 云量 1 表示完全遮蔽，出力按 (1-0.85*cloud) 衰减，体现天气波动。
 */
export function pvOutputKw(d: SimDevice, hour: number, weather: SimulationInput['weather']): number {
  if (isFaulted(d, hour)) return 0;
  const cap = Number(d.params?.capacityKw ?? 0);
  const g = weather.irradiance[hour] ?? 0;
  const t = weather.temperature[hour] ?? 25;
  const cloud = weather.cloudCover[hour] ?? 0;
  if (g <= 0) return 0;
  const tempFactor = 1 + PV_TEMP_COEFF * (t - PV_STC_TEMP);
  const cloudFactor = 1 - 0.85 * Math.min(Math.max(cloud, 0), 1);
  return Math.max(0, cap * (g / 1000) * tempFactor * cloudFactor);
}

/**
 * 楼宇负载：基础逐时曲线 × 面积系数；
 * 高温（>26℃）产生制冷附加负荷；
 * 温度敏感系数 coolingFactor（kW/℃·比例）。
 */
export function buildingLoadKw(d: SimDevice, hour: number, temperature: number): number {
  if (isFaulted(d, hour)) return 0;
  const base = Number(d.params?.baseLoadKw ?? 0);
  const profile: number[] = d.params?.profile ?? defaultProfile();
  const factor = profile[hour] ?? 1;
  const coolingFactor = Number(d.params?.coolingFactor ?? 0.12);
  const cooling = Math.max(0, temperature - 26) * coolingFactor * base;
  return base * factor + cooling;
}

/** 校内常见教学楼/办公/宿舍混合的归一化逐时占用曲线 */
export function defaultProfile(): number[] {
  return [
    0.55, 0.5, 0.48, 0.47, 0.5, 0.6, 0.8, 0.95, 1.0, 0.98, 0.9, 0.85,
    0.8, 0.82, 0.9, 0.98, 1.0, 1.05, 1.0, 0.9, 0.78, 0.7, 0.62, 0.58,
  ];
}

/**
 * 充电桩请求功率：单桩功率 × 车桩比曲线 × 桩数。
 * profile 为每小时每桩平均利用率（0-1），晚高峰 17-21 点最高。
 */
export function chargerLoadKw(d: SimDevice, hour: number): number {
  if (isFaulted(d, hour)) return 0;
  const power = Number(d.params?.powerKw ?? 0);
  const count = Number(d.params?.count ?? 1);
  const profile: number[] = d.params?.profile ?? defaultChargerProfile();
  return power * count * (profile[hour] ?? 0);
}

export function defaultChargerProfile(): number[] {
  return [
    0.1, 0.05, 0.05, 0.05, 0.08, 0.15, 0.3, 0.45, 0.5, 0.4, 0.35, 0.4,
    0.5, 0.45, 0.4, 0.5, 0.65, 0.8, 0.9, 0.85, 0.7, 0.5, 0.3, 0.15,
  ];
}

function tariffAt(t: TariffInput, hour: number) {
  const period = t.periods[hour] ?? 'flat';
  const price =
    period === 'valley' ? t.valleyPrice : period === 'peak' ? t.peakPrice : t.flatPrice;
  return { period, price };
}

interface BatteryRuntime {
  d: SimDevice;
  energy: number;
  capacity: number;
  power: number;
  minEnergy: number;
  maxEnergy: number;
  chargeKw: number;
  dischargeKw: number;
}

function makeBatteries(devices: SimDevice[]): BatteryRuntime[] {
  return devices
    .filter((d) => d.type === 'battery')
    .map((d) => {
      const capacity = Number(d.params?.capacityKwh ?? 0);
      const initialSoc = Number(d.params?.initialSoc ?? 50) / 100;
      return {
        d,
        energy: capacity * initialSoc,
        capacity,
        power: Number(d.params?.powerKw ?? 0),
        minEnergy: capacity * (Number(d.params?.minSoc ?? 10) / 100),
        maxEnergy: capacity * (Number(d.params?.maxSoc ?? 90) / 100),
        chargeKw: 0,
        dischargeKw: 0,
      };
    });
}

/**
 * 逐时调度策略（1h 步长，功率≈电量）：
 *  - 峰时段：电池优先放电覆盖净负荷，减少高价购电与最大需量；
 *  - 平/峰时段净缺口超过需量阈值时放电削峰（降低变压器最大需量）；
 *  - 谷时段：电池以不越限功率充电（光伏余电或低价电网电）；
 *  - 平时段（未越需量）：仅光伏余电充电池；不主动从电网充电套利；
 *  - 电池任意一小时要么充、要么放、要么闲置，充放功率至少一个为 0；
 *  - 仅余电（光伏经电池消纳后仍有剩余）允许上网。
 * 返回该小时电池充/放聚合功率（均为正数）。
 */
const DEMAND_SHAVE_KW = 800; // 需量控制目标：并网购电不超过 800kW 的削峰线

function dispatchBatteries(
  bats: BatteryRuntime[],
  hour: number,
  period: 'valley' | 'flat' | 'peak',
  surplusKw: number, // 光伏 > 负载 的余电量（>0 才有）
  deficitKw: number, // 负载 > 光伏 的缺口（>0 才有）
): { charge: number; discharge: number } {
  let charge = 0;
  let discharge = 0;

  // 削峰目标：峰段尽量覆盖缺口；平段只在超需量线时放电
  const dischargeTarget =
    period === 'peak' ? deficitKw : Math.max(0, deficitKw - DEMAND_SHAVE_KW);

  for (const b of bats) {
    b.chargeKw = 0;
    b.dischargeKw = 0;
    if (isFaulted(b.d, hour)) continue;

    if (period !== 'valley' && dischargeTarget - discharge > 0.01) {
      // 受功率、剩余可用电量（放电效率折算）约束
      const energyAvail = Math.max(0, b.energy - b.minEnergy) * ONE_WAY_EFF;
      const want = Math.min(b.power, dischargeTarget - discharge, energyAvail);
      if (want > 0.01) {
        b.dischargeKw = want;
        b.energy -= want / ONE_WAY_EFF;
        discharge += want;
      }
    } else if (period === 'valley' || (surplusKw - charge > 0.01)) {
      // 谷时充满；平时仅用光伏余电充
      let want: number;
      if (period === 'valley') {
        want = b.power;
      } else {
        want = Math.min(b.power, surplusKw - charge);
      }
      // 受可接纳电量约束（计入充电效率）
      const headroom = (b.maxEnergy - b.energy) / ONE_WAY_EFF;
      want = Math.min(want, headroom);
      if (want > 0.01) {
        b.chargeKw = want;
        b.energy += want * ONE_WAY_EFF;
        charge += want;
      }
    }
  }
  return { charge, discharge };
}

export function simulate(input: SimulationInput): SimulationResult {
  const { devices, weather, tariff } = input;
  const pvs = devices.filter((d) => d.type === 'pv');
  const buildings = devices.filter((d) => d.type === 'building');
  const chargers = devices.filter((d) => d.type === 'charger');
  const bats = makeBatteries(devices);

  const hours: HourResult[] = [];
  const alarms: AlarmEvent[] = [];

  let pvTotal = 0;
  let buildingTotal = 0;
  let chargerTotal = 0;
  let importTotal = 0;
  let exportTotal = 0;
  let directPvUsed = 0;
  let pvUsedByBattery = 0;
  let costTotal = 0;
  let peakImport = 0;
  let throughput = 0;
  let maxCharge = 0;
  let maxDischarge = 0;

  const alarmedDevice = new Set<string>();

  for (let hour = 0; hour < 24; hour++) {
    const { period, price } = tariffAt(tariff, hour);
    const temp = weather.temperature[hour] ?? 25;
    const cloud = weather.cloudCover[hour] ?? 0;
    const irradiance = weather.irradiance[hour] ?? 0;

    const activeFaults: string[] = [];
    for (const d of devices) {
      if (!isFaulted(d, hour)) continue;
      activeFaults.push(d.name);
      const f = d.injectedFault;
      const startHour = d.status === 'fault' && !f ? 0 : f?.startHour ?? hour;
      const dedupKey = d.id ? `dev-${d.id}` : `tmp-${d.name}`;
      if (hour === startHour && !alarmedDevice.has(dedupKey)) {
        alarms.push({
          severity: 'critical',
          category: '设备故障',
          deviceName: d.name,
          message: f?.message || d.faultMessage || `${d.name} 故障退出运行`,
          hour,
        });
        alarmedDevice.add(dedupKey);
      }
    }

    const pvKw = round(pvs.reduce((s, d) => s + pvOutputKw(d, hour, weather), 0));
    const buildingKw = round(
      buildings.reduce((s, d) => s + buildingLoadKw(d, hour, temp), 0),
    );
    const chargerKw = round(
      chargers.reduce((s, d) => s + chargerLoadKw(d, hour), 0),
    );
    const loadKw = round(buildingKw + chargerKw);

    const netBefore = round(loadKw - pvKw); // >0 缺口，<0 余电
    const surplusKw = Math.max(0, -netBefore);
    const deficitKw = Math.max(0, netBefore);

    const { charge: batCharge, discharge: batDischarge } = dispatchBatteries(
      bats,
      hour,
      period,
      surplusKw,
      deficitKw,
    );

    // 电池与功率平衡。充/放互斥（同一电池，同一时刻）；聚合层面也成立，
    // 因为峰时只放、谷时只充、平时只用余电充（有余电即无缺口）。
    const residual = round(loadKw + batCharge - batDischarge - pvKw);
    const gridImportKw = round(Math.max(0, residual));
    const gridExportKw = round(Math.max(0, -residual));

    const importEnergy = gridImportKw; // 1h
    const exportEnergy = gridExportKw;
    const energyCost = round(
      importEnergy * price - exportEnergy * tariff.sellPrice,
    );

    // 统计光伏去向：直供负载 / 经储能消纳 / 上网
    directPvUsed += Math.min(pvKw, loadKw);
    if (batCharge > 0 && surplusKw > 0) {
      pvUsedByBattery += Math.min(batCharge, surplusKw);
    }

    pvTotal += pvKw;
    buildingTotal += buildingKw;
    chargerTotal += chargerKw;
    importTotal += importEnergy;
    exportTotal += exportEnergy;
    costTotal += energyCost;
    peakImport = Math.max(peakImport, gridImportKw);
    throughput += batCharge + batDischarge;
    maxCharge = Math.max(maxCharge, batCharge);
    maxDischarge = Math.max(maxDischarge, batDischarge);

    // —— 运行告警（含天气波动引发的波动告警）——
    if (period === 'peak' && gridImportKw > 800) {
      alarms.push({
        severity: 'critical',
        category: '峰值越限',
        deviceName: '并网点',
        message: `${labelHour(hour)} 峰时段购电功率 ${gridImportKw.toFixed(0)}kW 超需量阈值 800kW`,
        hour,
      });
    } else if (period === 'peak' && gridImportKw > 600) {
      alarms.push({
        severity: 'warning',
        category: '高负载',
        deviceName: '并网点',
        message: `${labelHour(hour)} 峰时段购电功率 ${gridImportKw.toFixed(0)}kW 接近需量阈值`,
        hour,
      });
    }
    if (cloud >= 0.7 && irradiance > 100) {
      alarms.push({
        severity: 'info',
        category: '天气波动',
        deviceName: '光伏阵列',
        message: `${labelHour(hour)} 云量 ${(cloud * 100).toFixed(0)}%，光伏出力大幅波动`,
        hour,
      });
    }
    if (temp >= 35 && (hour === 0 || (weather.temperature[hour - 1] ?? temp) < 35)) {
      alarms.push({
        severity: 'warning',
        category: '高温',
        deviceName: '校园楼宇',
        message: `${labelHour(hour)} 气温升至 ${temp.toFixed(0)}℃ 以上，制冷负荷攀升`,
        hour,
      });
    }
    const lowBat = bats.find((b) => !isFaulted(b.d, hour) && b.energy <= b.minEnergy * 1.05);
    if (lowBat && period === 'peak') {
      alarms.push({
        severity: 'info',
        category: '储能低电量',
        deviceName: lowBat.d.name,
        message: `${labelHour(hour)} ${lowBat.d.name} SOC 接近下限，峰段调峰能力不足`,
        hour,
      });
    }

    hours.push({
      hour,
      period,
      price,
      irradiance,
      temperature: temp,
      cloudCover: cloud,
      pvKw,
      buildingLoadKw: buildingKw,
      chargerLoadKw: chargerKw,
      loadKw,
      netBeforeStorageKw: netBefore,
      batteryChargeKw: round(batCharge),
      batteryDischargeKw: round(batDischarge),
      batterySoc: bats.map((b) => round((b.energy / b.capacity) * 100)),
      batteryEnergyKwh: bats.map((b) => round(b.energy)),
      gridImportKw,
      gridExportKw,
      importEnergyKwh: importEnergy,
      exportEnergyKwh: exportEnergy,
      energyCostYuan: energyCost,
      activeFaults,
    });
  }

  const pvSelfConsumed = Math.min(pvTotal, directPvUsed + pvUsedByBattery);
  const loadEnergy = buildingTotal + chargerTotal;
  const energyCost = round(costTotal);
  const demandCost = round((peakImport * tariff.demandCharge) / 30);

  const kpi: Kpi = {
    pvGenerationKwh: round(pvTotal),
    buildingEnergyKwh: round(buildingTotal),
    chargerEnergyKwh: round(chargerTotal),
    loadEnergyKwh: round(loadEnergy),
    gridImportKwh: round(importTotal),
    gridExportKwh: round(exportTotal),
    peakImportKw: round(peakImport),
    renewableSelfConsumptionRate: round(pvTotal > 0 ? (pvSelfConsumed / pvTotal) * 100 : 0),
    renewableCoverageRate: round(loadEnergy > 0 ? (pvSelfConsumed / loadEnergy) * 100 : 0),
    energyCostYuan: energyCost,
    demandCostYuan: demandCost,
    totalCostYuan: round(energyCost + demandCost),
    batteryThroughputKwh: round(throughput),
    batteryMaxChargeKw: round(maxCharge),
    batteryMaxDischargeKw: round(maxDischarge),
  };

  return { date: input.date, hours, kpi, alarms };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function labelHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}
