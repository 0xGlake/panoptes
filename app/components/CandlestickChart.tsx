import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";

// interface TradeData {
//   m: string;
//   S: string;
//   tT: string;
//   T: number;
//   p: string;
//   q: string;
//   i: number;
// }

// interface OrderBookData {
//   m: string;
//   b: Array<{ p: string; q: string }>;
//   a: Array<{ p: string; q: string }>;
// }

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

const WS_BASE_URL = "wss://api.extended.exchange";

interface Props {
  symbols: string[];
}

const CandlestickChart: React.FC<Props> = ({ symbols }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState<string>("");
  const currentCandleRef = useRef<CandleData | null>(null);
  const bidLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const askLineRef = useRef<ISeriesApi<"Line"> | null>(null);

  const resetChart = () => {
    // Clear existing data
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
    // Reset connection status
    setConnectionStatus("disconnected");
    // Close existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Handle search and suggestions
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setSearchTerm(value);

    if (value) {
      const filtered = symbols.filter((symbol: string) =>
        symbol.includes(value),
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    if (currentSymbol !== symbol) {
      resetChart();
      setCurrentSymbol(symbol);
      setSearchTerm(symbol);
      setShowSuggestions(false);
      initializeWebSockets(symbol);
    }
  };

  // WebSocket handling
  const initializeWebSockets = (symbol: string) => {
    // Close existing connections
    resetChart();
    setConnectionStatus("connecting");

    try {
      // Create WebSocket for trades
      const tradesWs = new WebSocket(
        `${WS_BASE_URL}/stream.extended.exchange/v1/publicTrades/${symbol}`,
      );

      // Create WebSocket for orderbook
      const orderbookWs = new WebSocket(
        `${WS_BASE_URL}/stream.extended.exchange/v1/orderbooks/${symbol}?depth=1`,
      );

      tradesWs.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.data.length > 0) {
            const trade = response.data[0];
            const price = parseFloat(trade.p);
            const timestamp = Math.floor(trade.T / 1000);
            const minuteStart = timestamp - (timestamp % 60);

            if (
              !currentCandleRef.current ||
              currentCandleRef.current.time !== (minuteStart as Time)
            ) {
              // Start new candle
              if (currentCandleRef.current) {
                seriesRef.current?.update(currentCandleRef.current);
              }

              currentCandleRef.current = {
                time: minuteStart as Time,
                open: price,
                high: price,
                low: price,
                close: price,
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
              currentCandleRef.current.close = price;
            }

            seriesRef.current?.update(currentCandleRef.current);
          }
        } catch (error) {
          console.error("Error processing trade:", error);
        }
      };

      orderbookWs.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.data) {
            const timestamp = Math.floor(response.ts / 1000);
            const bid = parseFloat(response.data.b[0].p);
            const ask = parseFloat(response.data.a[0].p);

            bidLineRef.current?.update({ time: timestamp as Time, value: bid });
            askLineRef.current?.update({ time: timestamp as Time, value: ask });
          }
        } catch (error) {
          console.error("Error processing orderbook:", error);
        }
      };

      // Handle connection states
      [tradesWs, orderbookWs].forEach((ws) => {
        ws.onopen = () => setConnectionStatus("connected");
        ws.onerror = () => setConnectionStatus("error");
        ws.onclose = () => setConnectionStatus("disconnected");
      });

      wsRef.current = tradesWs; // Store reference for cleanup
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      setConnectionStatus("error");
    }
  };

  // Chart initialization
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

      // const candlestickSeries = chart.addCandlestickSeries({
      //   upColor: "#26a69a",
      //   downColor: "#ef5350",
      //   borderVisible: false,
      //   wickUpColor: "#26a69a",
      //   wickDownColor: "#ef5350",
      // });

      // Add bid-ask lines
      const bidLine = chart.addLineSeries({
        color: "#26a69a",
        lineWidth: 1,
        lineStyle: 2, // Dashed line
      });

      const askLine = chart.addLineSeries({
        color: "#ef5350",
        lineWidth: 1,
        lineStyle: 2, // Dashed line
      });

      chartRef.current = chart;
      // seriesRef.current = candlestickSeries;
      bidLineRef.current = bidLine;
      askLineRef.current = askLine;
    }

    return () => {
      resetChart();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        bidLineRef.current = null;
        askLineRef.current = null;
      }
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      resetChart();
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      <div className="relative w-full max-w-md mb-4 text-gray-800">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search symbol..."
          className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-10">
            {suggestions.map((symbol) => (
              <div
                key={symbol}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handleSelectSymbol(symbol)}
              >
                {symbol}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-2">
        Connection Status:
        <span
          className={`ml-2 px-2 py-1 rounded ${
            connectionStatus === "connected"
              ? "bg-green-500 text-white"
              : connectionStatus === "connecting"
                ? "bg-yellow-500 text-white"
                : connectionStatus === "error"
                  ? "bg-red-500 text-white"
                  : "bg-gray-500 text-white"
          }`}
        >
          {connectionStatus}
        </span>
      </div>

      <div ref={containerRef} className="border rounded shadow-lg" />
    </div>
  );
};

export default CandlestickChart;
