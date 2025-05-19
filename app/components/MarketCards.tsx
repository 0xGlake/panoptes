"use client";

import { useState } from "react";

interface MarketStats {
  openInterest: number;
  dailyVolume: number;
  nextFundingRate: number;
  status: string;
}

interface MarketData {
  [key: string]: MarketStats;
}

interface MarketCardsProps {
  symbols: string[];
  marketData: MarketData;
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
};

const MarketCards = ({ symbols, marketData }: MarketCardsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSortedSymbols = (symbols: string[], marketData: MarketData) => {
    return [...symbols].sort((a, b) => {
      const statsA = marketData[a];
      const statsB = marketData[b];
      if (!statsA) return 1;
      if (!statsB) return -1;
      return statsB.openInterest - statsA.openInterest;
    });
  };

  const sortedSymbols = getSortedSymbols(symbols, marketData);

  return (
    <div className="w-full pt-5 flex flex-col items-center mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-3/12 flex items-center justify-between p-2 bg-gray-300 rounded-lg mb-2 hover:bg-gray-200 transition-colors"
      >
        <span className="font-medium text-gray-700">
          Extended Market Statistics
        </span>
        {isExpanded ? (
          <span className="text-gray-600">Hide</span>
        ) : (
          <span className="text-blue-600">View all</span>
        )}
      </button>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 size-10/12">
          {sortedSymbols.map((symbol) => {
            const stats = marketData[symbol];
            if (!stats) return null;

            return (
              <div
                key={symbol}
                className="bg-white rounded-lg shadow p-4 border text-gray-900"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-lg">{symbol}</h3>
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
                    <span className="text-gray-600">Open Interest</span>
                    <span className="font-medium">
                      ${formatNumber(stats.openInterest)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Volume</span>
                    <span className="font-medium">
                      ${formatNumber(stats.dailyVolume)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketCards;
