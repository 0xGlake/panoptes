"use client";
import RenegadeExtendedArb from "../components/RenegadeExtendedArb";
import Link from "next/link";

const ArbitragePage = () => {
  return (
    <div className="flex flex-col items-center w-full p-4">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Arbitrage Opportunities</h1>
          <Link href="/" className="text-blue-500 hover:text-blue-700">
            ← Back to Home
          </Link>
        </div>

        <RenegadeExtendedArb />
      </div>
    </div>
  );
};

export default ArbitragePage;
