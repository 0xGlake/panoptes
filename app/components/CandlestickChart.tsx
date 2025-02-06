import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";

interface CandleData {
  T: number;
  o: string;
  l: string;
  h: string;
  c: string;
  v: string;
}

interface StreamResponse {
  ts: number;
  data: CandleData[];
  seq: number;
}

interface Props {
  symbols: string[];
}

const WS_BASE_URL = "wss://api.extended.exchange";

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
      const filtered = symbols.filter((symbol) => symbol.includes(value));
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
      initializeWebSocket(symbol);
    }
  };

  // WebSocket handling
  const initializeWebSocket = (symbol: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(
        `${WS_BASE_URL}/stream.extended.exchange/v1/candles/${symbol}/trades?interval=PT1M`,
      );

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const response: StreamResponse = JSON.parse(event.data);
          console.log("Received candle data:", response.data); // Debug log

          if (response.data.length > 0) {
            const candle = response.data[0];
            console.log("Processing candle:", {
              time: new Date(candle.T).toISOString(),
              open: candle.o,
              high: candle.h,
              low: candle.l,
              close: candle.c,
              volume: candle.v,
            });

            const candleData = {
              time: candle.T / 1000,
              open: parseFloat(candle.o),
              low: parseFloat(candle.l),
              high: parseFloat(candle.h),
              close: parseFloat(candle.c),
            };

            if (seriesRef.current) {
              seriesRef.current.update(candleData);
            }
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setConnectionStatus("disconnected");
      };

      wsRef.current = ws;
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
          background: { color: "#ffffff" },
          textColor: "#333",
        },
        grid: {
          vertLines: { color: "#f0f0f0" },
          horzLines: { color: "#f0f0f0" },
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
      resetChart();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
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
