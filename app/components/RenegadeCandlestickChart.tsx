import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";

// Import TOKENS from your existing RenegadeTest component
import { TOKENS } from "./RenegadeTest"; // Adjust import path as needed

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const RenegadeCandlestickChart: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState(TOKENS[2]); // Default to WBTC
  const [currentCandle, setCurrentCandle] = useState<Candle | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // WebSocket connection
  const { readyState, lastMessage } = useWebSocket(
    "wss://mainnet.price-reporter.renegade.fi:4000",
    {
      share: true,
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      reconnectAttempts: 10,
    },
  );

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

      return () => {
        chart.remove();
      };
    }
  }, []);

  // Subscribe to price feed when token changes
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      const USDT = TOKENS.find((t) => t.ticker === "USDT")!;
      const topic = `binance-${selectedToken.address}-${USDT.address}`;
      const subscribeMessage = {
        method: "subscribe",
        topic,
      };

      // Reset candles when changing tokens
      setCandles([]);
      setCurrentCandle(null);

      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }

      console.log("Subscribing to:", topic);
      // Send subscription message
      if (webSocket.current) {
        webSocket.current.send(JSON.stringify(subscribeMessage));
      }
    }
  }, [readyState, selectedToken]);

  // Process incoming messages and update candles
  useEffect(() => {
    if (!lastMessage?.data) return;

    try {
      const data = JSON.parse(lastMessage.data);
      if (!data.price) return;

      const currentTime = Math.floor(Date.now() / 1000);
      const minuteStart = currentTime - (currentTime % 60);

      if (!currentCandle || currentCandle.time !== minuteStart) {
        // Start new candle
        if (currentCandle) {
          setCandles((prev) => [...prev, currentCandle]);
        }

        setCurrentCandle({
          time: minuteStart,
          open: data.price,
          high: data.price,
          low: data.price,
          close: data.price,
        });
      } else {
        // Update current candle
        setCurrentCandle((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            high: Math.max(prev.high, data.price),
            low: Math.min(prev.low, data.price),
            close: data.price,
          };
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }, [lastMessage]);

  // Update chart with new candles
  useEffect(() => {
    if (seriesRef.current) {
      const allCandles = [...candles];
      if (currentCandle) {
        allCandles.push(currentCandle);
      }
      seriesRef.current.setData(allCandles);
    }
  }, [candles, currentCandle]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      <div className="mb-4 w-full max-w-md">
        <select
          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
          value={selectedToken.ticker}
          onChange={(e) => {
            const token = TOKENS.find((t) => t.ticker === e.target.value);
            if (token) setSelectedToken(token);
          }}
        >
          {TOKENS.map((token) => (
            <option key={token.ticker} value={token.ticker}>
              {token.name} ({token.ticker})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2">
        Status:{" "}
        <span
          className={`px-2 py-1 rounded ${
            readyState === ReadyState.OPEN
              ? "bg-green-500"
              : readyState === ReadyState.CONNECTING
                ? "bg-yellow-500"
                : "bg-red-500"
          } text-white`}
        >
          {ReadyState[readyState]}
        </span>
      </div>

      <div ref={containerRef} className="border border-gray-700 rounded" />
    </div>
  );
};

export default RenegadeCandlestickChart;
