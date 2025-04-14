import { IPriceLine } from "lightweight-charts";

import { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

export type TradeType = "perp" | "spot";
export type TradePlacement = "mark" | "limit";
export type TradeDirection = "Buy" | "Sell";
export type TradeSpecialAction = "takeP" | "stopL";
export type TradeDecorator = TradeDirection | TradeSpecialAction;
export type Trade = `${TradeType}${TradePlacement}${TradeDecorator}`;

export interface TradeLevel {
  id: string;
  type: Trade;
  active: boolean;
  quantity: number;
  IpriceLine: IPriceLine;
}

export interface TradeFlow {
  id: string;
  macro: string; // Keyboard shortcut
  trades: Trade[];
  presets: {
    takeP: number | null;
    stopL: number | null;
  };
  presetMode: {
    takeP: boolean;
    stopL: boolean;
  };
}

export interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartRefs {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  currentMinute: number;
  currentCandle: CandleData | null;
  candles: CandleData[];
}
