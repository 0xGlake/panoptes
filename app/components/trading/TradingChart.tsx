// /components/trading/TradingChart.tsx
import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  LineStyle,
  LineWidth,
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useTradingContext } from "../../context/TradingContext";
import {
  CandleData,
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
    activateTradeFlow,
    calculatePresetPrice,
  } = useTradingContext();

  // Status message for the current trade flow step
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Track orders that have been placed to prevent duplicates
  const [placedOrderTypes, setPlacedOrderTypes] = useState<Set<string>>(
    new Set(),
  );

  // Track if user has manually positioned the chart
  const userPositionedChart = useRef(false);
  const lastPriceRef = useRef<number | null>(null);
  const chartInitialized = useRef(false);

  // Container ref for chart
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart and series refs
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Keep track of active flow in ref to avoid reinitializations
  const activeTradeFlowRef = useRef<string | null>(null);

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

  // Chart options - memoized to prevent unnecessary rerenders
  const chartOptions = useMemo(
    () => ({
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
    }),
    [],
  );

  // Candle series options - memoized to prevent unnecessary rerenders
  const candleSeriesOptions = useMemo(
    () => ({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    }),
    [],
  );

  // Update the activeTradeFlowRef when activeTradeFlow changes
  useEffect(() => {
    console.log(`Active flow updated: ${activeTradeFlow}`);
    activeTradeFlowRef.current = activeTradeFlow;

    // Reset placed orders when flow changes
    if (activeTradeFlow) {
      setPlacedOrderTypes(new Set());

      // Update status message for the new flow
      const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
      if (flow) {
        updateStatusMessage(flow, activeTradeFlowStep);
      }
    }
  }, [activeTradeFlow, activeTradeFlowStep, tradeFlows]);

  // Function to update status message based on current flow and step
  const updateStatusMessage = useCallback((flow: TradeFlow, step: number) => {
    if (!flow || step >= flow.trades.length) {
      setStatusMessage("");
      return;
    }

    const trade = flow.trades[step];

    if (trade.includes("mark")) {
      setStatusMessage("Market entry will be placed automatically");
    } else if (
      trade.includes("limit") &&
      !trade.includes("takeP") &&
      !trade.includes("stopL")
    ) {
      setStatusMessage("Click on chart to place limit entry");
    } else if (trade.includes("takeP")) {
      setStatusMessage("Click on chart to place take profit level");
    } else if (trade.includes("stopL")) {
      setStatusMessage("Click on chart to place stop loss level");
    }
  }, []);

  // Initialize chart - but do not re-run this when active flow changes
  const initializeChart = useCallback(() => {
    if (!containerRef.current) {
      console.log("Container ref not available");
      return;
    }

    // Clean up previous chart if it exists
    if (chartRef.current) {
      try {
        // Make sure to unsubscribe click handler before removing
        chartRef.current.unsubscribeClick(handleChartClick);
        chartRef.current.remove();
      } catch (error) {
        console.error("Error removing chart:", error);
      }
      chartRef.current = null;
      seriesRef.current = null;
    }

    console.log("Creating new chart");

    try {
      // Create new chart
      const chart = createChart(containerRef.current, {
        ...chartOptions,
        width: containerRef.current.clientWidth || 800,
        height: 400,
      });

      const candleSeries = chart.addCandlestickSeries(candleSeriesOptions);

      // Store references
      chartRef.current = chart;
      seriesRef.current = candleSeries;

      // Set initial empty data
      candleSeries.setData([]);

      // Auto-fit content initially
      chart.timeScale().fitContent();

      // Detect when user manually positions the chart
      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        userPositionedChart.current = true;
      });

      // Wait for the next tick before attaching click handler
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.subscribeClick(handleChartClick);
          console.log("Chart initialized with click handler");
        }
      }, 0);

      chartInitialized.current = true;
    } catch (error) {
      console.error("Error creating chart:", error);
    }
    // Deliberately omitting handleChartClick from dependencies to prevent re-initialization
  }, [chartOptions, candleSeriesOptions]);

  // Handle chart clicks
  const handleChartClick = useCallback(
    (param: { point?: { x: number; y: number } }) => {
      console.log("Chart clicked:", param);

      if (!param.point || !seriesRef.current) {
        console.log("No point or series ref");
        return;
      }

      // Convert the y-coordinate to price
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price === null) {
        console.log("Could not convert to price");
        return;
      }

      // Since we're using activeTradeFlowRef, we should have the latest value
      const currentActiveFlow = activeTradeFlowRef.current;
      console.log("Click at price:", price, "Active flow:", currentActiveFlow);

      // Only process clicks if there's an active flow
      if (!currentActiveFlow) {
        console.log("No active flow");
        return;
      }

      const flow = tradeFlows.find((f) => f.id === currentActiveFlow);
      if (!flow) {
        console.log("Flow not found");
        return;
      }

      const step = activeTradeFlowStep;
      const trade = flow.trades[step];
      if (!trade) {
        console.log("No trade at step", step);
        return;
      }

      // Determine what kind of order this is
      let orderType = "";
      if (trade.includes("takeP")) {
        orderType = "takeP";
      } else if (trade.includes("stopL")) {
        orderType = "stopL";
      } else if (step === 0) {
        orderType = "entry";
      }

      // Skip if we've already placed this order type
      if (placedOrderTypes.has(orderType)) {
        console.log(`Already placed ${orderType} order`);
        return;
      }

      // Skip market entry placements - these should be placed automatically
      if (step === 0 && trade.includes("mark")) {
        console.log("Skipping market entry placement - should be automatic");
        return;
      }

      console.log(`Placing ${orderType} order at price ${price}`);

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

      if (!seriesRef.current) {
        console.error("Series ref is null when trying to add price line");
        return;
      }

      // Add price line to chart
      try {
        const priceLine = seriesRef.current.createPriceLine(lineConfig);

        // Add to context state
        addTradeLevel({
          type: trade,
          active: true,
          quantity: 1,
          IpriceLine: priceLine,
        });

        // Mark this order type as placed
        setPlacedOrderTypes((prev) => new Set([...prev, orderType]));
      } catch (error) {
        console.error("Error creating price line:", error);
        return;
      }

      // Only handle auto-placements if this is the entry and we haven't placed the auto orders yet
      if (step === 0) {
        // Auto-place take profit if preset mode is enabled and not already placed
        if (
          flow.presetMode.takeP &&
          flow.presets.takeP !== null &&
          !placedOrderTypes.has("takeP")
        ) {
          const takeProfitTrade = flow.trades.find((t) => t.includes("takeP"));
          if (takeProfitTrade && seriesRef.current) {
            console.log("Auto-placing take profit after limit entry");

            const direction: TradeDirection = "Buy"; // Will be dynamically determined later
            const takeProfitPrice = calculatePresetPrice(
              price,
              direction,
              "takeP",
              flow.presets.takeP,
            );

            // Create take profit line config
            const takeProfitLineConfig = {
              price: takeProfitPrice,
              color: "#2196F3", // Blue for take profit
              lineWidth: 2 as LineWidth,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `Take Profit (Auto): ${takeProfitPrice.toFixed(2)}`,
            };

            try {
              // Add price line to chart
              const takeProfitPriceLine =
                seriesRef.current.createPriceLine(takeProfitLineConfig);

              // Add to context state
              addTradeLevel({
                type: takeProfitTrade,
                active: true,
                quantity: 1,
                IpriceLine: takeProfitPriceLine,
              });

              // Mark as placed
              setPlacedOrderTypes((prev) => new Set([...prev, "takeP"]));
            } catch (error) {
              console.error("Error creating take profit line:", error);
            }
          }
        }

        // Auto-place stop loss if preset mode is enabled and not already placed
        if (
          flow.presetMode.stopL &&
          flow.presets.stopL !== null &&
          !placedOrderTypes.has("stopL")
        ) {
          const stopLossTrade = flow.trades.find((t) => t.includes("stopL"));
          if (stopLossTrade && seriesRef.current) {
            console.log("Auto-placing stop loss after limit entry");

            const direction: TradeDirection = "Buy"; // Will be dynamically determined later
            const stopLossPrice = calculatePresetPrice(
              price,
              direction,
              "stopL",
              flow.presets.stopL,
            );

            // Create stop loss line config
            const stopLossLineConfig = {
              price: stopLossPrice,
              color: "#FF9800", // Orange for stop loss
              lineWidth: 2 as LineWidth,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `Stop Loss (Auto): ${stopLossPrice.toFixed(2)}`,
            };

            try {
              // Add price line to chart
              const stopLossPriceLine =
                seriesRef.current.createPriceLine(stopLossLineConfig);

              // Add to context state
              addTradeLevel({
                type: stopLossTrade,
                active: true,
                quantity: 1,
                IpriceLine: stopLossPriceLine,
              });

              // Mark as placed
              setPlacedOrderTypes((prev) => new Set([...prev, "stopL"]));
            } catch (error) {
              console.error("Error creating stop loss line:", error);
            }
          }
        }
      }

      // Calculate next step, skipping any preset-enabled steps
      let nextStep = step + 1;
      while (
        nextStep < flow.trades.length &&
        ((flow.trades[nextStep].includes("takeP") && flow.presetMode.takeP) ||
          (flow.trades[nextStep].includes("stopL") && flow.presetMode.stopL))
      ) {
        nextStep++;
      }

      // Move to next step or deactivate flow
      if (nextStep < flow.trades.length) {
        setActiveTradeFlowStep(nextStep);
        updateStatusMessage(flow, nextStep);
      } else {
        // Last step completed - exit macro mode
        setActiveTradeFlowStep(0);
        activateTradeFlow(""); // Deactivate trade flow
        setStatusMessage("");
      }
    },
    [
      tradeFlows,
      activeTradeFlowStep,
      addTradeLevel,
      setActiveTradeFlowStep,
      activateTradeFlow,
      updateStatusMessage,
      calculatePresetPrice,
      placedOrderTypes,
    ],
  );

  // Handle automatic market entry placement
  const handleMarketEntryPlacement = useCallback(() => {
    // Only run when a trade flow is activated and we're at step 0
    const currentActiveFlow = activeTradeFlowRef.current;
    if (!currentActiveFlow || activeTradeFlowStep !== 0) return;

    const flow = tradeFlows.find((f) => f.id === currentActiveFlow);
    if (!flow) return;

    // Update status message for current step
    updateStatusMessage(flow, activeTradeFlowStep);

    // If this is a market entry (first step is "mark") and we haven't placed it yet
    if (!flow.trades[0].includes("mark") || placedOrderTypes.has("entry"))
      return;

    // Wait until we have a price
    if (lastPriceRef.current === null || !seriesRef.current) return;

    console.log("Auto-placing market entry at price:", lastPriceRef.current);

    // Create price line config
    const lineConfig = {
      price: lastPriceRef.current,
      color: "#4CAF50",
      lineWidth: 2 as LineWidth,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `Market Entry: ${lastPriceRef.current.toFixed(2)}`,
    };

    try {
      // Add price line to chart
      const priceLine = seriesRef.current.createPriceLine(lineConfig);

      // Add to context state
      addTradeLevel({
        type: flow.trades[0],
        active: true,
        quantity: 1,
        IpriceLine: priceLine,
      });

      // Mark entry as placed to prevent duplicates
      setPlacedOrderTypes((prev) => new Set([...prev, "entry"]));
    } catch (error) {
      console.error("Error creating entry price line:", error);
      return;
    }

    // Auto-place take profit if preset mode is enabled and we haven't placed it yet
    if (
      flow.presetMode.takeP &&
      flow.presets.takeP !== null &&
      !placedOrderTypes.has("takeP")
    ) {
      const takeProfitTrade = flow.trades.find((t) => t.includes("takeP"));
      if (takeProfitTrade && seriesRef.current) {
        console.log("Auto-placing take profit for market entry");

        // Assume Buy direction initially
        const direction: TradeDirection = "Buy";
        const takeProfitPrice = calculatePresetPrice(
          lastPriceRef.current,
          direction,
          "takeP",
          flow.presets.takeP,
        );

        // Create take profit line config
        const takeProfitLineConfig = {
          price: takeProfitPrice,
          color: "#2196F3", // Blue for take profit
          lineWidth: 2 as LineWidth,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `Take Profit (Auto): ${takeProfitPrice.toFixed(2)}`,
        };

        try {
          // Add price line to chart
          const takeProfitPriceLine =
            seriesRef.current.createPriceLine(takeProfitLineConfig);

          // Add to context state
          addTradeLevel({
            type: takeProfitTrade,
            active: true,
            quantity: 1,
            IpriceLine: takeProfitPriceLine,
          });

          // Mark take profit as placed
          setPlacedOrderTypes((prev) => new Set([...prev, "takeP"]));
        } catch (error) {
          console.error("Error creating take profit line:", error);
        }
      }
    }

    // Auto-place stop loss if preset mode is enabled and we haven't placed it yet
    if (
      flow.presetMode.stopL &&
      flow.presets.stopL !== null &&
      !placedOrderTypes.has("stopL")
    ) {
      const stopLossTrade = flow.trades.find((t) => t.includes("stopL"));
      if (stopLossTrade && seriesRef.current) {
        console.log("Auto-placing stop loss for market entry");

        // Assume Buy direction initially
        const direction: TradeDirection = "Buy";
        const stopLossPrice = calculatePresetPrice(
          lastPriceRef.current,
          direction,
          "stopL",
          flow.presets.stopL,
        );

        // Create stop loss line config
        const stopLossLineConfig = {
          price: stopLossPrice,
          color: "#FF9800", // Orange for stop loss
          lineWidth: 2 as LineWidth,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `Stop Loss (Auto): ${stopLossPrice.toFixed(2)}`,
        };

        try {
          // Add price line to chart
          const stopLossPriceLine =
            seriesRef.current.createPriceLine(stopLossLineConfig);

          // Add to context state
          addTradeLevel({
            type: stopLossTrade,
            active: true,
            quantity: 1,
            IpriceLine: stopLossPriceLine,
          });

          // Mark stop loss as placed
          setPlacedOrderTypes((prev) => new Set([...prev, "stopL"]));
        } catch (error) {
          console.error("Error creating stop loss line:", error);
        }
      }
    }

    // Calculate next step, skipping any preset-enabled steps
    let nextStep = 1;
    while (
      nextStep < flow.trades.length &&
      ((flow.trades[nextStep].includes("takeP") && flow.presetMode.takeP) ||
        (flow.trades[nextStep].includes("stopL") && flow.presetMode.stopL))
    ) {
      nextStep++;
    }

    // Move to next step or complete if no more steps
    if (nextStep < flow.trades.length) {
      setActiveTradeFlowStep(nextStep);
      updateStatusMessage(flow, nextStep);
    } else {
      // All steps completed or automated
      setActiveTradeFlowStep(0);
      activateTradeFlow(""); // Deactivate trade flow
      setStatusMessage("");
    }
  }, [
    tradeFlows,
    activeTradeFlowStep,
    addTradeLevel,
    setActiveTradeFlowStep,
    activateTradeFlow,
    updateStatusMessage,
    calculatePresetPrice,
    placedOrderTypes,
  ]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (containerRef.current && chartRef.current) {
      try {
        const newWidth = containerRef.current.clientWidth;
        chartRef.current.applyOptions({
          width: newWidth,
        });
      } catch (error) {
        console.error("Error resizing chart:", error);
      }
    }
  }, []);

  // Initialize chart on component mount - only once
  useEffect(() => {
    if (!chartInitialized.current) {
      initializeChart();

      // Setup resize handler
      window.addEventListener("resize", handleResize);

      chartInitialized.current = true;
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        try {
          chartRef.current.unsubscribeClick(handleChartClick);
          chartRef.current.remove();
        } catch (error) {
          console.error("Error cleaning up chart:", error);
        }
      }
    };
  }, []);

  // Re-initialize chart ONLY when token changes
  useEffect(() => {
    // Skip the first render
    if (!chartInitialized.current) return;

    console.log("Token changed, reinitializing chart");
    initializeChart();

    // Reset tracking variables
    userPositionedChart.current = false;
    lastPriceRef.current = null;
    candleDataRef.current = {
      currentMinute: -1,
      currentCandle: null,
      candles: [],
    };
  }, [selectedToken]);

  // Trigger market entry placement when needed
  useEffect(() => {
    // Only run if chart is initialized and there's an active flow
    if (chartInitialized.current && activeTradeFlow) {
      handleMarketEntryPlacement();
    }
  }, [handleMarketEntryPlacement, activeTradeFlow, activeTradeFlowStep]);

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
        // Fix the incorrect calculation - lightweight-charts UTCTimestamp is in seconds
        const utcTimestamp = Math.floor(timestamp / 1000) as UTCTimestamp;

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
        style={{
          zIndex: 10, // Increased z-index to ensure chart is on top
          position: "relative",
          cursor: activeTradeFlow ? "crosshair" : "default",
        }}
        data-testid="chart-container" // Add a test ID for debugging
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
