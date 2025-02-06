import { NextResponse } from "next/server";

interface MarketStats {
  openInterest: number;
  dailyVolume: number;
  nextFundingRate: number;
}

interface MarketInfo {
  name: string;
  status: string;
  marketStats: MarketStats;
}

interface ExtendedApiResponse {
  status: string;
  data: MarketInfo[];
}

interface FormattedMarketData {
  [key: string]: {
    openInterest: number;
    dailyVolume: number;
    nextFundingRate: number;
    status: string;
  };
}

export async function GET() {
  try {
    const response = await fetch(
      "https://api.extended.exchange/api/v1/info/markets",
      {
        next: { revalidate: 60 }, // Cache for 60 seconds
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ExtendedApiResponse;

    if (data.status !== "OK") {
      throw new Error("API returned non-OK status");
    }

    // Format the data into a key-value object where the key is the market name
    const formattedData: FormattedMarketData = data.data.reduce(
      (acc, market) => {
        acc[market.name] = {
          openInterest: market.marketStats.openInterest,
          dailyVolume: market.marketStats.dailyVolume,
          nextFundingRate: market.marketStats.nextFundingRate,
          status: market.status,
        };
        return acc;
      },
      {} as FormattedMarketData,
    );

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Error fetching market data:", error);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 },
    );
  }
}
