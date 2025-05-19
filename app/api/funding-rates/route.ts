import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  try {
    // Simple query without retry logic
    const exchanges = await prisma.exchange.findMany({
      include: {
        fundingRates: {
          where: {
            symbol: symbol || undefined,
          },
          orderBy: {
            timestamp: "asc",
          },
          take: 10000,
        },
      },
    });

    // Transform the data
    const response = exchanges.map((exchange) => ({
      id: exchange.id,
      name: exchange.name,
      rates: exchange.fundingRates.map((rate) => ({
        id: rate.id,
        timestamp: rate.timestamp,
        rate: rate.rate,
        symbol: rate.symbol,
        createdAt: rate.createdAt,
        updatedAt: rate.updatedAt,
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    // Safer error handling
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `Failed to fetch funding rates with error: ${errorMessage}` },
      { status: 500 },
    );
  }
}
