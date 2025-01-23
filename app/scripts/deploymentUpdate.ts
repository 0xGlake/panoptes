// scripts/deploymentUpdate.ts
import { PrismaClient } from "@prisma/client";
import { ExtendedFetcher } from "../utils/exchangeDataFetcher.js";

const prisma = new PrismaClient();

async function updateFundingRatesOnDeploy() {
  console.log("Starting funding rates update as part of deployment...");

  try {
    const exchange = await prisma.exchange.upsert({
      where: { name: "extended" },
      update: {},
      create: { name: "extended" },
    });

    const extendedFetcher = new ExtendedFetcher();
    const symbols = ["BTC-USD", "ETH-USD"];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    console.log(
      `Fetching data from ${startTime.toISOString()} to ${endTime.toISOString()}`,
    );

    const rates = await extendedFetcher.fetchHistoricalFundingRates(
      symbols,
      startTime,
      endTime,
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
