"use client";
import TradingInterface from "../components/TradingInterface";
import Link from "next/link";

const TradingInterfacePage = () => {
  return (
    <div className="flex flex-col items-center w-full p-4">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Extended Exchange</h1>
          <Link href="/" className="text-blue-500 hover:text-blue-700">
            ← Back to Home
          </Link>
        </div>

        <TradingInterface />
      </div>
    </div>
  );
};

export default TradingInterfacePage;
