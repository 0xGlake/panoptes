"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi } from "lightweight-charts";
import MarketCards from "./components/MarketCards";

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
  "#2962FF", // blue
  "#FF6B6B", // red
  "#4CAF50", // green
  "#9C27B0", // purple
  "#FF9800", // orange
  "#00BCD4", // cyan
  "#795548", // brown
  "#607D8B", // blue-grey
];

interface MarketStats {
  openInterest: number;
  dailyVolume: number;
  nextFundingRate: number;
  status: string;
}

interface MarketData {
  [key: string]: MarketStats;
}

const ChartComponent = () => {
  const chartsRef = useRef<{ [key: string]: IChartApi }>({});
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [marketData, setMarketData] = useState<MarketData>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ratesResponse, marketResponse] = await Promise.all([
          fetch("/api/funding-rates"),
          fetch("/api/extendedExchange"),
        ]);

        const ratesData = await ratesResponse.json();
        const marketStats = await marketResponse.json();

        setExchanges(ratesData);
        setMarketData(marketStats);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    return () => {
      Object.values(chartsRef.current).forEach((chart) => chart.remove());
    };
  }, []);

  useEffect(() => {
    // Clean up existing charts
    Object.values(chartsRef.current).forEach((chart) => chart.remove());
    chartsRef.current = {};

    exchanges.forEach((exchange) => {
      // Get unique symbols for this exchange
      const symbols = [...new Set(exchange.rates.map((rate) => rate.symbol))];

      // Create container for this exchange's chart if it doesn't exist
      const containerId = `chart-${exchange.id}`;
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.marginBottom = "20px";
        document.getElementById("charts-container")?.appendChild(container);
      }

      // Create chart
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

      // Add series for each symbol
      symbols.forEach((symbol, symbolIndex) => {
        const symbolRates = exchange.rates.filter(
          (rate) => rate.symbol === symbol,
        );
        const lineSeries = chart.addLineSeries({
          color: COLORS[symbolIndex % COLORS.length],
          lineWidth: 2,
          title: symbol,
        });

        const chartData = symbolRates.map((rate) => ({
          time: new Date(rate.timestamp).getTime() / 1000,
          value: rate.rate * 100, // Convert to percentage
        }));

        lineSeries.setData(chartData);
      });

      chart.timeScale().fitContent();
      chartsRef.current[exchange.id] = chart;
    });
  }, [exchanges]);

  const getSortedSymbols = (symbols: string[], marketData: MarketData) => {
    return [...symbols].sort((a, b) => {
      const statsA = marketData[a];
      const statsB = marketData[b];

      // Handle cases where market data might not exist
      if (!statsA) return 1;
      if (!statsB) return -1;

      // Sort by open interest in descending order
      return statsB.openInterest - statsA.openInterest;
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div id="charts-container" className="w-full max-w-4xl space-y-8">
        {exchanges.map((exchange) => {
          const symbols = [
            ...new Set(exchange.rates.map((rate) => rate.symbol)),
          ];

          return (
            <div
              key={exchange.id}
              className="rounded shadow-lg p-4 flex flex-col items-center"
            >
              <h2 className="text-xl font-bold mb-4">{exchange.name}</h2>
              <div id={`chart-${exchange.id}`} />

              <MarketCards symbols={symbols} marketData={marketData} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChartComponent;
