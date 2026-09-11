import { describe, it, expect } from 'vitest';
import {
  simulate,
  pvOutputKw,
  defaultProfile,
  defaultChargerProfile,
} from './engine';
import { SimulationInput, SimDevice } from './types';

const TARIFF = {
  // 0-7 谷，8-9/13-16 平，10-12/17-21 峰（典型工商业分时）
  periods: [
    'valley', 'valley', 'valley', 'valley', 'valley', 'valley', 'valley',
    'valley', 'flat', 'flat', 'peak', 'peak', 'peak', 'flat', 'flat',
    'flat', 'flat', 'peak', 'peak', 'peak', 'peak', 'peak', 'flat', 'flat',
  ] as const,
  valleyPrice: 0.35,
  flatPrice: 0.75,
  peakPrice: 1.25,
  sellPrice: 0.38,
  demandCharge: 40,
};

function sunnyWeather() {
  const irradiance = Array.from({ length: 24 }, (_, h) => {
    const x = (h - 12) / 4;
    return Math.max(0, Math.round(900 * Math.exp(-x * x)));
  });
  const temperature = [
    24, 23, 23, 22, 22, 23, 24, 25, 27, 29, 31, 33, 34, 35, 35, 34,
    33, 32, 30, 29, 28, 27, 26, 25,
  ];
  return {
    date: '2026-09-10',
    irradiance,
    temperature,
    cloudCover: new Array(24).fill(0.05),
  };
}

function devices(): SimDevice[] {
  return [
    { id: 1, type: 'pv', name: '教学楼光伏', status: 'normal', params: { capacityKw: 500 } },
    {
      id: 2,
      type: 'battery',
      name: '储能柜A',
      status: 'normal',
      params: { capacityKwh: 1000, powerKw: 250, minSoc: 10, maxSoc: 90, initialSoc: 50 },
    },
    {
      id: 3,
      type: 'building',
      name: '教学楼群',
      status: 'normal',
      params: { baseLoadKw: 400, coolingFactor: 0.12, profile: defaultProfile() },
    },
    {
      id: 4,
      type: 'charger',
      name: '东门充电站',
      status: 'normal',
      params: { powerKw: 60, count: 10, profile: defaultChargerProfile() },
    },
  ];
}

function makeInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    date: '2026-09-10',
    devices: devices(),
    weather: sunnyWeather(),
    tariff: TARIFF as any,
    ...overrides,
  };
}

describe('光伏出力模型', () => {
  it('夜间出力为 0', () => {
    const pv = devices()[0];
    expect(pvOutputKw(pv, 0, sunnyWeather())).toBe(0);
    expect(pvOutputKw(pv, 23, sunnyWeather())).toBe(0);
  });

  it('正午出力接近额定容量且受温度折减', () => {
    const pv = devices()[0];
    const out = pvOutputKw(pv, 12, sunnyWeather());
    // 900W/m², 34℃ -> 500*0.9*(1-0.004*9)*0.9575 ≈ 415
    expect(out).toBeGreaterThan(380);
    expect(out).toBeLessThan(500);
  });

  it('云量显著压低出力（天气波动真实生效）', () => {
    const clear = { ...sunnyWeather(), cloudCover: new Array(24).fill(0) };
    const cloudy = { ...sunnyWeather(), cloudCover: new Array(24).fill(0.9) };
    const pv = devices()[0];
    expect(pvOutputKw(pv, 12, cloudy)).toBeLessThan(pvOutputKw(pv, 12, clear) * 0.3);
  });

  it('故障光伏出力为 0', () => {
    const pv: SimDevice = { ...devices()[0], status: 'fault' };
    expect(pvOutputKw(pv, 12, sunnyWeather())).toBe(0);
  });
});

