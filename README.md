This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


# ideas for visualisation
  - cash carry and speculate airdrop
    - spot
      - renegade
    - derrivatives
      - extended (prev x10)
      - jupiter?
  - arbitrage on futarchy market
    - market
      - metadao
    - spot
      - jito
  - news based trading
    - regex hooked up with RSS feeds (PVP twitter clone)
  - pumpfun AI analyst

## useful links:
https://tradingview.github.io/lightweight-charts/tutorials

## cash carry trade todo
- [x] display historic funding rates from extended exchange (line graph)
  - [x] https://api.extended.exchange/api/v1/info/markets - for getting market tickers and fees
    - [x] get market tickers
    - [x] optional: display 24hr volume to gauge interest (marketStats.dailyVolume) and open interest (marketStats.openInterest)
  - [x] https://api.docs.extended.exchange/#get-funding-rates-history - for funding history
- [ ] an input box which tells you how much fees you'll pay for X size position (split in half for delta neutral)
  - [ ] is funding paid in base asset or quote currency
  - [ ] estimated APY to be paid based on current funding rate
  - [ ] get order book depth for extended for estimating cost of placing short
  - [ ] add option to add leveraged positions
    - [ ] liquidation price
- [ ] display live prices from web socket of extended and rengegade
  - [x] display extended mark prices from websocket
    - [x] update to pull from orderbook websocket rather than candlestick websocket for more accurate info
    - [ ] use horizontal lines to show largest pending orders size and price, heres ref: https://github.com/tradingview/lightweight-charts/issues/1063
    - [ ] depth=1 play with the depth of extended exchange
  - [x] display renegade mark prices from websocket
- [ ] future ntegrations: zeta perps, raydium perps, jupiter perps, adrena perps
  - [ ] look into JLP strategy

## futarchy arb
- [ ] display the delta between pass/fail markets and mark price of spot asset
  - [ ] https://github.com/metaDAOproject/futarchy-sdk
  - [ ] https://github.com/metaDAOproject/hermes/blob/main/src/swap.ts

## pumpfun AI analyst
- [ ] get latest graduated pump fun's (monitor raydium pools neding in pump?)
- [ ] pull necessary links and metadata
  - [ ] twitter
  - [ ] description
- [ ] aggregate all the data into single json text block
- [ ] create a prompt for analysing bullishness/bearishness and give score to buy or not
- [ ] automate buying

## real-time news aggregator
- [ ] RSS feed
  - [ ] get a collection of important RSS feeds
  - [ ] create a parser for feeds
  - [ ] extract key info like asset names
- [ ] Twitter aggregator
  - [ ] create a collection of high value accounts
  - [ ] create a parser for tweets

## bugs
- [ ] Bugs with the trading flow factory components
  - [ ] the trade flow component isnt labelling properly for market orders
  - [ ] the trade flow component doesnt list the flow in the order the user creats the flow in (it defaults to take profit then stop loss)

## todo
- [ ] ability to move takeP/stopL levels via click and drag
- [ ] display pumpfun charts via web sockets
