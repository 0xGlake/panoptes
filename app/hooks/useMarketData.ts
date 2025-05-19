"use client";
import { useState, useEffect, useMemo } from "react";

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

export interface Exchange {
  id: string;
  name: string;
  rates: FundingRate[];
}

// Create a cache outside the hook to persist between component remounts
const dataCache = {
  ratesData: null as Exchange[] | null,
  marketData: null as MarketData | null,
  lastFetched: 0,
  // Set cache expiry to 5 minutes (in milliseconds)
  expiryTime: 5 * 60 * 1000,
};

export const useMarketData = () => {
  const [ratesData, setRatesData] = useState<Exchange[]>([]);
  const [marketData, setMarketData] = useState<MarketData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const currentTime = Date.now();
        const cacheExpired =
          currentTime - dataCache.lastFetched > dataCache.expiryTime;

        // First fetch market data - seems less likely to error based on your description
        if (!dataCache.marketData || cacheExpired) {
          try {
            const marketResponse = await fetch("/api/extendedExchange");
            if (!marketResponse.ok) {
              throw new Error(
                `Failed to fetch market data: ${marketResponse.status}`,
              );
            }
            const marketStats = await marketResponse.json();
            dataCache.marketData = marketStats;
            setMarketData(marketStats);
          } catch (marketError) {
            console.error("Error fetching market data:", marketError);
            // Continue with cached market data if available
            if (dataCache.marketData) {
              setMarketData(dataCache.marketData);
            } else {
              throw new Error(
                "Failed to load market data and no cache available",
              );
            }
          }
        } else {
          setMarketData(dataCache.marketData);
        }

        // Then fetch rates data
        if (!dataCache.ratesData || cacheExpired) {
          try {
            const ratesResponse = await fetch("/api/funding-rates");
            if (!ratesResponse.ok) {
              throw new Error(
                `Failed to fetch funding rates: ${ratesResponse.status}`,
              );
            }
            const newRatesData = await ratesResponse.json();
            dataCache.ratesData = newRatesData;
            setRatesData(newRatesData);
          } catch (ratesError) {
            console.error("Error fetching rates data:", ratesError);
            // Continue with cached rates data if available
            if (dataCache.ratesData) {
              setRatesData(dataCache.ratesData);
            } else {
              throw new Error(
                "Failed to load rates data and no cache available",
              );
            }
          }
        } else {
          setRatesData(dataCache.ratesData);
        }

        // Update last fetched timestamp
        if (cacheExpired) {
          dataCache.lastFetched = currentTime;
        }
      } catch (error) {
        console.error("Error in useMarketData hook:", error);
        setError(
          error instanceof Error ? error.message : "An unknown error occurred",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Compute derived data with useMemo to avoid recalculations
  const allSymbols = useMemo(() => {
    if (!ratesData.length) return [];

    return [
      ...new Set(
        ratesData.flatMap((exchange) =>
          exchange.rates.map((rate: FundingRate) => rate.symbol),
        ),
      ),
    ];
  }, [ratesData]);

  const sortedSymbols = useMemo(() => {
    if (!allSymbols.length || !Object.keys(marketData).length) return [];

    return [...allSymbols].sort((a, b) => {
      const statsA = marketData[a];
      const statsB = marketData[b];
      if (!statsA) return 1;
      if (!statsB) return -1;
      return statsB.openInterest - statsA.openInterest;
    });
  }, [allSymbols, marketData]);

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
