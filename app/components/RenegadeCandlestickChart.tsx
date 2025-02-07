import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { TOKENS } from "../types/tokens";

interface CandleStick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CurrentCandle {
  open: number;
  high: number;
  low: number;
  prices: number[];
  startTime: number;
}

const RenegadeCandlestickChart: React.FC<{ tokens: typeof TOKENS }> = ({
  tokens,
}) => {
  const [selectedToken, setSelectedToken] = useState(tokens[2]); // Default to WBTC
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentCandleRef = useRef<CurrentCandle | null>(null);
  const [candlesticks, setCandlesticks] = useState<CandleStick[]>([]);

  // WebSocket connection
  const { readyState, lastMessage } = useWebSocket(
    "wss://mainnet.price-reporter.renegade.fi:4000",
    {
      share: true,
      onMessage: (event) => {
        try {
          if (event.data.startsWith("InvalidPairInfo")) return;

          const data = JSON.parse(event.data);
          if (!data || !data.price) return;

          updateCandle(data.price);
        } catch (error) {
          console.error("Error processing message:", error);
        }
      },
      shouldReconnect: () => true,
    },
  );

  const updateCandle = (price: number) => {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;

    if (
      !currentCandleRef.current ||
      currentCandleRef.current.startTime < currentMinute
    ) {
      // Create new candle
      if (currentCandleRef.current) {
        // Save the previous candle
        const newCandle: CandleStick = {
          time: currentCandleRef.current.startTime / 1000,
          open: currentCandleRef.current.open,
          high: currentCandleRef.current.high,
          low: currentCandleRef.current.low,
          close:
            currentCandleRef.current.prices[
              currentCandleRef.current.prices.length - 1
            ],
        };
        setCandlesticks((prev) => [...prev, newCandle]);
        if (seriesRef.current) {
          seriesRef.current.update(newCandle);
        }
      }

      // Start new candle
      currentCandleRef.current = {
        open: price,
        high: price,
        low: price,
        prices: [price],
        startTime: currentMinute,
      };
    } else {
      // Update current candle
      currentCandleRef.current.high = Math.max(
        currentCandleRef.current.high,
        price,
      );
      currentCandleRef.current.low = Math.min(
        currentCandleRef.current.low,
        price,
      );
      currentCandleRef.current.prices.push(price);
    }
  };

  // Initialize chart
  useEffect(() => {
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
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });

      chartRef.current = chart;
      seriesRef.current = candlestickSeries;
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // Subscribe to WebSocket when token changes
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      const USDT = tokens.find((t) => t.ticker === "USDT")!;
      const topic = `binance-${selectedToken.address}-${USDT.address}`;
      const subscribeMessage = {
        method: "subscribe",
        topic,
      };

      // Reset current data
      currentCandleRef.current = null;
      setCandlesticks([]);
      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }
    }
  }, [readyState, selectedToken, tokens]);

  return (
    <div className="p-4 rounded-lg bg-gray-800 text-white">
      <div className="mb-4">
        <select
          className="w-full p-2 rounded bg-gray-700 text-white"
          value={selectedToken.ticker}
          onChange={(e) => {
            const token = tokens.find((t) => t.ticker === e.target.value);
            if (token) setSelectedToken(token);
          }}
        >
          {tokens.map((token) => (
            <option key={token.ticker} value={token.ticker}>
              {token.name} ({token.ticker})
            </option>
          ))}
        </select>
      </div>
      <div ref={containerRef} className="mt-4" />
      <div className="text-sm text-gray-400 mt-2">
        Status: {ReadyState[readyState]}
      </div>
    </div>
  );
};

export default RenegadeCandlestickChart;
