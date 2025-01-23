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
  private readonly UPDATE_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor() {
    this.baseUrl = "https://api.extended.exchange";
  }

  async getLatestTimestamp(
    symbol: string,
    exchangeId: string,
  ): Promise<Date | null> {
    const latest = await prisma.fundingRate.findFirst({
      where: { symbol, exchangeId },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    });
    return latest?.timestamp || null;
  }

  async fetchHistoricalFundingRates(
    symbols: string[],
    exchangeId: string,
  ): Promise<FundingRateData[]> {
    const currentTime = new Date();
    let allRates: FundingRateData[] = [];

    for (const symbol of symbols) {
      try {
        const latestTimestamp = await this.getLatestTimestamp(
          symbol,
          exchangeId,
        );
        if (latestTimestamp) {
          const timeSinceLastUpdate =
            currentTime.getTime() - latestTimestamp.getTime();
          if (timeSinceLastUpdate < this.UPDATE_THRESHOLD) {
            console.log(
              `Skipping ${symbol} - data is recent (${Math.round(timeSinceLastUpdate / 1000 / 60)} minutes old)`,
            );
            continue;
          }
        }

        const startTime =
          latestTimestamp ||
          new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
        const url = new URL(`${this.baseUrl}/api/v1/info/${symbol}/funding`);
        url.searchParams.append("startTime", startTime.getTime().toString());
        url.searchParams.append("endTime", currentTime.getTime().toString());

        console.log(
          `Fetching new data for ${symbol} from ${startTime.toISOString()}`,
        );

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
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

  async storeFundingRates(rates: FundingRateData[], exchangeId: string) {
    if (rates.length === 0) return;

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
}
