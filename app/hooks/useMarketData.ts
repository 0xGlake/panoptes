"use client";
import { useState, useEffect } from "react";

export interface FundingRate {
  id: string;
  timestamp: string;
  rate: number;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketStats {
  openInterest: number;
  dailyVolume: number;
  nextFundingRate: number;
  status: string;
}

export interface MarketData {
  [key: string]: MarketStats;
}

export const useMarketData = () => {
  const [ratesData, setRatesData] = useState([]);
  const [marketData, setMarketData] = useState<MarketData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ratesResponse, marketResponse] = await Promise.all([
          fetch("/api/funding-rates"),
          fetch("/api/extendedExchange"),
        ]);

        if (!ratesResponse.ok || !marketResponse.ok) {
          throw new Error("Failed to fetch data");
        }

        const ratesData = await ratesResponse.json();
        const marketStats = await marketResponse.json();

        setRatesData(ratesData);
        setMarketData(marketStats);
        setError(null);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load market data. Please try again later.");
      } finally {
        setLoading(false);
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

  return {
    ratesData,
    marketData,
    allSymbols,
    sortedSymbols,
    loading,
    error,
  };
};

export default useMarketData;
