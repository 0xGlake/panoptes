// scripts/deploymentUpdate.ts
import { PrismaClient } from "@prisma/client";
import { ExtendedFetcher } from "../utils/exchangeDataFetcher.js";

const prisma = new PrismaClient();

interface MarketInfo {
  name: string;
  active: boolean;
  status: string;
}

interface ExtendedMarketsResponse {
  status: string;
  data: MarketInfo[];
}

async function getActiveMarkets(): Promise<string[]> {
  try {
    const response = await fetch(
      "https://api.extended.exchange/api/v1/info/markets",
    );
    const data = (await response.json()) as ExtendedMarketsResponse;

    if (data.status !== "OK") {
      throw new Error("Failed to fetch markets data");
    }

    // Filter for active markets and extract their names
    return data.data
      .filter((market) => market.active && market.status === "ACTIVE")
      .map((market) => market.name);
  } catch (error) {
    console.error("Error fetching markets:", error);
    throw error;
  }
}

async function updateFundingRatesOnDeploy() {
  console.log("Starting funding rates update as part of deployment...");

  try {
    const exchange = await prisma.exchange.upsert({
      where: { name: "extended" },
      update: {},
      create: { name: "extended" },
    });

    const extendedFetcher = new ExtendedFetcher();

    // Get active markets dynamically instead of using hardcoded symbols
    const symbols = await getActiveMarkets();
    console.log(`Found ${symbols.length} active markets`);

    const rates = await extendedFetcher.fetchHistoricalFundingRates(
      symbols,
      exchange.id,
      {
        forceHistorical: true,
        daysToFetch: 99,
      },
    );

    if (rates.length > 0) {
      await extendedFetcher.storeFundingRates(rates, exchange.id);
      console.log(`Successfully updated ${rates.length} funding rates`);
    } else {
      console.log("No new funding rates to update");
    }
  } catch (error) {
    console.error("Error updating funding rates during deployment:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateFundingRatesOnDeploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
