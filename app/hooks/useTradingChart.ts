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

  // Initialize chart - use a stable callback that won't change on every render
  const initChart = useCallback(() => {
    if (!containerRef.current) {
      console.error("Container ref not available");
      return null;
    }

    // If chart already exists, don't recreate it
    if (chartRef.current && seriesRef.current) {
      console.log("Chart already initialized, skipping recreation");
      return { chart: chartRef.current, candleSeries: seriesRef.current };
    }

    console.log("Creating new chart instance");

    try {
      // Create new chart
      const chart = createChart(containerRef.current, {
        ...chartOptions,
        width: containerRef.current.clientWidth || 800,
        height: 400,
      });

      const candleSeries = chart.addCandlestickSeries(seriesOptions);

      // Store references
      chartRef.current = chart;
      seriesRef.current = candleSeries;

      // Subscribe to chart clicks if handler provided
      if (onChartClick) {
        console.log("Subscribing to chart click events");
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
    } catch (error) {
      console.error("Error creating chart:", error);
      return null;
    }
  }, []); // Empty dependency array to make this callback stable

  // Handle resize
  const handleResize = useCallback(() => {
    if (containerRef.current && chartRef.current) {
      try {
        const newWidth = containerRef.current.clientWidth;
        chartRef.current.applyOptions({
          width: newWidth,
        });
        // Force a redraw
        chartRef.current
          .timeScale()
          .scrollToPosition(
            chartRef.current.timeScale().scrollPosition(),
            false,
          );
      } catch (error) {
        console.error("Error resizing chart:", error);
      }
    }
  }, []);

  return {
    chartRef,
    seriesRef,
    initChart,
    handleResize,
  };
};
