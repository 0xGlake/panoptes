"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, Time } from "lightweight-charts";

import { Exchange } from "../hooks/useMarketData";

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

const ExtendedFundingRates = ({
  exchanges,
  sortedSymbols,
}: {
  exchanges: Exchange[];
  sortedSymbols: string[];
}) => {
  const chartsRef = useRef<{ [key: string]: IChartApi }>({});
  const [selectedSymbols, setSelectedSymbols] = useState<{
    [key: string]: boolean;
  }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selected symbols
  useEffect(() => {
    if (Object.keys(selectedSymbols).length === 0 && sortedSymbols.length > 0) {
      const initial = sortedSymbols.reduce(
        (acc, symbol) => ({
          ...acc,
          [symbol]: true,
        }),
        {},
      );
      setSelectedSymbols(initial);
    }
  }, [sortedSymbols, selectedSymbols]);

  // Cleanup function
  useEffect(() => {
    return () => {
      Object.values(chartsRef.current).forEach((chart) => {
        try {
          chart.remove();
        } catch (e) {
          console.log("Chart already disposed", e);
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
        console.log("Chart already disposed", e);
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
        height: 600,
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
        .filter(([, isSelected]) => isSelected)
        .forEach(([symbol], symbolIndex) => {
          const symbolRates = exchange.rates.filter(
            (rate) => rate.symbol === symbol,
          );
          const lineSeries = chart.addLineSeries({
            color: COLORS[symbolIndex % COLORS.length],
            lineWidth: 1,
            title: symbol,
            priceFormat: {
              type: "percent",
              precision: 2,
            },
          });

          const chartData = symbolRates.map((rate) => ({
            time: (new Date(rate.timestamp).getTime() / 1000) as Time,
            value: rate.rate * 100,
          }));

          lineSeries.setData(chartData);
        });

      chart.timeScale().fitContent();
      chartsRef.current[exchange.id] = chart;
    });
  }, [exchanges, selectedSymbols]);

  const handleSelectAll = () => {
    const newSelected = sortedSymbols.reduce(
      (acc, symbol) => ({ ...acc, [symbol]: true }),
      {},
    );
    setSelectedSymbols(newSelected);
  };

  const handleDeselectAll = () => {
    const newSelected = sortedSymbols.reduce(
      (acc, symbol) => ({ ...acc, [symbol]: false }),
      {},
    );
    setSelectedSymbols(newSelected);
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both the dropdown button and dropdown content
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest(".dropdown-button")
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center mb-4">
      <h1 className="text-4xl font-extrabold mb-2 text-[#068a63]">
        Extended Funding Rates
      </h1>
      <div className="relative">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-4 py-2 bg-[#027352] text-white rounded-md hover:bg-gray-600 focus:outline-none dropdown-button"
          >
            Select Markets
          </button>
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 bg-[#027352] text-white rounded-md hover:bg-gray-600 focus:outline-none"
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-4 py-2 bg-[#027352] text-white rounded-md hover:bg-gray-600 focus:outline-none"
          >
            Deselect All
          </button>
        </div>

        {isDropdownOpen && (
          <div
            ref={dropdownRef} // Added ref to dropdown content
            className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto text-gray-600"
          >
            <div className="p-2">
              {sortedSymbols.map((symbol) => (
                <label
                  key={symbol}
                  className="flex items-center p-2 hover:bg-gray-300 cursor-pointer"
                >
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
                  <span className="ml-2 text-sm">{symbol}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div ref={containerRef} className="space-y-8">
        {exchanges.map((exchange) => (
          <div key={exchange.id} className="rounded shadow-lg p-4">
            <div id={`chart-${exchange.id}`} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtendedFundingRates;
