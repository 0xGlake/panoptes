import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { TOKENS } from "../types/tokens";

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

const RenegadeCandlestickChart: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState(TOKENS[2]);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentCandleRef = useRef<CandleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentTopicRef = useRef<string>("");

  const { sendMessage, readyState, lastMessage } = useWebSocket(
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
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // Handle WebSocket messages and create candles
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (data.price) {
          const currentTime = Math.floor(Date.now() / 1000);
          const minuteStart = currentTime - (currentTime % 60);

          if (
            !currentCandleRef.current ||
            currentCandleRef.current.time !== (minuteStart as Time)
          ) {
            if (currentCandleRef.current) {
              seriesRef.current?.update(currentCandleRef.current);
            }

            currentCandleRef.current = {
              time: minuteStart as Time,
              open: data.price,
              high: data.price,
              low: data.price,
              close: data.price,
            };
          } else {
            currentCandleRef.current.high = Math.max(
              currentCandleRef.current.high,
              data.price,
            );
            currentCandleRef.current.low = Math.min(
              currentCandleRef.current.low,
              data.price,
            );
            currentCandleRef.current.close = data.price;
          }

          seriesRef.current?.update(currentCandleRef.current);
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }
  }, [lastMessage]);

  // Handle subscription changes
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      // Unsubscribe from previous topic
      if (currentTopicRef.current) {
        const unsubscribeMessage = {
          method: "unsubscribe",
          topic: currentTopicRef.current,
        };
        sendMessage(JSON.stringify(unsubscribeMessage));
      }

      // Subscribe to new topic
      const USDT = TOKENS.find((t) => t.ticker === "USDT")!;
      const newTopic = `binance-${selectedToken.address}-${USDT.address}`;
      currentTopicRef.current = newTopic;

      const subscribeMessage = {
        method: "subscribe",
        topic: newTopic,
      };

      // Reset current candle and chart data
      currentCandleRef.current = null;
      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }

      sendMessage(JSON.stringify(subscribeMessage));
    }
  }, [readyState, sendMessage, selectedToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentTopicRef.current && readyState === ReadyState.OPEN) {
        const unsubscribeMessage = {
          method: "unsubscribe",
          topic: currentTopicRef.current,
        };
        sendMessage(JSON.stringify(unsubscribeMessage));
      }
    };
  }, [readyState, sendMessage]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      <div className="w-full max-w-md mb-4">
        <select
          className="w-full px-4 py-2 border rounded bg-gray-800 text-white"
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

      <div className="mb-2 text-white">
        Status: {ReadyState[readyState]}
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>

      <div ref={containerRef} className="border rounded shadow-lg" />
    </div>
  );
};

export default RenegadeCandlestickChart;
