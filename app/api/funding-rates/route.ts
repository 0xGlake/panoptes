// app/api/funding-rates/route.ts
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  try {
    const rates = await prisma.fundingRate.findMany({
      where: {
        symbol: symbol || undefined,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    return NextResponse.json(rates);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch funding rates with error: " + error },
      { status: 500 },
    );
  }
}
