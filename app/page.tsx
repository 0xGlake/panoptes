"use client";
import Link from "next/link";

const HomePage = () => {
  return (
    <div className="flex flex-col items-center w-full p-8">
      <h1 className="text-3xl font-bold mb-8">Crypto Market Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <NavigationCard
          title="Market Overview"
          description="View all market cards with open interest, volume, and funding rates"
          href="/markets"
          bgColor="bg-blue-100"
        />

        <NavigationCard
          title="Funding Rates"
          description="Analyze extended funding rates across exchanges"
          href="/funding-rates"
          bgColor="bg-green-100"
        />

        <NavigationCard
          title="Arbitrage Opportunities"
          description="Explore Renegade extended arbitrage opportunities"
          href="/arbitrage"
          bgColor="bg-purple-100"
        />
      </div>
    </div>
  );
};

interface NavigationCardProps {
  title: string;
  description: string;
  href: string;
  bgColor: string;
}

const NavigationCard = ({
  title,
  description,
  href,
  bgColor,
}: NavigationCardProps) => {
  return (
    <Link href={href} className="block">
      <div
        className={`${bgColor} rounded-lg p-6 h-full shadow-md hover:shadow-lg transition-shadow duration-300`}
      >
        <h2 className="text-xl font-semibold mb-3">{title}</h2>
        <p className="text-gray-700">{description}</p>
      </div>
    </Link>
  );
};

export default HomePage;
