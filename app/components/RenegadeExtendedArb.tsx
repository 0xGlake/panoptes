import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { ArbitrageToken, ARBITRAGE_TOKENS } from "../types/arbitrageTokens";
import { TOKENS } from "../types/tokens";

const WS_BASE_URL = "wss://api.extended.exchange";
const RENEGADE_WS_URL = "wss://mainnet.price-reporter.renegade.fi:4000";

const RenegadeExtendedArb: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<ArbitrageToken>(
    ARBITRAGE_TOKENS[0],
  );
  const currentTopicRef = useRef<string>("");

  // Refs for chart
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRefs = useRef<{
    chart: IChartApi | null;
    renegadeLine: ISeriesApi<"Line"> | null;
    extendedBidLine: ISeriesApi<"Line"> | null;
    extendedAskLine: ISeriesApi<"Line"> | null;
  }>({
    chart: null,
    renegadeLine: null,
    extendedBidLine: null,
    extendedAskLine: null,
  });

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current || chartRefs.current.chart) return;

    const chart = createChart(containerRef.current, {
      width: 800,
      height: 400,
      layout: {
        background: { color: "#1a1a1a" },
        textColor: "#d1d4dc",
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      grid: {
        vertLines: {
          color: "rgba(42, 46, 57, 0.3)", // More transparent grid lines
        },
        horzLines: {
          color: "rgba(42, 46, 57, 0.3)", // More transparent grid lines
        },
      },
    });

    const renegadeLine = chart.addLineSeries({
      color: "#4299e1",
      title: "Renegade Price",
    });

    const extendedBidLine = chart.addLineSeries({
      color: "#26a69a",
      title: "Extended Bid",
      lineStyle: 1,
    });

    const extendedAskLine = chart.addLineSeries({
      color: "#ef5350",
      title: "Extended Ask",
      lineStyle: 1,
    });

    chartRefs.current = {
      chart,
      renegadeLine,
      extendedBidLine,
      extendedAskLine,
    };

    return () => {
      chart.remove();
      chartRefs.current = {
        chart: null,
        renegadeLine: null,
        extendedBidLine: null,
        extendedAskLine: null,
      };
    };
  }, []);

  // Renegade WebSocket
  const {
    sendMessage: sendRenegadeMessage,
    readyState: renegadeReadyState,
    lastMessage: renegadeMessage,
  } = useWebSocket(RENEGADE_WS_URL, {
    onOpen: () => console.log("Renegade WS Connected"),
    share: true,
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10,
  });

  // Extended WebSocket
  const { lastMessage: extendedMessage } = useWebSocket(
    `${WS_BASE_URL}/stream.extended.exchange/v1/orderbooks/${selectedToken.extendedSymbol}?depth=1`,
    {
      onOpen: () => console.log("Extended WS Connected"),
      shouldReconnect: () => true,
    },
  );

  // Handle Renegade subscription
  useEffect(() => {
    if (renegadeReadyState === ReadyState.OPEN) {
      if (currentTopicRef.current) {
        const unsubscribeMessage = {
          method: "unsubscribe",
          topic: currentTopicRef.current,
        };
        sendRenegadeMessage(JSON.stringify(unsubscribeMessage));
      }

      // renaged topic format: is renageade address, then usdt token address
      const USDT = TOKENS.find((t) => t.ticker === "USDT")!;
      const SELECTED_TOKEN = TOKENS.find(
        (t) => t.ticker === selectedToken.renegadeSymbol,
      )!;
      const newTopic = `binance-${SELECTED_TOKEN.address}-${USDT.address}`;
      currentTopicRef.current = newTopic;

      const subscribeMessage = {
        method: "subscribe",
        topic: newTopic,
      };

      console.log("Subscribing to Renegade:", subscribeMessage);
      sendRenegadeMessage(JSON.stringify(subscribeMessage));
    }
  }, [renegadeReadyState, sendRenegadeMessage, selectedToken]);

  // Handle Renegade messages
  useEffect(() => {
    if (!renegadeMessage?.data) return;

    try {
      const data = JSON.parse(renegadeMessage.data);
      if (data.price == undefined) {
        console.log(
          "Received no price, subscription message or error:",
          renegadeMessage.data,
        );
        return;
      }

      const localTimestamp = Math.floor(Date.now() / 1000) as Time;

      chartRefs.current.renegadeLine?.update({
        time: localTimestamp,
        value: data.price,
      });
    } catch (error) {
      console.error("Error processing Renegade message:", error);
    }
  }, [renegadeMessage, renegadeReadyState]);

  // Handle Extended messages
  useEffect(() => {
    if (!extendedMessage?.data) return;

    try {
      const data = JSON.parse(extendedMessage.data);
      const timestamp = Math.floor(data.ts / 1000) as Time;

      if (data.data?.b?.[0] && data.data?.a?.[0]) {
        const bid = parseFloat(data.data.b[0].p);
        const ask = parseFloat(data.data.a[0].p);

        chartRefs.current.extendedBidLine?.update({
          time: timestamp,
          value: bid,
        });

        chartRefs.current.extendedAskLine?.update({
          time: timestamp,
          value: ask,
        });
      }
    } catch (error) {
      console.error("Extended message error:", error);
    }
  }, [extendedMessage]);

  // Cleanup on unmount: TODO check this logic
  useEffect(() => {
    return () => {
      if (currentTopicRef.current && renegadeReadyState === ReadyState.OPEN) {
        const unsubscribeMessage = {
          method: "unsubscribe",
          topic: currentTopicRef.current,
        };
        sendRenegadeMessage(JSON.stringify(unsubscribeMessage));
      }
    };
  }, [renegadeReadyState, sendRenegadeMessage]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      <select
        className="w-full max-w-md mb-4 p-2 rounded bg-gray-800 text-white"
        value={selectedToken.name}
        onChange={(e) => {
          const token = ARBITRAGE_TOKENS.find((t) => t.name === e.target.value);
          if (token) setSelectedToken(token);
        }}
      >
        {ARBITRAGE_TOKENS.map((token) => (
          <option key={token.name} value={token.name}>
            {token.name} ({token.extendedSymbol} ⟷ {token.renegadeSymbol})
          </option>
        ))}
      </select>

      <div className="mb-4 text-white">
        WebSocket Status:{" "}
        {renegadeReadyState === ReadyState.OPEN
          ? "Connected"
          : renegadeReadyState === ReadyState.CONNECTING
            ? "Connecting"
            : "Closed"}
      </div>
      <div ref={containerRef} className="border rounded shadow-lg" />
    </div>
  );
};

export default RenegadeExtendedArb;
