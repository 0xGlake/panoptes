import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import useWebSocket from "react-use-websocket";
import { TOKENS } from "../types/tokens";
import { ArbitrageToken, ARBITRAGE_TOKENS } from "../types/arbitrageTokens";

const WS_BASE_URL = "wss://api.extended.exchange";

const RenegadeExtendedArb: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<ArbitrageToken>(
    ARBITRAGE_TOKENS[0],
  );
  const chartRef = useRef<IChartApi | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renegadePriceRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bidLinesRef = useRef<ISeriesApi<"Line">[]>([]);
  const askLinesRef = useRef<ISeriesApi<"Line">[]>([]);
  const [arbOpportunity, setArbOpportunity] = useState<{
    type: "BUY" | "SELL" | "NONE";
    difference: number;
  }>({ type: "NONE", difference: 0 });

  // Renegade WebSocket
  const { lastMessage: renegadeMessage } = useWebSocket(
    "wss://mainnet.price-reporter.renegade.fi:4000",
    {
      share: true,
      shouldReconnect: () => true,
    },
  );

  // Extended Exchange WebSocket
  const { lastMessage: extendedMessage } = useWebSocket(
    `${WS_BASE_URL}/stream.extended.exchange/v1/orderbooks/${selectedToken.ticker}-USD?depth=5`,
    {
      share: true,
      shouldReconnect: () => true,
    },
  );

  // Initialize chart
  useEffect(() => {
    TOKENS.map((token) => console.log(token.ticker));

    if (containerRef.current && !chartRef.current) {
      const chart = createChart(containerRef.current, {
        width: 800,
        height: 400,
        layout: {
          background: { color: "#1a1a1a" },
          textColor: "#d1d4dc",
        },
        grid: {
          vertLines: { color: "#2a2a2a" },
          horzLines: { color: "#2a2a2a" },
        },
        rightPriceScale: {
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
      });

      // Create Renegade price line (solid blue)
      const renegadeLine = chart.addLineSeries({
        color: "#4299e1",
        lineWidth: 2,
        title: "Renegade Price",
      });

      // Create 5 bid and ask lines
      for (let i = 0; i < 5; i++) {
        const bidLine = chart.addLineSeries({
          color: "#26a69a",
          lineWidth: 1,
          lineStyle: 2,
          title: `Bid ${i + 1}`,
        });

        const askLine = chart.addLineSeries({
          color: "#ef5350",
          lineWidth: 1,
          lineStyle: 2,
          title: `Ask ${i + 1}`,
        });

        bidLinesRef.current.push(bidLine);
        askLinesRef.current.push(askLine);
      }

      chartRef.current = chart;
      renegadePriceRef.current = renegadeLine;
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        renegadePriceRef.current = null;
        bidLinesRef.current = [];
        askLinesRef.current = [];
      }
    };
  }, []);

  // Handle Extended Exchange messages
  useEffect(() => {
    if (extendedMessage?.data) {
      try {
        const response = JSON.parse(extendedMessage.data);
        const timestamp = Math.floor(response.ts / 1000) as Time;

        // Update bid lines
        response.data.b.forEach(
          (bid: { p: string; q: string }, index: number) => {
            if (index < 5) {
              bidLinesRef.current[index]?.update({
                time: timestamp,
                value: parseFloat(bid.p),
              });
            }
          },
        );

        // Update ask lines
        response.data.a.forEach(
          (ask: { p: string; q: string }, index: number) => {
            if (index < 5) {
              askLinesRef.current[index]?.update({
                time: timestamp,
                value: parseFloat(ask.p),
              });
            }
          },
        );
      } catch (error) {
        console.error("Error processing Extended Exchange message:", error);
      }
    }
  }, [extendedMessage]);

  // Handle Renegade messages
  useEffect(() => {
    if (renegadeMessage?.data) {
      try {
        const data = JSON.parse(renegadeMessage.data);
        if (data.price) {
          const timestamp = Math.floor(Date.now() / 1000) as Time;
          renegadePriceRef.current?.update({
            time: timestamp,
            value: data.price,
          });

          // Calculate arbitrage opportunity
          const bestBid = parseFloat(
            JSON.parse(extendedMessage?.data || '{"data":{"b":[{"p":"0"}]}}')
              .data.b[0].p,
          );
          const bestAsk = parseFloat(
            JSON.parse(extendedMessage?.data || '{"data":{"a":[{"p":"0"}]}}')
              .data.a[0].p,
          );

          if (data.price > bestAsk) {
            setArbOpportunity({
              type: "SELL",
              difference: data.price - bestAsk,
            });
          } else if (data.price < bestBid) {
            setArbOpportunity({
              type: "BUY",
              difference: bestBid - data.price,
            });
          } else {
            setArbOpportunity({ type: "NONE", difference: 0 });
          }
        }
      } catch (error) {
        console.error("Error processing Renegade message:", error);
      }
    }
  }, [renegadeMessage, extendedMessage]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      <div className="w-full max-w-md mb-4">
        <select
          className="w-full px-4 py-2 border rounded bg-gray-800 text-white"
          value={selectedToken.name}
          onChange={(e) => {
            const token = ARBITRAGE_TOKENS.find(
              (t) => t.name === e.target.value,
            );
            if (token) setSelectedToken(token);
          }}
        >
          {ARBITRAGE_TOKENS.map((token) => (
            <option key={token.name} value={token.name}>
              {token.name} ({token.extendedSymbol} ⟷ {token.renegadeSymbol})
            </option>
          ))}
        </select>
      </div>

      {arbOpportunity.type !== "NONE" && (
        <div
          className={`mb-4 p-2 rounded ${
            arbOpportunity.type === "BUY" ? "bg-green-500" : "bg-red-500"
          } text-white`}
        >
          {arbOpportunity.type} Opportunity: $
          {arbOpportunity.difference.toFixed(2)}
        </div>
      )}

      <div ref={containerRef} className="border rounded shadow-lg" />
    </div>
  );
};

export default RenegadeExtendedArb;
