export interface ArbitrageToken {
  name: string;
  extendedSymbol: string; // Symbol used on Extended Exchange
  renegadeSymbol: string; // Symbol used on Renegade
  description?: string; // Optional description of the token
}

export const ARBITRAGE_TOKENS: ArbitrageToken[] = [
  {
    name: "Bitcoin",
    extendedSymbol: "BTC-USD",
    renegadeSymbol: "WBTC",
    description: "Bitcoin / Wrapped Bitcoin",
  },
  {
    name: "Ethereum",
    extendedSymbol: "ETH-USD",
    renegadeSymbol: "WETH",
    description: "Ethereum / Wrapped Ethereum",
  },
  {
    name: "Chainlink",
    extendedSymbol: "LINK-USD",
    renegadeSymbol: "LINK",
    description: "Chainlink",
  },
  {
    name: "Aave",
    extendedSymbol: "AAVE-USD",
    renegadeSymbol: "AAVE",
    description: "Aave",
  },
  {
    name: "Arbitrum",
    extendedSymbol: "ARB-USD",
    renegadeSymbol: "ARB",
    description: "Arbitrum",
  },
];
