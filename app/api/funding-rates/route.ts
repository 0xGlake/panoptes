import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  try {
    const exchanges = await prisma.exchange.findMany({
      include: {
        fundingRates: {
          where: {
            symbol: symbol || undefined,
          },
          orderBy: {
            timestamp: "asc",
          },
        },
      },
    });

    // Transform the data to a more suitable format
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
    return NextResponse.json(
      { error: "Failed to fetch funding rates with error: " + error },
      { status: 500 },
    );
  }
}
