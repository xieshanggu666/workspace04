<template>
  <div ref="el" class="chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { HourResult } from '../types';

const props = defineProps<{
  hours: HourResult[];
  currentHour: number;
}>();

const emit = defineEmits<{ (e: 'seek', hour: number): void }>();

const el = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;

const hours24 = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

function periodColor(h: HourResult) {
  return h.period === 'peak' ? 'rgba(255,122,122,0.10)' : h.period === 'valley' ? 'rgba(94,211,163,0.08)' : 'transparent';
}

function render() {
  if (!chart || !props.hours.length) return;
  const h = props.hours;

  const areas = [] as any[];
  for (let i = 0; i < 24; i++) {
    areas.push({
      xAxis: hours24[i],
      areaStyle: { color: periodColor(h[i]) },
    });
  }

  chart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#18243a',
      borderColor: '#2c3e5e',
      textStyle: { color: '#e6edf7', fontSize: 12 },
    },
    legend: {
      data: ['光伏出力', '楼宇负载', '充电桩负载', '电池充电', '电池放电', '电网购电', '余电上网'],
      textStyle: { color: '#8da0bd', fontSize: 11 },
      top: 0,
      itemWidth: 14,
      itemHeight: 8,
    },
    grid: { left: 44, right: 16, top: 34, bottom: 26 },
    xAxis: {
      type: 'category',
      data: hours24,
      axisLabel: { color: '#6d82a3', fontSize: 10, interval: 1 },
      axisLine: { lineStyle: { color: '#2a3a58' } },
    },
    yAxis: {
      type: 'value',
      name: 'kW',
      nameTextStyle: { color: '#6d82a3' },
      axisLabel: { color: '#6d82a3', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1c2940' } },
    },
    series: [
      {
        name: '光伏出力',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: h.map((x) => x.pvKw),
        lineStyle: { color: '#f5a623', width: 2 },
        areaStyle: { color: 'rgba(245,166,35,0.15)' },
        markArea: { silent: true, itemStyle: { color: 'transparent' }, data: areas.map((a) => [{ xAxis: a.xAxis, itemStyle: { color: a.areaStyle.color } }, { xAxis: hours24[(hours24.indexOf(a.xAxis) + 1) % 24] }]) },
      },
      {
        name: '楼宇负载',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: h.map((x) => x.buildingLoadKw),
        lineStyle: { color: '#8fa6c8', width: 2 },
      },
      {
        name: '充电桩负载',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: h.map((x) => x.chargerLoadKw),
        lineStyle: { color: '#b06ef7', width: 2, type: 'dashed' },
      },
      {
        name: '电池充电',
        type: 'bar',
        stack: 'bat',
        data: h.map((x) => -x.batteryChargeKw),
        itemStyle: { color: 'rgba(54,194,207,0.55)' },
        barWidth: 8,
      },
      {
        name: '电池放电',
        type: 'bar',
        stack: 'bat',
        data: h.map((x) => x.batteryDischargeKw),
        itemStyle: { color: 'rgba(54,194,207,0.95)' },
        barWidth: 8,
      },
      {
        name: '电网购电',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: h.map((x) => x.gridImportKw),
        lineStyle: { color: '#ff6b6b', width: 2.5 },
      },
      {
        name: '余电上网',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: h.map((x) => -x.gridExportKw),
        lineStyle: { color: '#5ed3a3', width: 1.5, type: 'dotted' },
      },
      {
        type: 'line',
        name: '时间游标',
        markLine: {
          silent: false,
          symbol: 'none',
          lineStyle: { color: '#7db4ff', width: 2, type: 'solid' },
          label: { show: false },
          data: [{ xAxis: props.currentHour }],
        },
        data: [],
      },
    ],
  });
}

onMounted(() => {
  chart = echarts.init(el.value!);
  chart.on('click', (params: any) => {
    if (typeof params.dataIndex === 'number') emit('seek', params.dataIndex);
  });
  window.addEventListener('resize', resize);
  render();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
});

function resize() {
  chart?.resize();
}

watch(() => props.hours, render, { deep: false });
watch(() => props.currentHour, render);
</script>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
  min-height: 220px;
}
</style>
