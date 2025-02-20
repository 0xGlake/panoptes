"use client";

import { useEffect, useState } from "react";
import MarketCards from "./components/MarketCards";
import ExtendedFundingRates from "./components/ExtendedFundingRates";
import RenegadeExtendedArb from "./components/RenegadeExtendedArb";

interface FundingRate {
  id: string;
  timestamp: string;
  rate: number;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}

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
  const [ratesData, setRatesData] = useState([]);
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

        setRatesData(ratesData);
        setMarketData(marketStats);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const allSymbols = [
    ...new Set(
      ratesData.flatMap((exchange) =>
        exchange.rates.map((rate: FundingRate) => rate.symbol),
      ),
    ),
  ];

  const getSortedSymbols = (symbols: string[], marketData: MarketData) => {
    return [...symbols].sort((a, b) => {
      const statsA = marketData[a];
      const statsB = marketData[b];
      if (!statsA) return 1;
      if (!statsB) return -1;
      return statsB.openInterest - statsA.openInterest;
    });
  };

  const sortedSymbols = getSortedSymbols(allSymbols, marketData);

  return (
    <div className="flex flex-col items-center w-full">
      <MarketCards symbols={sortedSymbols} marketData={marketData} />
      <ExtendedFundingRates
        exchanges={ratesData}
        sortedSymbols={sortedSymbols}
      />
      <RenegadeExtendedArb />
    </div>
  );
};

export default ChartComponent;
