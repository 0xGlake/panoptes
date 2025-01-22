// utils/exchangeDataFetcher.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FundingRateData {
  timestamp: Date;
  rate: number;
  symbol: string;
}

interface PaginationResponse {
  cursor: string;
  count: number;
}

interface ApiResponse {
  status: string;
  data: Array<{
    m: string; // market
    T: number; // timestamp
    f: string; // funding rate
  }>;
  pagination: PaginationResponse;
}

class ExchangeDataFetcher {
  protected exchange: string;
  protected baseUrl: string;

  constructor(exchange: string, baseUrl: string) {
    this.exchange = exchange;
    this.baseUrl = baseUrl;
  }

  async fetchHistoricalFundingRates(
    symbols: string[],
    startTime?: Date,
    endTime?: Date,
  ): Promise<FundingRateData[]> {
    throw new Error("Method must be implemented for specific exchange");
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

  async getLatestStoredTimestamp(
    symbol: string,
    exchangeId: string,
  ): Promise<Date | null> {
    const latest = await prisma.fundingRate.findFirst({
      where: {
        symbol,
        exchangeId,
      },
      orderBy: {
        timestamp: "desc",
      },
      select: {
        timestamp: true,
      },
    });

    return latest?.timestamp || null;
  }
}

export class ExtendedFetcher extends ExchangeDataFetcher {
  constructor() {
    super("extended", "https://api.extended.com"); // Replace with actual base URL
  }

  async fetchHistoricalFundingRates(
    symbols: string[],
    startTime?: Date,
    endTime?: Date,
  ): Promise<FundingRateData[]> {
    let allRates: FundingRateData[] = [];

    for (const symbol of symbols) {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/api/v1/info/${symbol}/funding`);

        if (startTime) {
          url.searchParams.append(
            "startTime",
            Math.floor(startTime.getTime() / 1000).toString(),
          );
        }
        if (endTime) {
          url.searchParams.append(
            "endTime",
            Math.floor(endTime.getTime() / 1000).toString(),
          );
        }
        if (cursor) {
          url.searchParams.append("cursor", cursor);
        }

        try {
          const response = await fetch(url.toString());
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data: ApiResponse = await response.json();

          if (data.status !== "OK") {
            throw new Error(`API error: ${data.status}`);
          }

          const rates = data.data.map((item) => ({
            timestamp: new Date(item.T * 1000), // Convert Unix timestamp to Date
            rate: parseFloat(item.f),
            symbol: item.m,
          }));

          allRates = [...allRates, ...rates];

          // Check if we need to continue pagination
          if (data.pagination.count === 0 || !data.pagination.cursor) {
            hasMore = false;
          } else {
            cursor = data.pagination.cursor.toString();
          }

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error fetching funding rates for ${symbol}:`, error);
          throw error;
        }
      }
    }

    return allRates;
  }
}
