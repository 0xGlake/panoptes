// pages/index.tsx
"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi } from "lightweight-charts";

const ChartComponent = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (chartContainerRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: 400,
        height: 300,
        layout: {
          background: { color: "#ffffff" },
          textColor: "#333",
        },
        grid: {
          vertLines: { color: "#f0f0f0" },
          horzLines: { color: "#f0f0f0" },
        },
      });

      const lineSeries = chart.addLineSeries({
        color: "#2962FF",
        lineWidth: 2,
      });

      lineSeries.setData([
        { time: "2019-04-11", value: 80.01 },
        { time: "2019-04-12", value: 96.63 },
        { time: "2019-04-13", value: 76.64 },
        { time: "2019-04-14", value: 81.89 },
        { time: "2019-04-15", value: 74.43 },
        { time: "2019-04-16", value: 80.01 },
        { time: "2019-04-17", value: 96.63 },
        { time: "2019-04-18", value: 76.64 },
        { time: "2019-04-19", value: 81.89 },
        { time: "2019-04-20", value: 74.43 },
      ]);

      chartRef.current = chart;

      // Cleanup function
      return () => {
        chart.remove();
      };
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div ref={chartContainerRef} />
    </div>
  );
};

export default ChartComponent;
