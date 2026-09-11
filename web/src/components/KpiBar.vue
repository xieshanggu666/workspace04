<template>
  <div class="kpi-panel">
    <div class="kpi-item">
      <div class="kpi-label">日总费用（电量+基本）</div>
      <div class="kpi-value cost">¥ {{ fmt(kpi.totalCostYuan) }}</div>
      <div class="kpi-sub">电量电费 ¥{{ fmt(kpi.energyCostYuan) }} · 基本电费 ¥{{ fmt(kpi.demandCostYuan) }}</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">峰值购电功率</div>
      <div class="kpi-value" :class="{ danger: kpi.peakImportKw > 800, warn: kpi.peakImportKw > 600 }">
        {{ fmt(kpi.peakImportKw) }} <small>kW</small>
      </div>
      <div class="kpi-sub">决定需量电费的最大负荷</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">光伏日发电量</div>
      <div class="kpi-value pv">{{ fmt(kpi.pvGenerationKwh) }} <small>kWh</small></div>
      <div class="kpi-sub">自发自用率 {{ kpi.renewableSelfConsumptionRate }}%</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">电网购电 / 上网</div>
      <div class="kpi-value">
        <span class="grid-in">{{ fmt(kpi.gridImportKwh) }}</span>
        <span class="sep">/</span>
        <span class="grid-out">{{ fmt(kpi.gridExportKwh) }}</span>
        <small>kWh</small>
      </div>
      <div class="kpi-sub">可再生能源供载比 {{ kpi.renewableCoverageRate }}%</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">储能日吞吐</div>
      <div class="kpi-value bat">{{ fmt(kpi.batteryThroughputKwh) }} <small>kWh</small></div>
      <div class="kpi-sub">最大充 {{ kpi.batteryMaxChargeKw }}kW · 放 {{ kpi.batteryMaxDischargeKw }}kW</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Kpi } from '../types';
defineProps<{ kpi: Kpi }>();
function fmt(v: number) {
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
</script>

<style scoped>
.kpi-panel {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.kpi-item {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
}
.kpi-label {
  color: var(--text-dim);
  font-size: 12px;
  margin-bottom: 6px;
}
.kpi-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}
.kpi-value small {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.kpi-value.cost { color: #ffd166; }
.kpi-value.pv { color: var(--pv); }
.kpi-value.bat { color: var(--battery); }
.kpi-value.danger { color: var(--critical); }
.kpi-value.warn { color: var(--warning); }
.grid-in { color: var(--grid); }
.grid-out { color: var(--valley); }
.sep { color: #4a5a78; margin: 0 3px; }
.kpi-sub {
  color: #5f7397;
  font-size: 11px;
  margin-top: 5px;
}
@media (max-width: 1500px) {
  .kpi-panel { grid-template-columns: repeat(3, 1fr); }
}
</style>
