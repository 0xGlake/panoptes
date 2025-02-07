import React from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { TOKENS } from "../types/tokens";

const formatCurrency = (value: number, decimals: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

const PriceStreamer = () => {
  const [selectedToken, setSelectedToken] = React.useState(TOKENS[2]); // Default to WBTC
  const [price, setPrice] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const { sendMessage, readyState, lastMessage } = useWebSocket(
    "wss://mainnet.price-reporter.renegade.fi:4000",
    {
      share: true,
      filter: () => false,
      onMessage: (event) => {
        try {
          console.log("Raw WebSocket message:", event.data);

          if (event.data.startsWith("InvalidPairInfo")) {
            setError(event.data);
            return;
          }

          const data = JSON.parse(event.data);
          console.log("Parsed data:", data);

          if (!data) return;
          if (data.error) {
            setError(data.error);
            return;
          }

          if (data.price) {
            setPrice(data.price);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          if (
            typeof event.data === "string" &&
            !event.data.startsWith("InvalidPairInfo")
          ) {
            setError(`Failed to parse message: ${error}`);
          }
        }
      },
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      reconnectAttempts: 10,
    },
  );

  // Subscribe when connected or token changes
  React.useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      // Clear previous price when changing tokens
      setPrice(null);
      setError(null);

      const USDT = TOKENS.find((t) => t.ticker === "USDT")!;
      const topic = `binance-${selectedToken.address}-${USDT.address}`;
      const subscribeMessage = {
        method: "subscribe",
        topic,
      };

      console.log("Subscribing to:", topic);
      sendMessage(JSON.stringify(subscribeMessage));
    }
  }, [readyState, sendMessage, selectedToken]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting...",
    [ReadyState.OPEN]: "Connected",
    [ReadyState.CLOSING]: "Closing...",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return (
    <div className="p-4 rounded-lg bg-gray-800 text-white">
      <div className="mb-4">
        <label
          htmlFor="token-select"
          className="block text-sm font-medium mb-2"
        >
          Select Token
        </label>
        <select
          id="token-select"
          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

      <h2 className="text-lg font-semibold mb-2">
        {selectedToken.ticker} Price
      </h2>
      <div className="text-2xl">
        {price ? formatCurrency(price, selectedToken.decimals) : "Loading..."}
      </div>
      <div className="text-sm text-gray-400 mt-2">
        Status: {connectionStatus}
      </div>
      {error && <div className="text-red-500 mt-2 text-sm">Error: {error}</div>}
      {lastMessage &&
        lastMessage.data &&
        !lastMessage.data.startsWith("InvalidPairInfo") && (
          <div className="text-xs text-gray-500 mt-2 overflow-hidden text-ellipsis">
            Last message: {lastMessage.data}
          </div>
        )}
    </div>
  );
};

export default PriceStreamer;
