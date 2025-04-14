import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import { LineStyle, LineWidth, IPriceLine } from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useTradingContext } from "../../context/TradingContext";
import { useTradingChart } from "../../hooks/useTradingChart";
import {
  CandleData,
  TradeLevel,
  Trade,
  TradeDirection,
  TradeFlow,
} from "../../types/tradingTypes";
import { ARBITRAGE_TOKENS } from "../../types/arbitrageTokens";

const WS_BASE_URL = "wss://api.extended.exchange";

export const TradingChart: React.FC = () => {
  const {
    selectedToken,
    setSelectedToken,
    tradeLevels,
    setLastPrice,
    activeTradeFlow,
    activeTradeFlowStep,
    tradeFlows,
    addTradeLevel,
    setActiveTradeFlowStep,
    setActiveTradeFlow,
    calculatePresetPrice,
  } = useTradingContext();

  // Status message for the current trade flow step
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Track if user has manually positioned the chart
  const userPositionedChart = useRef(false);
  const lastPriceRef = useRef<number | null>(null);
  const hasInitializedChart = useRef(false);

  // Container ref for chart
  const containerRef = useRef<HTMLDivElement>(null);

  // Tracking refs for candle data
  const candleDataRef = useRef<{
    currentMinute: number;
    currentCandle: CandleData | null;
    candles: CandleData[];
  }>({
    currentMinute: -1,
    currentCandle: null,
    candles: [],
  });

  // Initialize chart with our custom hook
  const { chartRef, seriesRef, initChart, handleResize } = useTradingChart(
    containerRef,
    // Chart options
    {
      width: containerRef.current?.clientWidth || 800,
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
        vertLines: { color: "rgba(42, 46, 57, 0.2)" },
        horzLines: { color: "rgba(42, 46, 57, 0.2)" },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(224, 227, 235, 0.4)",
          width: 1 as LineWidth,
          style: 2,
        },
        horzLine: {
          color: "rgba(224, 227, 235, 0.4)",
          width: 1 as LineWidth,
          style: 2,
        },
      },
    },
    // Candle series options
    {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    },
    { onChartClick: handleChartClick },
  );

  // Handle chart clicks - declare function reference before usage
  function handleChartClick(param: { point?: { x: number; y: number } }) {
    if (!param.point || !seriesRef.current) return;

    // Convert the y-coordinate to price
    const price = seriesRef.current.coordinateToPrice(param.point.y);
    if (price === null) return;

    // Only process clicks if there's an active flow
    if (!activeTradeFlow) return;

    const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
    if (!flow) return;

    const step = activeTradeFlowStep;
    const trade = flow.trades[step];
    if (!trade) return;

    // Skip market entry placements - these should be placed automatically
    if (step === 0 && trade.includes("mark")) return;

    // Handle limit order placement or take profit/stop loss placement
    // Determine color and title based on trade type
    let color = "#4CAF50"; // Default green for entries
    let title = "Limit Entry";

    if (trade.includes("takeP")) {
      color = "#2196F3"; // Blue for take profit
      title = "Take Profit";
    } else if (trade.includes("stopL")) {
      color = "#FF9800"; // Orange for stop loss
      title = "Stop Loss";
    }

    // Create price line config
    const lineConfig = {
      price: price,
      color: color,
      lineWidth: 2 as LineWidth,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `${title}: ${price.toFixed(2)}`,
    };

    // Add price line to chart
    const priceLine = seriesRef.current.createPriceLine(lineConfig);

    // Add to context state
    addTradeLevel({
      type: trade,
      active: true,
      quantity: 1,
      IpriceLine: priceLine,
    });

    // Move to next step or deactivate flow
    if (step < flow.trades.length - 1) {
      setActiveTradeFlowStep(step + 1);
      updateStatusMessage(flow, step + 1);
    } else {
      // Last step completed - exit macro mode
      setActiveTradeFlowStep(0);
      setActiveTradeFlow(null);
      setStatusMessage("");
    }
  }

  // Function to update status message based on current flow and step
  const updateStatusMessage = useCallback((flow: TradeFlow, step: number) => {
    if (!flow || step >= flow.trades.length) {
      setStatusMessage("");
      return;
    }

    const trade = flow.trades[step];

    if (trade.includes("mark")) {
      setStatusMessage("Market entry will be placed automatically");
    } else if (trade.includes("limit")) {
      setStatusMessage("Click on chart to place limit entry");
    } else if (trade.includes("takeP")) {
      setStatusMessage("Click on chart to place take profit level");
    } else if (trade.includes("stopL")) {
      setStatusMessage("Click on chart to place stop loss level");
    }
  }, []);

  // Handle automatic market entry placement
  useEffect(() => {
    // Only run when a trade flow is activated and we're at step 0
    if (activeTradeFlow && activeTradeFlowStep === 0) {
      const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
      if (!flow) return;

      // Update status message for current step
      updateStatusMessage(flow, activeTradeFlowStep);

      // If this is a market entry (first step is "mark")
      if (flow.trades[0].includes("mark")) {
        // Wait until we have a price
        if (lastPriceRef.current === null || !seriesRef.current) {
          return;
        }

        // Create price line config
        const lineConfig = {
          price: lastPriceRef.current,
          color: "#4CAF50",
          lineWidth: 2 as LineWidth,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `Market Entry: ${lastPriceRef.current.toFixed(2)}`,
        };

        // Add price line to chart
        const priceLine = seriesRef.current.createPriceLine(lineConfig);

        // Add to context state
        addTradeLevel({
          type: flow.trades[0],
          active: true,
          quantity: 1,
          IpriceLine: priceLine,
        });

        // Move to next step if there is one
        if (flow.trades.length > 1) {
          setActiveTradeFlowStep(1);
          updateStatusMessage(flow, 1);
        } else {
          // Complete trade flow if no more steps
          setActiveTradeFlowStep(0);
          setActiveTradeFlow(null);
          setStatusMessage("");
        }
      }
    }
  }, [
    activeTradeFlow,
    activeTradeFlowStep,
    tradeFlows,
    addTradeLevel,
    setActiveTradeFlowStep,
    setActiveTradeFlow,
    updateStatusMessage,
  ]);

  // Make chart responsive
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize]);

  // Initialize chart only once when component mounts
  useEffect(() => {
    if (!hasInitializedChart.current) {
      const { chart } = initChart() || {};

      if (chart && containerRef.current) {
        // Explicitly set chart size to container size
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: 400,
        });

        // Detect when user manually positions the chart
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          userPositionedChart.current = true;
        });
      }

      hasInitializedChart.current = true;
    }
  }, [initChart]);

  // Handle token changes - without reinitializing the chart
  useEffect(() => {
    // Reset data for new token
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }

    // Reset tracking variables
    userPositionedChart.current = false;
    lastPriceRef.current = null;
    candleDataRef.current = {
      currentMinute: -1,
      currentCandle: null,
      candles: [],
    };
  }, [selectedToken]);

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
    if (!extendedMessage?.data || !seriesRef.current) return;

    try {
      const data = JSON.parse(extendedMessage.data);

      if (data.data?.a?.[0]) {
        const askPrice = parseFloat(data.data.a[0].p);
        const timestamp = data.ts; // milliseconds

        // Save last price for continuity between candles
        if (lastPriceRef.current === null) {
          lastPriceRef.current = askPrice;
        }

        // Update the context last price
        setLastPrice(askPrice);

        // Convert to minutes for candle grouping
        const currentMinute = Math.floor(timestamp / (60 * 1000));

        // Create UTC timestamp for lightweight-charts (seconds)
        const utcTimestamp = Math.floor(currentMinute * 60);

        // Check if this is a new minute
        if (currentMinute !== candleDataRef.current.currentMinute) {
          // If we had a previous candle, finalize it
          if (candleDataRef.current.currentCandle) {
            // Ensure the close price is captured
            candleDataRef.current.currentCandle.close = lastPriceRef.current;

            // Add to our array of candles
            candleDataRef.current.candles.push({
              ...candleDataRef.current.currentCandle,
            });
          }

          // Start a new candle - use the last price as the opening price
          candleDataRef.current.currentMinute = currentMinute;
          candleDataRef.current.currentCandle = {
            time: utcTimestamp,
            open: lastPriceRef.current,
            high: askPrice,
            low: askPrice,
            close: askPrice,
          };

          // Only scroll to the latest candle if user hasn't positioned the chart
          if (!userPositionedChart.current && chartRef.current) {
            chartRef.current.timeScale().scrollToPosition(0, false);
          }
        } else if (candleDataRef.current.currentCandle) {
          // Update existing candle
          const candle = candleDataRef.current.currentCandle;

          // Update high/low
          if (askPrice > candle.high) candle.high = askPrice;
          if (askPrice < candle.low) candle.low = askPrice;

          // Always update close price
          candle.close = askPrice;
        }

        // Update the series with live data
        const updatedCandles = [...candleDataRef.current.candles];
        if (candleDataRef.current.currentCandle) {
          updatedCandles.push(candleDataRef.current.currentCandle);
        }
        seriesRef.current.setData(updatedCandles);

        // Update the last price for the next update
        lastPriceRef.current = askPrice;
      }
    } catch (error) {
      console.error("Error processing Extended exchange message:", error);
    }
  }, [extendedMessage, setLastPrice]);

  return (
    <>
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

      {/* Status message for active trade flow */}
      {statusMessage && (
        <div className="mb-2 p-2 bg-blue-900 text-white rounded">
          {statusMessage}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full border border-gray-700 rounded shadow-lg bg-gray-900 h-[400px]"
      />

      <div className="w-full mt-2 text-xs text-gray-400 flex justify-between items-center">
        <span>1 Minute Candles - Ask Price</span>
        <div className="flex gap-2">
          <button
            className="text-blue-400 hover:text-blue-300"
            onClick={() => {
              if (chartRef.current) {
                chartRef.current.timeScale().fitContent();
                userPositionedChart.current = false;
              }
            }}
          >
            Reset View
          </button>
        </div>
      </div>
    </>
  );
};
