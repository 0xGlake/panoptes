import { useRef, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ChartOptions,
  DeepPartial,
  SeriesOptionsCommon,
} from "lightweight-charts";

type ChartClickHandler = (param: { point?: { x: number; y: number } }) => void;

interface UseTradingChartOptions {
  onChartClick?: ChartClickHandler;
}

export const useTradingChart = (
  containerRef: React.RefObject<HTMLDivElement>,
  chartOptions: DeepPartial<ChartOptions>,
  seriesOptions: DeepPartial<SeriesOptionsCommon>,
  { onChartClick }: UseTradingChartOptions = {},
) => {
  // Refs for chart and series
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Initialize chart
  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    // Clean up previous chart if it exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    // Create new chart
    const chart = createChart(containerRef.current, chartOptions);
    const candleSeries = chart.addCandlestickSeries(seriesOptions);

    // Store references
    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // Subscribe to chart clicks if handler provided
    if (onChartClick) {
      chart.subscribeClick(onChartClick);
    }

    // Start with empty candles
    candleSeries.setData([]);

    // Auto-fit content initially
    chart.timeScale().fitContent();

    return {
      chart,
      candleSeries,
    };
  }, [containerRef, chartOptions, seriesOptions, onChartClick]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (containerRef.current && chartRef.current) {
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    }
  }, [containerRef]);

  return {
    chartRef,
    seriesRef,
    initChart,
    handleResize,
  };
};
