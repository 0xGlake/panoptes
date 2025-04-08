import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  IPriceLine,
  LineStyle,
} from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { ArbitrageToken, ARBITRAGE_TOKENS } from "../types/arbitrageTokens";

const WS_BASE_URL = "wss://api.extended.exchange";

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradeMacroState {
  active: boolean;
  entryPrice: number | null;
  entryLine: IPriceLine | null;
}

const TradingInterface: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<ArbitrageToken>(
    ARBITRAGE_TOKENS[0],
  );
  const [macroState, setMacroState] = useState<TradeMacroState>({
    active: false,
    entryPrice: null,
    entryLine: null,
  });

  // Track if user has manually positioned the chart
  const userPositionedChart = useRef(false);
  const lastPrice = useRef<number | null>(null);

  // Refs for chart
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRefs = useRef<{
    chart: IChartApi | null;
    candleSeries: ISeriesApi<"Candlestick"> | null;
    currentMinute: number;
    currentCandle: CandleData | null;
    candles: CandleData[];
  }>({
    chart: null,
    candleSeries: null,
    currentMinute: -1,
    currentCandle: null,
    candles: [],
  });

  // Handle Shift+T keypress to toggle trade macro mode
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "T" && event.shiftKey) {
      event.preventDefault();
      setMacroState((prev) => ({
        ...prev,
        active: !prev.active,
      }));
    }
  }, []);

  // Handle chart clicks for setting entry price when macro is active
  const handleChartClick = useCallback(
    (e: MouseEvent) => {
      if (
        !macroState.active ||
        !chartRefs.current.chart ||
        !chartRefs.current.candleSeries
      ) {
        return;
      }

      // Get chart container dimensions and position
      const chartContainer = containerRef.current;
      if (!chartContainer) return;

      const rect = chartContainer.getBoundingClientRect();

      // Calculate relative position within the chart
      //const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      console.log("Click event:", {
        clientY: e.clientY,
        rectTop: rect.top,
        relativeY: y,
        containerHeight: rect.height,
      });

      // Convert chart-relative coordinates to price
      const price = chartRefs.current.candleSeries.coordinateToPrice(y);

      console.log("Calculated price:", price);

      if (price === null) return;

      // Rest of the function remains the same...
      // Remove existing entry line if it exists
      if (macroState.entryLine && chartRefs.current.candleSeries) {
        chartRefs.current.candleSeries.removePriceLine(macroState.entryLine);
      }

      // Create new entry line
      const entryLine = chartRefs.current.candleSeries.createPriceLine({
        price: price,
        color: "#4CAF50",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Entry",
      });

      setMacroState((prev) => ({
        ...prev,
        entryPrice: price,
        entryLine: entryLine,
      }));
    },
    [macroState.active, macroState.entryLine],
  );

  // Initialize chart, and reset on container or token change
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart if it exists
    if (chartRefs.current.chart) {
      chartRefs.current.chart.remove();
    }

    // Reset tracking variables
    userPositionedChart.current = false;
    lastPrice.current = null;

    // Create new chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
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
          color: "rgba(42, 46, 57, 0.2)",
        },
        horzLines: {
          color: "rgba(42, 46, 57, 0.2)",
        },
      },
      crosshair: {
        // Disable crosshair magnet mode
        mode: 0,
        // Style crosshair lines
        vertLine: {
          color: "rgba(224, 227, 235, 0.4)",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "rgba(224, 227, 235, 0.4)",
          width: 1,
          style: 2,
        },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // Store references
    chartRefs.current = {
      chart,
      candleSeries,
      currentMinute: -1,
      currentCandle: null,
      candles: [],
    };

    // Detect when user manually positions the chart
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      userPositionedChart.current = true;
    });

    // Make chart responsive
    const handleResize = () => {
      if (containerRef.current && chartRefs.current.chart) {
        chartRefs.current.chart.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    if (chartRefs.current.candleSeries) {
      // Start with empty candles
      chartRefs.current.candleSeries.setData([]);
    }

    // Auto-fit content initially
    chart.timeScale().fitContent();

    // Reset macro state
    setMacroState({
      active: false,
      entryPrice: null,
      entryLine: null,
    });

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [selectedToken]);

  // Set up event listeners for keyboard and mouse
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    const containerElement = containerRef.current;
    if (containerElement) {
      containerElement.addEventListener("click", handleChartClick);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (containerElement) {
        containerElement.removeEventListener("click", handleChartClick);
      }
    };
  }, [handleKeyDown, handleChartClick]);

  // Update cursor style based on macro mode
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = macroState.active
        ? "crosshair"
        : "default";
    }
  }, [macroState.active]);

  // Extended exchange WebSocket connection
  const { lastMessage: extendedMessage, readyState: extendedReadyState } =
    useWebSocket(
      `${WS_BASE_URL}/stream.extended.exchange/v1/orderbooks/${selectedToken.extendedSymbol}?depth=1`,
      {
        onOpen: () => console.log("Extended Exchange WebSocket Connected"),
        shouldReconnect: () => true,
        reconnectInterval: 3000,
        reconnectAttempts: 10,
      },
    );

  // Handle Extended exchange messages and update candles
  useEffect(() => {
    if (!extendedMessage?.data || !chartRefs.current.candleSeries) return;

    try {
      const data = JSON.parse(extendedMessage.data);

      if (data.data?.a?.[0]) {
        const askPrice = parseFloat(data.data.a[0].p);
        const timestamp = data.ts; // milliseconds

        // Save last price for continuity between candles
        if (lastPrice.current === null) {
          lastPrice.current = askPrice;
        }

        // Convert to minutes for candle grouping
        const currentMinute = Math.floor(timestamp / (60 * 1000));

        // Create UTC timestamp for lightweight-charts (seconds)
        const utcTimestamp = Math.floor(currentMinute * 60) as UTCTimestamp;

        // Check if this is a new minute
        if (currentMinute !== chartRefs.current.currentMinute) {
          // If we had a previous candle, finalize it
          if (chartRefs.current.currentCandle) {
            // Ensure the close price is captured
            chartRefs.current.currentCandle.close = lastPrice.current;

            // Add to our array of candles
            chartRefs.current.candles.push({
              ...chartRefs.current.currentCandle,
            });
          }

          // Start a new candle - use the last price as the opening price
          chartRefs.current.currentMinute = currentMinute;
          chartRefs.current.currentCandle = {
            time: utcTimestamp,
            open: lastPrice.current,
            high: askPrice,
            low: askPrice,
            close: askPrice,
          };

          // Only scroll to the latest candle if user hasn't positioned the chart
          if (!userPositionedChart.current && chartRefs.current.chart) {
            chartRefs.current.chart.timeScale().scrollToPosition(0, false);
          }
        } else if (chartRefs.current.currentCandle) {
          // Update existing candle
          const candle = chartRefs.current.currentCandle;

          // Update high/low
          if (askPrice > candle.high) candle.high = askPrice;
          if (askPrice < candle.low) candle.low = askPrice;

          // Always update close price
          candle.close = askPrice;
        }

        // Update the series with live data
        const updatedCandles = [...chartRefs.current.candles];
        if (chartRefs.current.currentCandle) {
          updatedCandles.push(chartRefs.current.currentCandle);
        }
        chartRefs.current.candleSeries.setData(updatedCandles);

        // Update the last price for the next update
        lastPrice.current = askPrice;
      }
    } catch (error) {
      console.error("Error processing Extended exchange message:", error);
    }
  }, [extendedMessage]);

  return (
    <div className="flex flex-col items-center w-full max-w-5xl">
      <div className="w-full flex justify-between items-center mb-4">
        <select
          className="p-2 rounded bg-gray-800 text-white"
          value={selectedToken.name}
          onChange={(e) => {
            const token = ARBITRAGE_TOKENS.find(
              (t) => t.name === e.target.value,
            );
            if (token) {
              setSelectedToken(token);
              // Reset tracking variables
              chartRefs.current.currentMinute = -1;
              chartRefs.current.currentCandle = null;
              chartRefs.current.candles = [];
              lastPrice.current = null;
              userPositionedChart.current = false;
            }
          }}
        >
          {ARBITRAGE_TOKENS.map((token) => (
            <option key={token.name} value={token.name}>
              {token.name} ({token.extendedSymbol})
            </option>
          ))}
        </select>

        <div className="text-sm flex items-center">
          <span
            className={`h-2 w-2 rounded-full mr-2 ${
              extendedReadyState === ReadyState.OPEN
                ? "bg-green-500"
                : "bg-red-500"
            }`}
          ></span>
          <span className="text-gray-300">
            {extendedReadyState === ReadyState.OPEN
              ? "Live"
              : extendedReadyState === ReadyState.CONNECTING
                ? "Connecting..."
                : "Disconnected"}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full border border-gray-700 rounded shadow-lg bg-gray-900 relative"
      />

      {macroState.active && (
        <div className="w-full bg-blue-900 text-white p-2 text-sm rounded mt-1 mb-1 text-center">
          Trading Macro Mode Active - Click to set entry price
          {macroState.entryPrice !== null && (
            <span className="ml-2 font-bold">
              Entry: {macroState.entryPrice.toFixed(4)}
            </span>
          )}
        </div>
      )}

      <div className="w-full mt-2 text-xs text-gray-400 flex justify-between items-center">
        <span>1 Minute Candles - Ask Price</span>
        <div className="flex space-x-4">
          <span className="text-gray-300">
            Press <kbd className="bg-gray-700 px-2 py-1 rounded">Shift+T</kbd>{" "}
            to toggle trading macro
          </span>
          <button
            className="text-blue-400 hover:text-blue-300"
            onClick={() => {
              if (chartRefs.current.chart) {
                chartRefs.current.chart.timeScale().fitContent();
                userPositionedChart.current = false;
              }
            }}
          >
            Reset View
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradingInterface;
