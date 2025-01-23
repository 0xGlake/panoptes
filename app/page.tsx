// pages/index.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi } from "lightweight-charts";

interface FundingRate {
  timestamp: Date;
  rate: number;
  symbol: string;
}

const ChartComponent = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/funding-rates?symbol=${selectedSymbol}`,
        );
        const rates = await response.json();

        if (chartContainerRef.current) {
          if (chartRef.current) {
            chartRef.current.remove();
          }

          const chart = createChart(chartContainerRef.current, {
            width: 800,
            height: 400,
            layout: {
              background: { color: "#ffffff" },
              textColor: "#333",
            },
            grid: {
              vertLines: { color: "#f0f0f0" },
              horzLines: { color: "#f0f0f0" },
            },
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
            },
          });

          const lineSeries = chart.addLineSeries({
            color: "#2962FF",
            lineWidth: 2,
            title: `${selectedSymbol} Funding Rate`,
          });

          const chartData = rates.map((rate: FundingRate) => ({
            time: new Date(rate.timestamp).getTime() / 1000,
            value: rate.rate * 100, // Convert to percentage
          }));

          lineSeries.setData(chartData);
          chartRef.current = chart;
          chart.timeScale().fitContent();
        }
      } catch (error) {
        console.error("Error fetching funding rates:", error);
      }
    };

    fetchData();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [selectedSymbol]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="mb-4">
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="BTC-USD">BTC-USD</option>
          <option value="ETH-USD">ETH-USD</option>
        </select>
      </div>
      <div ref={chartContainerRef} className="border rounded shadow-lg" />
    </div>
  );
};

export default ChartComponent;
