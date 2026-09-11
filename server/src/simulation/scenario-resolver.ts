import { SimDevice } from './types';

export interface ScenarioConfig {
  devices?: Array<
    Partial<SimDevice> & { id?: number; removed?: boolean; name: string; type: SimDevice['type'] }
  >;
  removedDeviceIds?: number[];
  weatherDate?: string;
  tariffOverrides?: {
    periods?: ('valley' | 'flat' | 'peak')[];
    valleyPrice?: number;
    flatPrice?: number;
    peakPrice?: number;
    sellPrice?: number;
    demandCharge?: number;
  };
}

/**
 * 以当前实际设备为基线，叠加方案中的新增 / 修改 / 删除。
 * 方案内设备带 id 表示覆盖现有设备（参数、位置、临时故障注入），
 * 不带 id 表示规划新增的容量。
 */
export function resolveScenarioDevices(
  baseDevices: SimDevice[],
  config: ScenarioConfig | null | undefined,
): SimDevice[] {
  if (!config) return baseDevices.map((d) => ({ ...d, params: { ...d.params } }));

  const removed = new Set(config.removedDeviceIds ?? []);
  const overrideMap = new Map<number, any>();
  const added: any[] = [];

  for (const item of config.devices ?? []) {
    if (item.removed && item.id != null) removed.add(item.id);
    else if (item.id != null) overrideMap.set(item.id, item);
    else added.push(item);
  }

  const merged: SimDevice[] = [];
  for (const base of baseDevices) {
    if (removed.has(base.id!)) continue;
    const override = overrideMap.get(base.id!);
    if (!override) {
      merged.push({ ...base, params: { ...base.params } });
      continue;
    }
    merged.push({
      ...base,
      ...override,
      id: base.id,
      type: override.type ?? base.type,
      params: { ...base.params, ...(override.params ?? {}) },
      injectedFault: override.injectedFault,
    });
  }
  for (const a of added) {
    merged.push({ ...a, params: { ...(a.params ?? {}) } });
  }
  return merged;
}
