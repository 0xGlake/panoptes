import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  LineStyle,
  IPriceLine,
  LineWidth,
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

interface TradeLevel {
  id: string;
  type:
    | "markBuy"
    | "limitBuy"
    | "limitSell"
    | "takeP"
    | "stopL"
    | "liquidationP";
  active: boolean;
  IpriceLine: IPriceLine;
}

const TradingInterface: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<ArbitrageToken>(
    ARBITRAGE_TOKENS[0],
  );
  const [macroActive, setMacroActive] = useState(false);
  const [tradeLevels, setTradeLevels] = useState<TradeLevel[]>([]);
  const macroActiveRef = useRef(false);

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

  // Clear all trade levels
  const clearAllTradeLevels = React.useCallback(() => {
    // Remove price lines from chart
    if (chartRefs.current.candleSeries) {
      tradeLevels.forEach((level) => {
        chartRefs.current.candleSeries?.removePriceLine(level.IpriceLine);
      });
    }

    // Clear state
    setTradeLevels([]);
  }, [tradeLevels]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle macro mode with Shift+T
      if (e.key === "T" && e.shiftKey) {
        setMacroActive((prev) => !prev);
      }

      // Clear all trade levels with Shift+C
      if (e.key === "C" && e.shiftKey) {
        clearAllTradeLevels();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearAllTradeLevels]);

  useEffect(() => {
    macroActiveRef.current = macroActive;
  }, [macroActive]);

  // Handle chart clicks
  const handleChartClick = React.useCallback(
    (param: { point?: { x: number; y: number } }) => {
      if (
        !macroActiveRef.current ||
        !param.point ||
        !chartRefs.current.candleSeries
      )
        return;

      // Convert the y-coordinate to price
      const price = chartRefs.current.candleSeries.coordinateToPrice(
        param.point.y,
      );

      // Check if price is null before proceeding
      if (price === null) return;

      // Create unique ID for this trade level
      const id = `level-${Date.now()}`;

      // Create price line config
      const lineConfig = {
        price: price,
        color: "#4CAF50",
        lineWidth: 2 as LineWidth,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Entry: ${price.toFixed(2)}`,
      };

      // Add price line to chart
      const priceLine =
        chartRefs.current.candleSeries.createPriceLine(lineConfig);

      // Add to state
      setTradeLevels((prev) => [
        ...prev,
        {
          id: id,
          type: "markBuy",
          active: true,
          IpriceLine: priceLine,
        },
      ]);
    },
    [],
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
    setTradeLevels([]);

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

    // Subscribe to chart clicks
    chart.subscribeClick(handleChartClick);

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

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRefs.current.chart) {
        chartRefs.current.chart.unsubscribeClick(handleChartClick);
      }
    };
  }, [selectedToken, handleChartClick]);

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
        className={`w-full border border-gray-700 rounded shadow-lg bg-gray-900 ${
          macroActive ? "cursor-crosshair" : ""
        }`}
      />

      <div className="w-full mt-2 text-xs text-gray-400 flex justify-between items-center">
        <span>1 Minute Candles - Ask Price</span>
        <div className="flex gap-2">
          <button
            className={`px-2 py-1 rounded ${
              macroActive
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            onClick={() => setMacroActive((prev) => !prev)}
          >
            {macroActive ? "Trading Macro: Active" : "Activate Trading Macro"}
          </button>
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
          {tradeLevels.length > 0 && (
            <button
              className="text-red-400 hover:text-red-300"
              onClick={clearAllTradeLevels}
            >
              Clear Levels
            </button>
          )}
        </div>
      </div>

      {macroActive && (
        <div className="w-full mt-2 bg-blue-900/20 border border-blue-700/30 rounded p-2 text-sm">
          <p className="text-blue-300 font-medium">Trading Macro Active</p>
          <p className="text-xs text-blue-200">
            Click on the chart to place an entry level
          </p>
          <p className="text-xs text-blue-200 mt-1">
            <span className="bg-gray-800 px-1 rounded">Shift+T</span> to toggle
            macro mode |
            <span className="bg-gray-800 px-1 rounded ml-1">Shift+C</span> to
            clear all levels
          </p>
        </div>
      )}

      {tradeLevels.length > 0 && (
        <div className="w-full mt-2">
          <h3 className="text-sm font-medium text-gray-300 mb-1">
            Trade Levels
          </h3>
          <div className="space-y-1">
            {tradeLevels.map((level) => (
              <div
                key={level.id}
                className="flex items-center justify-between bg-gray-800 rounded px-2 py-1"
              >
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{
                      backgroundColor: level.IpriceLine.options().color,
                    }}
                  ></div>
                  <span className="text-sm text-gray-200">
                    Entry: {level.IpriceLine.options().price}
                  </span>
                </div>
                <button
                  className="text-red-400 hover:text-red-300 text-xs"
                  onClick={() => {
                    // Remove this specific level
                    if (chartRefs.current.candleSeries) {
                      chartRefs.current.candleSeries.removePriceLine(
                        level.IpriceLine,
                      );
                    }
                    setTradeLevels((prev) =>
                      prev.filter((item) => item.id !== level.id),
                    );
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingInterface;
