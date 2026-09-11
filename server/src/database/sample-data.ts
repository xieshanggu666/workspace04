import { defaultProfile, defaultChargerProfile } from '../simulation/engine';
import { generateWeather } from '../weather/weather.controller';

/** 校园逐时负载曲线模板（归一化） */
const dormProfile = [
  0.7, 0.6, 0.55, 0.5, 0.5, 0.55, 0.65, 0.7, 0.6, 0.55, 0.5, 0.55,
  0.6, 0.6, 0.65, 0.7, 0.8, 0.95, 1.05, 1.1, 1.0, 0.9, 0.8, 0.75,
];
const labProfile = [
  0.6, 0.6, 0.6, 0.6, 0.62, 0.7, 0.85, 0.95, 1.0, 1.02, 1.0, 0.95,
  0.9, 0.95, 1.0, 1.02, 1.0, 0.95, 0.9, 0.85, 0.8, 0.72, 0.65, 0.6,
];

export function sampleDevices() {
  return [
    // —— 楼宇负载 ——
    {
      type: 'building' as const,
      name: '教学楼群',
      x: 220,
      y: 300,
      params: { areaM2: 42000, baseLoadKw: 420, coolingFactor: 0.12, profile: defaultProfile() },
    },
    {
      type: 'building' as const,
      name: '图书馆',
      x: 500,
      y: 220,
      params: { areaM2: 18000, baseLoadKw: 170, coolingFactor: 0.1, profile: defaultProfile() },
    },
    {
      type: 'building' as const,
      name: '实验楼',
      x: 760,
      y: 300,
      params: { areaM2: 26000, baseLoadKw: 280, coolingFactor: 0.14, profile: labProfile },
    },
    {
      type: 'building' as const,
      name: '学生宿舍群',
      x: 260,
      y: 520,
      params: { areaM2: 55000, baseLoadKw: 330, coolingFactor: 0.08, profile: dormProfile },
    },
    {
      type: 'building' as const,
      name: '行政楼',
      x: 700,
      y: 540,
      params: { areaM2: 12000, baseLoadKw: 110, coolingFactor: 0.12, profile: defaultProfile() },
    },
    // —— 屋顶光伏 ——
    {
      type: 'pv' as const,
      name: '教学楼屋顶光伏',
      x: 220,
      y: 235,
      params: { capacityKw: 500, tilt: 25, azimuth: 180 },
    },
    {
      type: 'pv' as const,
      name: '图书馆屋顶光伏',
      x: 500,
      y: 160,
      params: { capacityKw: 260, tilt: 25, azimuth: 180 },
    },
    {
      type: 'pv' as const,
      name: '体育馆光伏车棚',
      x: 890,
      y: 140,
      params: { capacityKw: 300, tilt: 15, azimuth: 180 },
    },
    // —— 储能 ——
    {
      type: 'battery' as const,
      name: '校园储能电站A',
      x: 500,
      y: 430,
      params: {
        capacityKwh: 1500,
        powerKw: 400,
        eff: 0.92,
        minSoc: 10,
        maxSoc: 90,
        initialSoc: 55,
      },
    },
    // —— 充电桩 ——
    {
      type: 'charger' as const,
      name: '东门快充站',
      x: 900,
      y: 430,
      params: { powerKw: 120, count: 8, profile: defaultChargerProfile() },
    },
    {
      type: 'charger' as const,
      name: '南门慢充站',
      x: 480,
      y: 640,
      params: { powerKw: 60, count: 10, profile: defaultChargerProfile() },
    },
  ];
}

export function sampleTariff() {
  return {
    name: '校园工商业分时电价',
    periods: [
      'valley', 'valley', 'valley', 'valley', 'valley', 'valley', 'valley',
      'valley', 'flat', 'flat', 'peak', 'peak', 'peak', 'flat', 'flat',
      'flat', 'flat', 'peak', 'peak', 'peak', 'peak', 'peak', 'flat', 'flat',
    ] as Array<'valley' | 'flat' | 'peak'>,
    valleyPrice: 0.35,
    flatPrice: 0.75,
    peakPrice: 1.25,
    sellPrice: 0.38,
    demandCharge: 40,
  };
}

export function sampleWeather() {
  return [
    generateWeather('2026-09-08', 'sunny'),
    generateWeather('2026-09-09', 'cloudy'),
    generateWeather('2026-09-10', 'hot'),
  ];
}

export function sampleUsers() {
  return [
    { username: 'manager', password: 'manager123', displayName: '李运维（能源管理员）', role: 'manager' as const },
    { username: 'planner', password: 'planner123', displayName: '王规划（规划师）', role: 'planner' as const },
  ];
}

/** 规划师预置的容量方案（基于当前设备做新增/扩容） */
export function sampleScenarios() {
  return [
    {
      name: '当前运行基线',
      mode: 'baseline' as const,
      isDefault: true,
      config: { weatherDate: '2026-09-10' },
    },
    {
      name: '方案A：储能扩容调峰',
      mode: 'plan' as const,
      isDefault: false,
      config: {
        weatherDate: '2026-09-10',
        devices: [
          {
            type: 'battery' as const,
            name: '校园储能电站B（规划）',
            x: 560,
            y: 430,
            params: {
              capacityKwh: 2000,
              powerKw: 500,
              eff: 0.92,
              minSoc: 10,
              maxSoc: 90,
              initialSoc: 50,
            },
          },
        ],
      },
    },
    {
      name: '方案B：光伏翻倍+储能',
      mode: 'plan' as const,
      isDefault: false,
      config: {
        weatherDate: '2026-09-10',
        devices: [
          {
            type: 'pv' as const,
            name: '宿舍区二期光伏（规划）',
            x: 260,
            y: 460,
            params: { capacityKw: 600 },
          },
          {
            type: 'pv' as const,
            name: '实验楼屋顶光伏（规划）',
            x: 760,
            y: 240,
            params: { capacityKw: 350 },
          },
          {
            type: 'battery' as const,
            name: '校园储能电站B（规划）',
            x: 560,
            y: 430,
            params: {
              capacityKwh: 1200,
              powerKw: 350,
              eff: 0.92,
              minSoc: 10,
              maxSoc: 90,
              initialSoc: 50,
            },
          },
        ],
      },
    },
    {
      name: '方案C：光储柔充一体化',
      mode: 'plan' as const,
      isDefault: false,
      config: {
        weatherDate: '2026-09-10',
        devices: [
          {
            type: 'pv' as const,
            name: '宿舍区二期光伏（规划）',
            x: 260,
            y: 460,
            params: { capacityKw: 600 },
          },
          {
            type: 'battery' as const,
            name: '东门光储一体柜（规划）',
            x: 840,
            y: 430,
            params: {
              capacityKwh: 800,
              powerKw: 300,
              eff: 0.92,
              minSoc: 10,
              maxSoc: 90,
              initialSoc: 50,
            },
          },
          {
            type: 'charger' as const,
            name: '东门快充站（扩容）',
            x: 900,
            y: 430,
            params: { powerKw: 120, count: 14 },
          },
        ],
      },
    },
  ];
}