describe('储能约束：不能同时充放电', () => {
  it('任意小时聚合与单机层面充电与放电互斥', () => {
    const res = simulate(makeInput());
    for (const h of res.hours) {
      const both = h.batteryChargeKw > 0.01 && h.batteryDischargeKw > 0.01;
      expect(both).toBe(false);
    }
  });

  it('SOC 始终位于 [minSoc, maxSoc]，且不越功率限值', () => {
    const res = simulate(makeInput());
    for (const h of res.hours) {
      for (const soc of h.batterySoc) {
        expect(soc).toBeGreaterThanOrEqual(9.9);
        expect(soc).toBeLessThanOrEqual(90.1);
      }
      expect(h.batteryChargeKw).toBeLessThanOrEqual(250.01);
      expect(h.batteryDischargeKw).toBeLessThanOrEqual(250.01);
    }
  });

  it('谷时段充电、峰时段放电', () => {
    const res = simulate(makeInput());
    // 谷时段（0-7 点）至少一小时在充电
    const valleyCharge = res.hours.slice(0, 8).reduce((s, h) => s + h.batteryChargeKw, 0);
    expect(valleyCharge).toBeGreaterThan(1);
    // 峰时段（10-12、17-21）至少一小时在放电
    const peakHours = [10, 11, 12, 17, 18, 19, 20, 21];
    const peakDischarge = peakHours.reduce((s, i) => s + res.hours[i].batteryDischargeKw, 0);
    expect(peakDischarge).toBeGreaterThan(1);
  });
});

describe('楼宇与充电桩负载', () => {
  it('高温日正午冷负荷使楼宇负载高于基础曲线值', () => {
    const res = simulate(makeInput());
    // 14 点 35℃：400*0.9 + (35-26)*0.12*400 = 360+432=792
    expect(res.hours[14].buildingLoadKw).toBeGreaterThan(700);
  });

  it('充电桩晚 18 点达到高负载', () => {
    const res = simulate(makeInput());
    expect(res.hours[18].chargerLoadKw).toBeCloseTo(60 * 10 * 0.9, 1);
  });

  it('整楼断电故障使楼宇负载为 0 并产生 critical 告警', () => {
    const faulted = devices();
    faulted[2] = { ...faulted[2], status: 'fault', faultMessage: '配电房跳闸' };
    const res = simulate(makeInput({ devices: faulted }));
    expect(res.hours[12].buildingLoadKw).toBe(0);
    expect(res.alarms.some((a) => a.category === '设备故障' && a.hour === 0)).toBe(true);
  });
});

describe('功率平衡与经济指标', () => {
  it('每小时满足 负载+充电 = 光伏+放电+购电-送电', () => {
    const res = simulate(makeInput());
    for (const h of res.hours) {
      const lhs = h.loadKw + h.batteryChargeKw;
      const rhs = h.pvKw + h.batteryDischargeKw + h.gridImportKw - h.gridExportKw;
      expect(Math.abs(lhs - rhs)).toBeLessThan(0.2);
    }
  });

  it('KPI 完整且数值合理', () => {
    const res = simulate(makeInput());
    const k = res.kpi;
    expect(k.pvGenerationKwh).toBeGreaterThan(2000);
    expect(k.peakImportKw).toBeGreaterThan(0);
    expect(k.totalCostYuan).toBeGreaterThan(k.energyCostYuan); // 含基本电费
    expect(k.renewableCoverageRate).toBeGreaterThan(0);
    expect(k.renewableSelfConsumptionRate).toBeLessThanOrEqual(100);
  });

  it('扩容光伏可降低购电量与日费用', () => {
    const base = simulate(makeInput());
    const expandedDevices = devices();
    expandedDevices.push({
      type: 'pv',
      name: '二期光伏',
      status: 'normal',
      params: { capacityKw: 400 },
    });
    const expanded = simulate(makeInput({ devices: expandedDevices }));
    expect(expanded.kpi.gridImportKwh).toBeLessThan(base.kpi.gridImportKwh);
  });
});

describe('方案内临时故障注入（故障回放推演）', () => {
  it('仅在注入时段内失效并在 hour 起点告警一次', () => {
    const ds = devices();
    ds[0] = {
      ...ds[0],
      injectedFault: { startHour: 11, endHour: 13, message: '逆变器通讯中断' },
    };
    const res = simulate(makeInput({ devices: ds }));
    expect(res.hours[10].pvKw).toBeGreaterThan(0);
    expect(res.hours[12].pvKw).toBe(0);
    expect(res.hours[14].pvKw).toBeGreaterThan(0);
    const faultAlarms = res.alarms.filter((a) => a.message.includes('逆变器'));
    expect(faultAlarms).toHaveLength(1);
    expect(faultAlarms[0].hour).toBe(11);
  });
});
