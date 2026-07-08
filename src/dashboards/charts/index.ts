// The dashboard renderers, grouped by family. Each draws a complete panel
// (surface, header, chart) into a Frame; `t` replays the intro and drives the
// live motion afterwards, so hovering a panel feels like it wakes up.

export { type LineCfg, type AreaCfg, lineChart, areaChart } from './line';
export { type BarCfg, type HBarCfg, barChart, hBarChart } from './bar';
export { type NukeMapCfg, type ChoroplethCfg, type TempMapCfg, nukeMap, choroplethMap, tempMap } from './map';
export {
  type WealthSplitCfg,
  type TimelineCfg,
  type DebtClockCfg,
  type ForecastCfg,
  type TreemapCfg,
  wealthSplit,
  timelineChart,
  debtClock,
  weatherForecast,
  treemap,
} from './misc';
