-- CreateTable
CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRate" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_name_key" ON "Exchange"("name");

-- CreateIndex
CREATE INDEX "FundingRate_timestamp_idx" ON "FundingRate"("timestamp");

-- CreateIndex
CREATE INDEX "FundingRate_symbol_idx" ON "FundingRate"("symbol");

-- CreateIndex
CREATE INDEX "FundingRate_exchangeId_idx" ON "FundingRate"("exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRate_timestamp_symbol_exchangeId_key" ON "FundingRate"("timestamp", "symbol", "exchangeId");

-- AddForeignKey
ALTER TABLE "FundingRate" ADD CONSTRAINT "FundingRate_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
