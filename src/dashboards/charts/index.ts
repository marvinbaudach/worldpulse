// The dashboard renderers, grouped by family. Each draws a complete panel
// (surface, header, chart) into a Frame; `t` replays the intro and drives the
// live motion afterwards, so hovering a panel feels like it wakes up.

export { type LineCfg, type AreaCfg, lineChart, areaChart } from './line';
export { type BarCfg, type HBarCfg, type WarLossesCfg, barChart, hBarChart, warLosses } from './bar';
export { type NukeMapCfg, type ChoroplethCfg, type TempMapCfg, type MideastCfg, type DataCenterMapCfg, nukeMap, choroplethMap, tempMap, mideastMap, dataCenterMap } from './map';
export {
  type WealthSplitCfg,
  type DebtClockCfg,
  type ForecastCfg,
  type TreemapCfg,
  type BudgetSplitCfg,
  type FactCheckCfg,
  wealthSplit,
  debtClock,
  weatherForecast,
  treemap,
  budgetSplit,
  factCheck,
} from './misc';
