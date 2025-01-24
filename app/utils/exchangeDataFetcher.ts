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
    options: {
      forceHistorical?: boolean;
      daysToFetch?: number;
    } = {},
  ): Promise<FundingRateData[]> {
    const { forceHistorical = false, daysToFetch = 7 } = options;
    const currentTime = new Date();
    let allRates: FundingRateData[] = [];

    for (const symbol of symbols) {
      try {
        const latestTimestamp = await this.getLatestTimestamp(
          symbol,
          exchangeId,
        );

        if (!forceHistorical && latestTimestamp) {
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
          latestTimestamp && !forceHistorical
            ? latestTimestamp
            : new Date(
                currentTime.getTime() - daysToFetch * 24 * 60 * 60 * 1000,
              );

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
          rate: parseFloat(item.f) * 24 * 365,
          symbol: item.m,
        }));

        allRates = [...allRates, ...rates];
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching funding rates for ${symbol}:`, error);
        throw error;
      }
    }

    // Store the rates with the forceHistorical flag
    await this.storeFundingRates(allRates, exchangeId, forceHistorical);

    return allRates;
  }

  async storeFundingRates(
    rates: FundingRateData[],
    exchangeId: string,
    forceHistorical: boolean = false,
  ) {
    if (rates.length === 0) return;

    try {
      if (forceHistorical) {
        // Get unique symbols from the rates array
        const symbols = [...new Set(rates.map((rate) => rate.symbol))];

        // Delete existing data for these symbols
        await prisma.fundingRate.deleteMany({
          where: {
            symbol: { in: symbols },
            exchangeId: exchangeId,
          },
        });
      }

      // Store new data
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
