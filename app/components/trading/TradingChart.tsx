// /components/trading/TradingChart.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  createChart,
  LineStyle,
  LineWidth,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  IPriceLine,
} from "lightweight-charts";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useTradingContext } from "../../context/TradingContext";
import { CandleData, TradeDirection } from "../../types/tradingTypes";
import { ARBITRAGE_TOKENS } from "../../types/arbitrageTokens";

const WS_BASE_URL = "wss://api.extended.exchange";

export const TradingChart: React.FC = () => {
  // Extract what we need from context
  const {
    selectedToken,
    setSelectedToken,
    tradeLevels,
    addTradeLevel,
    updateTradeLevel,
    activeTradeFlow,
    activeTradeFlowStep,
    tradeFlows,
    setActiveTradeFlowStep,
    activateTradeFlow,
    calculatePresetPrice,
  } = useTradingContext();

  // Simple component state
  const [statusMessage, setStatusMessage] = useState("");
  const [placedOrderTypes, setPlacedOrderTypes] = useState(new Set());

  // References for chart objects
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Track important state with refs
  const lastPriceRef = useRef<number | null>(null);
  const candles = useRef<CandleData[]>([]);
  const currentCandle = useRef<CandleData | null>(null);
  const currentMinute = useRef(-1);
  const userPositionedChart = useRef(false);

  // Track price lines that we've created in a ref
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());

  // Store the click handler in a ref to prevent dependency issues
  const clickHandlerRef = useRef(
    (param: { point?: { x: number; y: number } }) => {},
  );

  // State to track whether levels are locked
  const [areLevelsLocked, setAreLevelsLocked] = useState(false);

  // State to track dragging
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    levelId: string | null;
  }>({
    isDragging: false,
    levelId: null,
  });

  // ===== WEBSOCKET CONNECTION =====
  const { lastMessage, readyState } = useWebSocket(
    `${WS_BASE_URL}/stream.extended.exchange/v1/orderbooks/${selectedToken.extendedSymbol}?depth=1`,
    {
      onOpen: () => console.log("WebSocket Connected"),
      shouldReconnect: () => true,
      reconnectInterval: 3000,
    },
  );

  // ===== SETUP CLICK HANDLER REF =====
  // This approach keeps the click handler updated with latest props/state
  // without causing the chart to be recreated when dependencies change
  useEffect(() => {
    // Update the click handler ref with latest dependencies
    clickHandlerRef.current = (param: { point?: { x: number; y: number } }) => {
      console.log("Chart click handler called");
      if (!param.point || !seriesRef.current || !activeTradeFlow) return;

      // Convert y-coordinate to price
      const price = seriesRef.current.coordinateToPrice(
        param.point.y,
      ) as number;
      if (price === null) return;

      console.log("Click at price:", price);

      const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
      if (!flow) return;

      const trade = flow.trades[activeTradeFlowStep];
      if (!trade) return;

      // Determine order type
      let orderType = "";
      let color = "#4CAF50";
      let title = "Limit Entry";

      if (trade.includes("takeP")) {
        orderType = "takeP";
        color = "#2196F3";
        title = "Take Profit";
      } else if (trade.includes("stopL")) {
        orderType = "stopL";
        color = "#FF9800";
        title = "Stop Loss";
      } else if (activeTradeFlowStep === 0) {
        orderType = "entry";
      }

      // Skip if already placed or is market entry
      if (
        placedOrderTypes.has(orderType) ||
        (activeTradeFlowStep === 0 && trade.includes("mark"))
      ) {
        return;
      }

      // Create price line
      try {
        const priceLine = seriesRef.current.createPriceLine({
          price: price,
          color: color,
          lineWidth: 2 as LineWidth,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${title}: ${price.toFixed(2)}`,
        });

        // Add to context
        addTradeLevel({
          type: trade,
          active: true,
          quantity: 1,
          IpriceLine: priceLine,
        });

        // Mark as placed
        setPlacedOrderTypes((prev) => new Set([...prev, orderType]));

        // Handle auto-placements for entry step
        if (activeTradeFlowStep === 0) {
          // Auto-place take profit if preset enabled
          if (
            flow.presetMode.takeP &&
            flow.presets.takeP !== null &&
            !placedOrderTypes.has("takeP")
          ) {
            const takeProfitTrade = flow.trades.find((t) =>
              t.includes("takeP"),
            );
            if (takeProfitTrade) {
              const direction: TradeDirection = "Buy";
              const takeProfitPrice = calculatePresetPrice(
                price,
                direction,
                "takeP",
                flow.presets.takeP,
              );

              const takeProfitLine = seriesRef.current.createPriceLine({
                price: takeProfitPrice,
                color: "#2196F3",
                lineWidth: 2 as LineWidth,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `Take Profit (Auto): ${takeProfitPrice.toFixed(2)}`,
              });

              addTradeLevel({
                type: takeProfitTrade,
                active: true,
                quantity: 1,
                IpriceLine: takeProfitLine,
              });

              setPlacedOrderTypes((prev) => new Set([...prev, "takeP"]));
            }
          }

          // Auto-place stop loss if preset enabled
          if (
            flow.presetMode.stopL &&
            flow.presets.stopL !== null &&
            !placedOrderTypes.has("stopL")
          ) {
            const stopLossTrade = flow.trades.find((t) => t.includes("stopL"));
            if (stopLossTrade) {
              const direction: TradeDirection = "Buy";
              const stopLossPrice = calculatePresetPrice(
                price,
                direction,
                "stopL",
                flow.presets.stopL,
              );

              const stopLossLine = seriesRef.current.createPriceLine({
                price: stopLossPrice,
                color: "#FF9800",
                lineWidth: 2 as LineWidth,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `Stop Loss (Auto): ${stopLossPrice.toFixed(2)}`,
              });

              addTradeLevel({
                type: stopLossTrade,
                active: true,
                quantity: 1,
                IpriceLine: stopLossLine,
              });

              setPlacedOrderTypes((prev) => new Set([...prev, "stopL"]));
            }
          }
        }

        // Calculate next step
        let nextStep = activeTradeFlowStep + 1;
        while (
          nextStep < flow.trades.length &&
          ((flow.trades[nextStep].includes("takeP") && flow.presetMode.takeP) ||
            (flow.trades[nextStep].includes("stopL") && flow.presetMode.stopL))
        ) {
          nextStep++;
        }

        // Update step or complete flow
        if (nextStep < flow.trades.length) {
          setActiveTradeFlowStep(nextStep);
        } else {
          setActiveTradeFlowStep(0);
          activateTradeFlow("");
          setStatusMessage("");
        }
      } catch (error) {
        console.error("Error creating price line:", error);
      }
    };
  }, [
    activeTradeFlow,
    activeTradeFlowStep,
    tradeFlows,
    placedOrderTypes,
    addTradeLevel,
    setActiveTradeFlowStep,
    activateTradeFlow,
    calculatePresetPrice,
  ]);

  // ===== SETUP RESIZE HANDLER =====
  const handleResize = useCallback(() => {
    if (containerRef.current && chartRef.current) {
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    }
  }, []);

  // ===== UNIFIED CHART CREATION & INITIALIZATION =====
  useEffect(() => {
    console.log(
      "Chart initialization/update effect running for token:",
      selectedToken.name,
    );

    // Function to set up the chart
    const setupChart = () => {
      if (!containerRef.current) return;

      // Clean up previous chart if it exists
      if (chartRef.current) {
        console.log("Cleaning up previous chart");
        chartRef.current.unsubscribeClick((param) =>
          clickHandlerRef.current(param),
        );
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }

      console.log("Creating new chart");

      // Create new chart
      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth || 800,
        height: 400,
        layout: {
          background: { color: "#1a1a1a" },
          textColor: "#d1d4dc",
        },
        grid: {
          vertLines: { color: "rgba(42, 46, 57, 0.2)" },
          horzLines: { color: "rgba(42, 46, 57, 0.2)" },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
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

      candleSeries.setData([]);
      chart.timeScale().fitContent();

      // Track when user manually positions chart
      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        userPositionedChart.current = true;
      });

      // Set refs first
      chartRef.current = chart;
      seriesRef.current = candleSeries;

      // Then add click handler using the ref
      chart.subscribeClick((param) => clickHandlerRef.current(param));
      console.log("Successfully subscribed to click events");
    };

    // Set up chart
    setupChart();

    // Reset state when chart is created/recreated
    lastPriceRef.current = null;
    candles.current = [];
    currentCandle.current = null;
    currentMinute.current = -1;
    userPositionedChart.current = false;

    // Clear price line tracking
    if (priceLinesRef.current) {
      priceLinesRef.current.clear();
    }

    // Add resize event listener
    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeClick((param) =>
          clickHandlerRef.current(param),
        );
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [selectedToken, handleResize]); // Only recreate chart when token changes

  // ===== SYNC tradeLevels with chart =====
  useEffect(() => {
    if (!seriesRef.current) return;

    console.log("Syncing trade levels with chart");

    try {
      // Create a set of currently active trade level IDs
      const activeTradeIds = new Set<string>();
      tradeLevels.forEach((level) => {
        if (level.active) {
          activeTradeIds.add(level.id);
        }
      });

      // Remove price lines for trade levels that are no longer active
      const removedIds: string[] = [];
      priceLinesRef.current.forEach((priceLine, id) => {
        if (!activeTradeIds.has(id)) {
          try {
            seriesRef.current?.removePriceLine(priceLine);
            removedIds.push(id);
          } catch (error) {
            console.error("Error removing price line:", error);
          }
        }
      });

      // Clean up our reference map
      removedIds.forEach((id) => {
        priceLinesRef.current.delete(id);
      });

      // Add any new trade levels' price lines to our tracking map
      tradeLevels.forEach((level) => {
        if (
          level.active &&
          level.IpriceLine &&
          !priceLinesRef.current.has(level.id)
        ) {
          priceLinesRef.current.set(level.id, level.IpriceLine);
        }
      });
    } catch (error) {
      console.error("Error syncing trade levels:", error);
    }
  }, [tradeLevels]); // Add tradeLevels as dependency to respond to context changes

  // ===== TRADE FLOW HANDLING =====
  // Reset placed orders when flow changes
  useEffect(() => {
    if (activeTradeFlow) {
      setPlacedOrderTypes(new Set());

      // Update status message
      const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
      if (flow && activeTradeFlowStep < flow.trades.length) {
        const trade = flow.trades[activeTradeFlowStep];

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
      }
    } else {
      setStatusMessage("");
    }
  }, [activeTradeFlow, activeTradeFlowStep, tradeFlows]);

  // Auto-place market entry
  useEffect(() => {
    // Only run for market entries at step 0
    if (!activeTradeFlow || activeTradeFlowStep !== 0 || !seriesRef.current)
      return;

    const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
    if (
      !flow ||
      !flow.trades[0].includes("mark") ||
      placedOrderTypes.has("entry")
    )
      return;

    // Wait for price data
    if (lastPriceRef.current === null) return;

    // Create market entry price line
    const price = lastPriceRef.current;

    try {
      const priceLine = seriesRef.current.createPriceLine({
        price: price,
        color: "#4CAF50",
        lineWidth: 2 as LineWidth,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Market Entry: ${price.toFixed(2)}`,
      });

      // Add to context
      addTradeLevel({
        type: flow.trades[0],
        active: true,
        quantity: 1,
        IpriceLine: priceLine,
      });

      // Mark as placed
      setPlacedOrderTypes((prev) => new Set([...prev, "entry"]));

      // Auto-place take profit if preset enabled
      if (flow.presetMode.takeP && flow.presets.takeP !== null) {
        const takeProfitTrade = flow.trades.find((t) => t.includes("takeP"));
        if (takeProfitTrade) {
          const direction: TradeDirection = "Buy";
          const takeProfitPrice = calculatePresetPrice(
            price,
            direction,
            "takeP",
            flow.presets.takeP,
          );

          const takeProfitLine = seriesRef.current.createPriceLine({
            price: takeProfitPrice,
            color: "#2196F3",
            lineWidth: 2 as LineWidth,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `Take Profit (Auto): ${takeProfitPrice.toFixed(2)}`,
          });

          addTradeLevel({
            type: takeProfitTrade,
            active: true,
            quantity: 1,
            IpriceLine: takeProfitLine,
          });

          setPlacedOrderTypes((prev) => new Set([...prev, "takeP"]));
        }
      }

      // Auto-place stop loss if preset enabled
      if (flow.presetMode.stopL && flow.presets.stopL !== null) {
        const stopLossTrade = flow.trades.find((t) => t.includes("stopL"));
        if (stopLossTrade) {
          const direction: TradeDirection = "Buy";
          const stopLossPrice = calculatePresetPrice(
            price,
            direction,
            "stopL",
            flow.presets.stopL,
          );

          const stopLossLine = seriesRef.current.createPriceLine({
            price: stopLossPrice,
            color: "#FF9800",
            lineWidth: 2 as LineWidth,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `Stop Loss (Auto): ${stopLossPrice.toFixed(2)}`,
          });

          addTradeLevel({
            type: stopLossTrade,
            active: true,
            quantity: 1,
            IpriceLine: stopLossLine,
          });

          setPlacedOrderTypes((prev) => new Set([...prev, "stopL"]));
        }
      }

      // Determine next step
      let nextStep = 1;
      while (
        nextStep < flow.trades.length &&
        ((flow.trades[nextStep].includes("takeP") && flow.presetMode.takeP) ||
          (flow.trades[nextStep].includes("stopL") && flow.presetMode.stopL))
      ) {
        nextStep++;
      }

      // Update step or complete flow
      if (nextStep < flow.trades.length) {
        setActiveTradeFlowStep(nextStep);
      } else {
        setActiveTradeFlowStep(0);
        activateTradeFlow("");
        setStatusMessage("");
      }
    } catch (error) {
      console.error("Error creating price lines:", error);
    }
  }, [
    activeTradeFlow,
    activeTradeFlowStep,
    tradeFlows,
    placedOrderTypes,
    addTradeLevel,
    setActiveTradeFlowStep,
    activateTradeFlow,
    calculatePresetPrice,
  ]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Skip if levels are locked
      if (areLevelsLocked) return;

      if (!containerRef.current || !seriesRef.current || !chartRef.current)
        return;

      // Get chart coordinates
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to price
      const clickedPrice = seriesRef.current.coordinateToPrice(y);

      // Find if we clicked directly on a price line
      let targetLevelId: string | null = null;

      for (const level of tradeLevels) {
        if (level.active && level.IpriceLine) {
          const linePrice = level.IpriceLine.options().price;

          // Check if the click is on or very near the price line
          // Using a much tighter tolerance than before
          if (Math.abs(clickedPrice - linePrice) < linePrice * 0.002) {
            // 0.2% tolerance
            targetLevelId = level.id;
            break;
          }
        }
      }

      if (targetLevelId) {
        // Start dragging
        setDragState({
          isDragging: true,
          levelId: targetLevelId,
        });

        // Disable chart scrolling/scaling during drag
        chartRef.current.applyOptions({
          handleScroll: false,
          handleScale: false,
        });

        // Prevent any other chart interactions
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [tradeLevels, areLevelsLocked],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (
        !dragState.isDragging ||
        !dragState.levelId ||
        !containerRef.current ||
        !seriesRef.current
      )
        return;

      // Get chart coordinates
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;

      // Convert to price
      const newPrice = seriesRef.current.coordinateToPrice(y);

      // Find the level being dragged
      const level = tradeLevels.find((l) => l.id === dragState.levelId);
      if (!level) return;

      // Update the price line visually
      level.IpriceLine.applyOptions({
        price: newPrice,
        title: `${level.IpriceLine.options().title.split(":")[0]}: ${newPrice.toFixed(2)}`,
      });
    },
    [dragState, tradeLevels],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || !dragState.levelId || !chartRef.current)
      return;

    // Find the level that was being dragged
    const level = tradeLevels.find((l) => l.id === dragState.levelId);
    if (!level) return;

    // Get the updated price from the price line
    const newPrice = level.IpriceLine.options().price;

    // Update the level in context
    updateTradeLevel({
      ...level,
      IpriceLine: level.IpriceLine,
    });

    // Reset drag state
    setDragState({
      isDragging: false,
      levelId: null,
    });

    // Re-enable chart scrolling/scaling
    chartRef.current.applyOptions({
      handleScroll: true,
      handleScale: true,
    });
  }, [dragState, tradeLevels, updateTradeLevel]);

  // We need a special click handler for the chart container that doesn't interfere with chart clicks
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If we're not dragging and not in an active trade flow, allow normal clicks
      if (!dragState.isDragging && activeTradeFlow) {
        // Let the original click handler handle this
        // Do not preventDefault or stopPropagation
      } else {
        // For dragging operations, prevent default to avoid chart interactions
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [dragState.isDragging, activeTradeFlow],
  );

  // Set up global event listeners for mouseup and mousemove
  useEffect(() => {
    // Add global event listeners
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      // Remove global event listeners on cleanup
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ===== PROCESS WEBSOCKET DATA =====
  useEffect(() => {
    if (!lastMessage?.data || !seriesRef.current) return;
    try {
      const data = JSON.parse(lastMessage.data);
      if (data.data?.a?.[0]) {
        const askPrice = parseFloat(data.data.a[0].p);
        const timestamp = data.ts; // milliseconds

        // Save initial price if none exists
        if (lastPriceRef.current === null) {
          lastPriceRef.current = askPrice;
        }

        // Only calculate current minute timestamp once per tick
        const utcTimestamp = Math.floor(timestamp / 1000) as UTCTimestamp;
        const newMinute = Math.floor(timestamp / (60 * 1000));

        // Check if this is a new minute
        if (newMinute !== currentMinute.current) {
          // Finalize previous candle if it exists
          if (currentCandle.current) {
            currentCandle.current.close = lastPriceRef.current;
            // Add to candles array for history
            candles.current.push({ ...currentCandle.current });

            // Use update for efficiency
            seriesRef.current.update(currentCandle.current);
          }

          // Create new candle
          currentMinute.current = newMinute;
          currentCandle.current = {
            time: utcTimestamp,
            open: lastPriceRef.current,
            high: askPrice,
            low: askPrice,
            close: askPrice,
          };

          // Auto-scroll if user hasn't positioned chart
          if (!userPositionedChart.current && chartRef.current) {
            chartRef.current.timeScale().scrollToPosition(0, false);
          }
        } else if (currentCandle.current) {
          // Update current candle
          if (askPrice > currentCandle.current.high) {
            currentCandle.current.high = askPrice;
          }
          if (askPrice < currentCandle.current.low) {
            currentCandle.current.low = askPrice;
          }
          currentCandle.current.close = askPrice;

          // This updates just the one candle without creating any new arrays
          seriesRef.current.update(currentCandle.current);
        }

        // Save last price
        lastPriceRef.current = askPrice;
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }, [lastMessage]);

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
            if (token) setSelectedToken(token);
          }}
        >
          {ARBITRAGE_TOKENS.map((token) => (
            <option key={token.name} value={token.name}>
              {token.name} ({token.extendedSymbol})
            </option>
          ))}
        </select>

        <div className="flex items-center space-x-4">
          {/* Lock/Unlock button for trade levels */}
          <button
            className={`px-3 py-1 rounded flex items-center text-sm ${
              areLevelsLocked
                ? "bg-gray-700 text-white"
                : "bg-blue-600 text-white"
            }`}
            onClick={() => setAreLevelsLocked((prev) => !prev)}
          >
            <span>
              {areLevelsLocked ? "🔒 Unlock Levels" : "🔓 Lock Levels"}
            </span>
          </button>

          <div className="text-sm flex items-center">
            <span
              className={`h-2 w-2 rounded-full mr-2 ${
                readyState === ReadyState.OPEN ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            <span className="text-gray-300">
              {readyState === ReadyState.OPEN
                ? "Live"
                : readyState === ReadyState.CONNECTING
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-2 p-2 bg-blue-900 text-white rounded">
          {statusMessage}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full border border-gray-700 rounded shadow-lg bg-gray-900 h-[400px]"
        style={{
          zIndex: 10,
          position: "relative",
          cursor: dragState.isDragging
            ? "ns-resize"
            : activeTradeFlow
              ? "crosshair"
              : "default",
        }}
        data-testid="chart-container"
        onMouseDown={handleMouseDown}
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
