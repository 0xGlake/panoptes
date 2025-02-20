"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi } from "lightweight-charts";

interface FundingRate {
  id: string;
  timestamp: string;
  rate: number;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}

interface Exchange {
  id: string;
  name: string;
  rates: FundingRate[];
}

const COLORS = [
  "#2962FF",
  "#FF6B6B",
  "#4CAF50",
  "#9C27B0",
  "#FF9800",
  "#00BCD4",
  "#795548",
  "#607D8B",
];

const ExtendedFundingRates = ({ exchanges }: { exchanges: Exchange[] }) => {
  const chartsRef = useRef<{ [key: string]: IChartApi }>({});
  const [selectedSymbols, setSelectedSymbols] = useState<{
    [key: string]: boolean;
  }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const allSymbols = [
    ...new Set(
      exchanges.flatMap((exchange) =>
        exchange.rates.map((rate) => rate.symbol),
      ),
    ),
  ];

  // Initialize selected symbols
  useEffect(() => {
    if (Object.keys(selectedSymbols).length === 0 && allSymbols.length > 0) {
      const initial = allSymbols.reduce(
        (acc, symbol) => ({
          ...acc,
          [symbol]: true,
        }),
        {},
      );
      setSelectedSymbols(initial);
    }
  }, [allSymbols]);

  // Cleanup function
  useEffect(() => {
    return () => {
      Object.values(chartsRef.current).forEach((chart) => {
        try {
          chart.remove();
        } catch (e) {
          console.log("Chart already disposed");
        }
      });
      chartsRef.current = {};
    };
  }, []);

  // Chart creation and update
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing charts
    Object.values(chartsRef.current).forEach((chart) => {
      try {
        chart.remove();
      } catch (e) {
        console.log("Chart already disposed");
      }
    });
    chartsRef.current = {};

    exchanges.forEach((exchange) => {
      const containerId = `chart-${exchange.id}`;
      let container = document.getElementById(containerId);

      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.marginBottom = "20px";
        containerRef.current?.appendChild(container);
      }

      const chart = createChart(container, {
        width: 800,
        height: 800,
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
        rightPriceScale: {
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
      });

      // Only create series for selected symbols
      Object.entries(selectedSymbols)
        .filter(([_, isSelected]) => isSelected)
        .forEach(([symbol], symbolIndex) => {
          const symbolRates = exchange.rates.filter(
            (rate) => rate.symbol === symbol,
          );
          const lineSeries = chart.addLineSeries({
            color: COLORS[symbolIndex % COLORS.length],
            lineWidth: 1,
            title: symbol,
          });

          const chartData = symbolRates.map((rate) => ({
            time: new Date(rate.timestamp).getTime() / 1000,
            value: rate.rate * 100,
          }));

          lineSeries.setData(chartData);
        });

      chart.timeScale().fitContent();
      chartsRef.current[exchange.id] = chart;
    });
  }, [exchanges, selectedSymbols]);

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Select Markets to Display
        </h3>
        <div className="flex flex-wrap gap-2">
          {allSymbols.map((symbol) => (
            <label key={symbol} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedSymbols[symbol] || false}
                onChange={(e) =>
                  setSelectedSymbols((prev) => ({
                    ...prev,
                    [symbol]: e.target.checked,
                  }))
                }
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="text-sm">{symbol}</span>
            </label>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="space-y-8">
        {exchanges.map((exchange) => (
          <div key={exchange.id} className="rounded shadow-lg p-4">
            <h2 className="text-xl font-bold mb-4">{exchange.name}</h2>
            <div id={`chart-${exchange.id}`} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtendedFundingRates;
