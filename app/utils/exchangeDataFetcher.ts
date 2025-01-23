// utils/exchangeDataFetcher.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FundingRateData {
  timestamp: Date;
  rate: number;
  symbol: string;
}

interface ApiResponse {
  status: string;
  data: Array<{
    m: string;
    T: number;
    f: string;
  }>;
}

export class ExtendedFetcher {
  private baseUrl: string;

  constructor() {
    this.baseUrl = "https://api.extended.exchange";
  }

  async storeFundingRates(rates: FundingRateData[], exchangeId: string) {
    try {
      await prisma.fundingRate.createMany({
        data: rates.map((rate) => ({
          timestamp: rate.timestamp,
          rate: rate.rate,
          symbol: rate.symbol,
          exchangeId: exchangeId,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      console.error("Error storing funding rates:", error);
      throw error;
    }
  }

  async fetchHistoricalFundingRates(
    symbols: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<FundingRateData[]> {
    let allRates: FundingRateData[] = [];

    for (const symbol of symbols) {
      try {
        const url = new URL(`${this.baseUrl}/api/v1/info/${symbol}/funding`);
        url.searchParams.append("startTime", startTime.getTime().toString());
        url.searchParams.append("endTime", endTime.getTime().toString());

        console.log(`Fetching from URL: ${url.toString()}`);

        const response = await fetch(url.toString());
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, body: ${errorText}`,
          );
        }

        const data: ApiResponse = await response.json();

        if (data.status !== "OK") {
          throw new Error(`API error: ${data.status}`);
        }

        const rates = data.data.map((item) => ({
          timestamp: new Date(item.T),
          rate: parseFloat(item.f),
          symbol: item.m,
        }));

        allRates = [...allRates, ...rates];
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching funding rates for ${symbol}:`, error);
        throw error;
      }
    }

    return allRates;
  }
}
