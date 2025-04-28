// /components/trading/TradingChart.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  createChart,
  LineStyle,
  LineWidth,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
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

  // Track if initialization has happened
  const [isInitialized, setIsInitialized] = useState(false);

  // ===== WEBSOCKET CONNECTION =====
  const { lastMessage, readyState } = useWebSocket(
    `${WS_BASE_URL}/stream.extended.exchange/v1/orderbooks/${selectedToken.extendedSymbol}?depth=1`,
    {
      onOpen: () => console.log("WebSocket Connected"),
      shouldReconnect: () => true,
      reconnectInterval: 3000,
    },
  );

  // ===== CHART CREATION & CLEANUP =====
  const createTradingChart = useCallback(() => {
    console.log("Creating chart, isInitialized:", isInitialized);

    if (!containerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

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

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // After creation, set up chart and subscriptions once it's fully ready
    let isClickHandlerAttached = false;

    const setupChartAndSubscriptions = () => {
      if (chartRef.current && seriesRef.current && !isClickHandlerAttached) {
        try {
          // Wait until both chart and series refs are available
          chartRef.current.subscribeClick(handleChartClick);
          isClickHandlerAttached = true;
          console.log("Successfully subscribed to click events");
        } catch (error) {
          console.error("Error subscribing to chart click events:", error);
        }
      } else if (!isClickHandlerAttached) {
        // Try again if not yet subscribed
        setTimeout(setupChartAndSubscriptions, 50);
      }
    };

    // Start setup with initial delay
    setTimeout(setupChartAndSubscriptions, 100);
  }, []);

  // Setup chart resize handling
  const handleResize = useCallback(() => {
    if (containerRef.current && chartRef.current) {
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    }
  }, []);

  // ===== INITIALIZATION & CLEANUP =====
  useEffect(() => {
    console.log("Initial setup effect running");

    // Initial setup
    createTradingChart();
    window.addEventListener("resize", handleResize);
    setIsInitialized(true);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(handleChartClick);
        chartRef.current.remove();
      }
    };
  }, []);

  // When token changes, reset everything
  useEffect(() => {
    if (!isInitialized) return;

    // Reset state
    lastPriceRef.current = null;
    candles.current = [];
    currentCandle.current = null;
    currentMinute.current = -1;
    userPositionedChart.current = false;

    // Clear price line tracking
    if (priceLinesRef.current) {
      priceLinesRef.current.clear();
    }

    // Recreate chart
    createTradingChart();
  }, [selectedToken, isInitialized, createTradingChart]);

  // ===== SYNC tradeLevels with chart =====
  // Track price lines that we've created in a ref
  const priceLinesRef = useRef<Map<string, any>>(new Map());

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

  // ===== HANDLE CHART CLICKS =====
  const handleChartClick = useCallback(
    (param: { point?: { x: number; y: number } }) => {
      console.log(param);
      console.log(activeTradeFlow);
      if (!param.point || !seriesRef.current || !activeTradeFlow) return;

      // Convert y-coordinate to price
      const price = seriesRef.current.coordinateToPrice(
        param.point.y,
      ) as number;
      if (price === null) return;

      console.log(price);

      const flow = tradeFlows.find((f) => f.id === activeTradeFlow);
      if (!flow) return;

      console.log(flow);

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
        // TODO: This logic can be simplified, lots of repeated code
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
    },
    [
      activeTradeFlow,
      activeTradeFlowStep,
      tradeFlows,
      placedOrderTypes,
      addTradeLevel,
      setActiveTradeFlowStep,
      activateTradeFlow,
      calculatePresetPrice,
    ],
  );

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

        // Process for candle
        const minute = Math.floor(timestamp / (60 * 1000));
        const utcTimestamp = Math.floor(timestamp / 1000) as UTCTimestamp;

        // Check if this is a new minute
        if (minute !== currentMinute.current) {
          // Finalize previous candle if it exists
          if (currentCandle.current) {
            currentCandle.current.close = lastPriceRef.current;
            candles.current.push({ ...currentCandle.current });
          }

          // Create new candle
          currentMinute.current = minute;
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
        }

        // Update chart data
        const updatedCandles = [...candles.current];
        if (currentCandle.current) {
          updatedCandles.push(currentCandle.current);
        }
        seriesRef.current.setData(updatedCandles);

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
          cursor: activeTradeFlow ? "crosshair" : "default",
        }}
        data-testid="chart-container"
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
