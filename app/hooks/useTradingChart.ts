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
    if (!containerRef.current) {
      console.log("Container ref not available");
      return;
    }

    // Clean up previous chart if it exists
    if (chartRef.current) {
      try {
        // Make sure to unsubscribe the click handler before removing
        if (onChartClick) {
          chartRef.current.unsubscribeClick(onChartClick);
        }
        chartRef.current.remove();
      } catch (error) {
        console.error("Error removing old chart:", error);
      }
      chartRef.current = null;
      seriesRef.current = null;
    }

    console.log("Creating new chart...");

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

        // Log a test click to verify the handler is working
        console.log("Chart click handler attached, testing...");
        setTimeout(() => {
          const testClick = { point: { x: 100, y: 100 } };
          console.log("Simulating click:", testClick);
          // This is just to log, not actually trigger the click
        }, 500);
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
  }, [containerRef, chartOptions, seriesOptions, onChartClick]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (containerRef.current && chartRef.current) {
      try {
        const newWidth = containerRef.current.clientWidth;
        console.log("Resizing chart to width:", newWidth);
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
  }, [containerRef]);

  return {
    chartRef,
    seriesRef,
    initChart,
    handleResize,
  };
};
