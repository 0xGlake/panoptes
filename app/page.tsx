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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num}%`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div id="charts-container" className="w-full max-w-4xl space-y-8">
        {exchanges.map((exchange) => {
          const symbols = [
            ...new Set(exchange.rates.map((rate) => rate.symbol)),
          ];
          const sortedSymbols = getSortedSymbols(symbols, marketData);

          return (
            <div
              key={exchange.id}
              className="border rounded shadow-lg p-4 flex flex-col items-center"
            >
              <h2 className="text-xl font-bold mb-4">{exchange.name}</h2>
              <div id={`chart-${exchange.id}`} />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 w-full">
                {sortedSymbols.map((symbol) => {
                  const stats = marketData[symbol];
                  if (!stats) return null;

                  return (
                    <div
                      key={symbol}
                      className="bg-white rounded-lg shadow p-4 border"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {symbol}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            stats.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {stats.status}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-900">Open Interest</span>
                          <span className="font-medium text-gray-500">
                            ${formatNumber(stats.openInterest)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-900">Daily Volume</span>
                          <span className="font-medium text-gray-500">
                            ${formatNumber(stats.dailyVolume)}
                          </span>
                        </div>

                        {/* <div className="flex justify-between">
                            <span className="text-gray-600">
                              Next Funding Rate
                            </span>
                            <span
                              className={`font-medium ${
                                stats.nextFundingRate > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatPercentage(stats.nextFundingRate)}
                            </span>
                          </div> */}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChartComponent;
