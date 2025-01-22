// scripts/deploymentUpdate.ts
import { PrismaClient } from "@prisma/client";
import { ExtendedFetcher } from "../utils/exchangeDataFetcher";

const prisma = new PrismaClient();

async function updateFundingRatesOnDeploy() {
  console.log("Starting funding rates update as part of deployment...");

  try {
    // Get or create Extended exchange record
    const exchange = await prisma.exchange.upsert({
      where: { name: "extended" },
      update: {},
      create: { name: "extended" },
    });

    const extendedFetcher = new ExtendedFetcher();

    // List of symbols to track - you can modify this list as needed
    const symbols = ["BTC-USD", "ETH-USD"];

    // Get latest timestamp across all symbols
    const latestTimestamps = await Promise.all(
      symbols.map((symbol) =>
        extendedFetcher.getLatestStoredTimestamp(symbol, exchange.id),
      ),
    );

    // Find the earliest latest timestamp (or use 30 days ago if no data)
    const oldestLatestTimestamp =
      latestTimestamps.reduce(
        (earliest, current) =>
          current && (!earliest || current < earliest) ? current : earliest,
        null,
      ) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.log(`Fetching data since ${oldestLatestTimestamp.toISOString()}`);

    // Fetch and store the data
    const rates = await extendedFetcher.fetchHistoricalFundingRates(
      symbols,
      oldestLatestTimestamp,
    );

    if (rates.length > 0) {
      await extendedFetcher.storeFundingRates(rates, exchange.id);
      console.log(`Successfully updated ${rates.length} funding rates`);
    } else {
      console.log("No new funding rates to update");
    }
  } catch (error) {
    console.error("Error updating funding rates during deployment:", error);
    // Don't throw the error to avoid failing deployment
    // but you might want to add monitoring/alerting here
  } finally {
    await prisma.$disconnect();
  }
}

// Export for use in deployment scripts
export { updateFundingRatesOnDeploy };

// Allow running directly
if (require.main === module) {
  updateFundingRatesOnDeploy()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
