<template>
  <AppLayout>
    <div class="compare-page">
      <div class="head panel">
        <div>
          <h2>容量方案对比</h2>
          <p>在相同天气日下比较基线与各规划方案的经济性、峰值需量与可再生能源利用，辅助规划决策</p>
        </div>
        <div class="head-actions">
          <label>天气日：
            <select v-model="grid.weatherDate">
              <option v-for="w in grid.weatherDays" :key="w.date" :value="w.date">
                {{ w.date }} · {{ w.label }}
              </option>
            </select>
          </label>
          <button class="btn primary" :disabled="grid.loading" @click="grid.compareScenarios()">
            {{ grid.loading ? '计算中…' : '生成对比' }}
          </button>
        </div>
      </div>

      <div v-if="grid.compareItems.length" class="content">
        <!-- 指标表 -->
        <div class="panel table-panel">
          <table>
            <thead>
              <tr>
                <th class="sticky">方案</th>
                <th>日总费用</th>
                <th>相对基线</th>
                <th>峰值购电</th>
                <th>购电量</th>
                <th>上网电量</th>
                <th>光伏发电</th>
                <th>可再生供载比</th>
                <th>储能吞吐</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, i) in grid.compareItems" :key="i" :class="{ base: i === 0, best: bestIndex === i && i !== 0 }">
                <td class="sticky">
                  <span v-if="i === 0" class="rank-tag base-tag">基线</span>
                  <span v-else-if="bestIndex === i" class="rank-tag best-tag">最优</span>
                  {{ it.name }}
                </td>
                <td class="num cost">¥{{ it.kpi.totalCostYuan.toLocaleString() }}</td>
                <td class="num" :class="deltaClass(it.delta?.totalCostYuan)">
                  {{ deltaText(it.delta?.totalCostYuan, '元') }}
                </td>
                <td class="num" :class="{ danger: it.kpi.peakImportKw > 800, warn: it.kpi.peakImportKw > 600 && it.kpi.peakImportKw <= 800 }">
                  {{ it.kpi.peakImportKw }} kW
                </td>
                <td class="num">{{ it.kpi.gridImportKwh.toLocaleString() }} kWh</td>
                <td class="num">{{ it.kpi.gridExportKwh.toLocaleString() }} kWh</td>
                <td class="num pv">{{ it.kpi.pvGenerationKwh.toLocaleString() }} kWh</td>
                <td class="num">
                  <div class="rate-wrap">
                    <div class="rate-bar"><div :style="{ width: it.kpi.renewableCoverageRate + '%' }" /></div>
                    {{ it.kpi.renewableCoverageRate }}%
                  </div>
                </td>
                <td class="num">{{ it.kpi.batteryThroughputKwh.toLocaleString() }} kWh</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 图表对比 -->
        <div class="charts">
          <div class="panel chart-card">
            <div class="card-title">日总费用对比（元）</div>
            <div ref="costEl" class="echart" />
          </div>
          <div class="panel chart-card">
            <div class="card-title">峰值购电功率对比（kW，越低越省基本电费）</div>
            <div ref="peakEl" class="echart" />
          </div>
          <div class="panel chart-card wide">
            <div class="card-title">可再生能源供载比 / 自发自用率（%）</div>
            <div ref="greenEl" class="echart" />
          </div>
        </div>
      </div>

      <div v-else class="empty panel">
        <p>📊 点击右上角「生成对比」，比较当前基线与 {{ grid.scenarios.filter((s) => s.mode === 'plan').length }} 个预置规划方案及当前画布方案</p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import AppLayout from '../components/AppLayout.vue';
import { useGridStore } from '../stores/grid';

const grid = useGridStore();
const costEl = ref<HTMLElement>();
const peakEl = ref<HTMLElement>();
const greenEl = ref<HTMLElement>();
let charts: echarts.ECharts[] = [];

const bestIndex = computed(() => {
  if (!grid.compareItems.length) return -1;
  let best = 0;
  grid.compareItems.forEach((it, i) => {
    if (it.kpi.totalCostYuan < grid.compareItems[best].kpi.totalCostYuan) best = i;
  });
  return best;
});

function deltaClass(v?: number) {
  if (v == null || v === 0) return '';
  return v < 0 ? 'good' : 'bad';
}
function deltaText(v?: number, unit?: string) {
  if (v == null) return '—';
  if (v === 0) return '基准';
  return `${v > 0 ? '+' : ''}${v.toLocaleString()} ${unit ?? ''}`;
}

