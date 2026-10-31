<template>
  <Workbench />
</template>

<script setup lang="ts">
/**
 * /home 工作台（OSC-26082815a1）。/Admin/Index 仍走 DefaultHome 监控页。
 */
import Workbench from './Workbench.vue';

defineOptions({ name: 'Home' });
</script>

<style scoped>
.home-page {
  padding: 0 16px 16px;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.banner-title {
  margin: 0;
  font-size: 22px;
}

.banner-sub {
  margin: 4px 0 0;
  color: var(--color-text-3);
  font-size: 13px;
}

.banner-alert {
  margin-bottom: 16px;
}

.kpis,
.widgets {
  margin-bottom: 16px;
}

.kpi {
  cursor: default;
  border-left: 3px solid #165dff;
}

.kpi-label {
  color: var(--color-text-3);
  font-size: 13px;
}

.kpi-value {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 600;
}

.kpi-trend {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}

.kpi-green {
  border-left-color: #00b42a;
}

.kpi-cyan {
  border-left-color: #0fc6c2;
}

.kpi-orange {
  border-left-color: #ff7d00;
}

.kpi-red {
  border-left-color: #f53f3f;
}

.kpi-purple {
  border-left-color: #722ed1;
}

.kpi-grey {
  border-left-color: #86909c;
}

.monitor-chart {
  width: 100%;
  height: 120px;
}

.line-cpu,
.line-mem {
  fill: none;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.line-cpu {
  stroke: #165dff;
}

.line-mem {
  stroke: #00b42a;
}

.monitor-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-3);
}

.legend-cpu::before,
.legend-mem::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 4px;
}

.legend-cpu::before {
  background: #165dff;
}

.legend-mem::before {
  background: #00b42a;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.profile-name {
  font-weight: 600;
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  text-decoration: none;
  color: rgb(var(--primary-6));
}

.loginlog {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.loginlog h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-text-3);
}

.loginlog ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.loginlog li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--color-border);
}

.loginlog .muted {
  color: var(--color-text-3);
}

.text {
  margin: 0;
  font-size: 13px;
}

.empty {
  padding: 32px 0;
}

.hidden-widgets {
  margin-bottom: 16px;
}
.hidden-title {
  margin-bottom: 8px;
  color: var(--text-secondary, #666);
  font-size: 13px;
}
.hidden-tag {
  cursor: pointer;
}
.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
