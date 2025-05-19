"use client";
import useMarketData from "../hooks/useMarketData";
import MarketCards from "../components/MarketCards";
import Link from "next/link";

const MarketsPage = () => {
  const { loading, error, marketData, sortedSymbols } = useMarketData();

  return (
    <div className="flex flex-col items-center w-full p-4">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Market Overview</h1>
          <Link href="/" className="text-blue-500 hover:text-blue-700">
            ← Back to Home
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
        ) : (
          <MarketCards symbols={sortedSymbols} marketData={marketData} />
        )}
      </div>
    </div>
  );
};

export default MarketsPage;