async function renderCharts() {
  await nextTick();
  charts.forEach((c) => c.dispose());
  charts = [];
  const items = grid.compareItems;
  const names = items.map((i) => i.name.replace(/（规划）|（规划扩容）/g, ''));
  const baseTextStyle = { color: '#8da0bd', fontSize: 11 };

  if (costEl.value) {
    const c = echarts.init(costEl.value);
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#18243a', borderColor: '#2c3e5e', textStyle: { color: '#e6edf7' } },
      grid: { left: 70, right: 20, top: 20, bottom: 60 },
      xAxis: { type: 'category', data: names, axisLabel: { ...baseTextStyle, interval: 0, rotate: 16 }, axisLine: { lineStyle: { color: '#2a3a58' } } },
      yAxis: { type: 'value', axisLabel: baseTextStyle, splitLine: { lineStyle: { color: '#1c2940' } } },
      series: [{
        type: 'bar',
        data: items.map((it, i) => ({
          value: Math.round(it.kpi.totalCostYuan),
          itemStyle: { color: i === bestIndex.value ? '#2ecc71' : i === 0 ? '#ff6b6b' : '#2b7de9' },
        })),
        barWidth: 42,
        label: { show: true, position: 'top', color: '#cfe0f7', fontSize: 11 },
      }],
    });
    charts.push(c);
  }
  if (peakEl.value) {
    const c = echarts.init(peakEl.value);
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#18243a', borderColor: '#2c3e5e', textStyle: { color: '#e6edf7' } },
      grid: { left: 70, right: 20, top: 20, bottom: 60 },
      xAxis: { type: 'category', data: names, axisLabel: { ...baseTextStyle, interval: 0, rotate: 16 }, axisLine: { lineStyle: { color: '#2a3a58' } } },
      yAxis: { type: 'value', axisLabel: baseTextStyle, splitLine: { lineStyle: { color: '#1c2940' } } },
      series: [
        {
          type: 'bar',
          data: items.map((it) => ({
            value: it.kpi.peakImportKw,
            itemStyle: { color: it.kpi.peakImportKw > 800 ? '#ff5252' : it.kpi.peakImportKw > 600 ? '#ffc02e' : '#36c2cf' },
          })),
          barWidth: 42,
          label: { show: true, position: 'top', color: '#cfe0f7', fontSize: 11 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#ff5252', type: 'dashed' },
            label: { color: '#ff8a8a', formatter: '需量阈值 800kW' },
            data: [{ yAxis: 800 }],
          },
        },
      ],
    });
    charts.push(c);
  }
  if (greenEl.value) {
    const c = echarts.init(greenEl.value);
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#18243a', borderColor: '#2c3e5e', textStyle: { color: '#e6edf7' } },
      legend: { data: ['可再生供载比', '光伏自发自用率'], textStyle: baseTextStyle, top: 0 },
      grid: { left: 56, right: 20, top: 36, bottom: 40 },
      xAxis: { type: 'category', data: names, axisLabel: { ...baseTextStyle, interval: 0, rotate: 12 }, axisLine: { lineStyle: { color: '#2a3a58' } } },
      yAxis: { type: 'value', max: 100, axisLabel: { ...baseTextStyle, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1c2940' } } },
      series: [
        { name: '可再生供载比', type: 'bar', data: items.map((it) => it.kpi.renewableCoverageRate), itemStyle: { color: '#2ecc71' }, barWidth: 30 },
        { name: '光伏自发自用率', type: 'bar', data: items.map((it) => it.kpi.renewableSelfConsumptionRate), itemStyle: { color: '#f5a623' }, barWidth: 30 },
      ],
    });
    charts.push(c);
  }
  window.addEventListener('resize', resizeCharts);
}

function resizeCharts() {
  charts.forEach((c) => c.resize());
}

watch(() => grid.compareItems, renderCharts);

onMounted(async () => {
  if (!grid.devices.length) await grid.loadAll();
  if (!grid.compareItems.length) await grid.compareScenarios();
  else renderCharts();
});
</script>

<style scoped>
.compare-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.head {
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
}
.head h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.head p {
  margin: 0;
  color: var(--text-dim);
  font-size: 12.5px;
}
.head-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}
.table-panel {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  color: var(--text-dim);
  font-weight: 500;
  font-size: 12px;
  background: var(--panel-2);
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
td.cost {
  color: #ffd166;
  font-weight: 700;
}
td.pv {
  color: var(--pv);
}
td.danger {
  color: var(--critical);
  font-weight: 700;
}
td.warn {
  color: var(--warning);
  font-weight: 700;
}
td.good {
  color: var(--green);
}
td.bad {
  color: var(--critical);
}
tr.base {
  background: rgba(255, 107, 107, 0.05);
}
tr.best {
  background: rgba(46, 204, 113, 0.07);
}
.rank-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-right: 6px;
}
.base-tag {
  background: rgba(255, 107, 107, 0.18);
  color: var(--grid);
}
.best-tag {
  background: rgba(46, 204, 113, 0.18);
  color: var(--green);
}
.rate-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}
.rate-bar {
  width: 70px;
  height: 6px;
  background: #16223a;
  border-radius: 3px;
  overflow: hidden;
}
.rate-bar div {
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #5ed3a3);
}
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.chart-card.wide {
  grid-column: 1 / -1;
}
.card-title {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-dim);
}
.echart {
  height: 260px;
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}
</style>
