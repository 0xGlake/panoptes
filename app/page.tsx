"use client";

import { useEffect, useState } from "react";
import MarketCards from "./components/MarketCards";
// import CandlestickChart from "./components/CandlestickChart";
// import RenegadeCandlestickChart from "./components/RenegadeCandlestickChart";
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
  const [exchanges, setExchanges] = useState([]);
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
  }, []);

  const allSymbols = [
    ...new Set(
      exchanges.flatMap((exchange) =>
        exchange.rates.map((rate: FundingRate) => rate.symbol),
      ),
    ),
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <MarketCards symbols={allSymbols} marketData={marketData} />
      <ExtendedFundingRates exchanges={exchanges} />
      <RenegadeExtendedArb />
    </div>
  );
};

export default ChartComponent;
