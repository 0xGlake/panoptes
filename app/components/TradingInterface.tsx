import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
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

type TradeType = "perp" | "spot";
type TradePlacement = "mark" | "limit";
type TradeDirection = "Buy" | "Sell";
type TradeSpecialAction = "takeP" | "stopL";
type TradeDecorator = TradeDirection | TradeSpecialAction;
type Trade = `${TradeType}${TradePlacement}${TradeDecorator}`;

interface TradeLevel {
  id: string;
  type: Trade;
  active: boolean;
  quantity: number;
  IpriceLine: IPriceLine;
}

interface TradeFlow {
  id: string;
  macro: string; // Keyboard shortcut
  trades: Trade[];
  presets: {
    takeP: number | null;
    stopL: number | null;
  };
  presetMode: {
    takeP: boolean;
    stopL: boolean;
  };
}

const TradingInterface: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<ArbitrageToken>(
    ARBITRAGE_TOKENS[0],
  );
  const [macroActive, setMacroActive] = useState(false);
  const [tradeLevels, setTradeLevels] = useState<TradeLevel[]>([]);
  const [tradeFlows, setTradeFlows] = useState<TradeFlow[]>([]);
  const [activeTradeFlow, setActiveTradeFlow] = useState<string | null>(null);
  const [activeTradeFlowStep, setActiveTradeFlowStep] = useState<number>(0);
  const [showAddMacroDropdown, setShowAddMacroDropdown] = useState(false);

  const macroActiveRef = useRef(false);
  const activeTradeFlowRef = useRef<string | null>(null);
  const activeTradeFlowStepRef = useRef<number>(0);

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

  // Create new trade flow
  const createTradeFlow = useCallback((firstTradeType: TradePlacement) => {
    // Create a unique ID
    const id = `flow-${Date.now()}`;

    // For MVP, all trades are hardcoded as "spot" type
    const tradeType: TradeType = "spot";

    // Direction is initially set to Buy, will be determined dynamically later
    const direction: TradeDirection = "Buy";

    // Create the first trade in the flow
    const firstTrade: Trade = `${tradeType}${firstTradeType}${direction}`;

    // Create new trade flow
    const newTradeFlow: TradeFlow = {
      id,
      macro: "", // No keyboard shortcut initially
      trades: [firstTrade],
      presets: {
        takeP: 5, // Default 5% take profit
        stopL: 3, // Default 3% stop loss
      },
      presetMode: {
        takeP: false, // Manual mode by default
        stopL: false, // Manual mode by default
      },
    };

    setTradeFlows((prev) => [...prev, newTradeFlow]);
    setShowAddMacroDropdown(false);
  }, []);

  // Add step to trade flow
  const addStepToTradeFlow = useCallback(
    (flowId: string, stepType: TradeSpecialAction) => {
      setTradeFlows((prev) =>
        prev.map((flow) => {
          if (flow.id === flowId) {
            // Check if this step type already exists
            const hasStepType = flow.trades.some((trade) =>
              trade.includes(stepType),
            );

            if (hasStepType) {
              // Skip if already exists
              return flow;
            }

            // For MVP, all trades are hardcoded as "spot" type
            const tradeType: TradeType = "spot";

            // Use the placement type from the first trade
            const placement = flow.trades[0].includes("mark")
              ? "mark"
              : "limit";

            // Create the new trade
            const newTrade: Trade = `${tradeType}${placement}${stepType}`;

            return {
              ...flow,
              trades: [...flow.trades, newTrade],
            };
          }
          return flow;
        }),
      );
    },
    [],
  );

  // Update trade flow preset
  const updateTradeFlowPreset = useCallback(
    (flowId: string, stepType: TradeSpecialAction, value: number) => {
      setTradeFlows((prev) =>
        prev.map((flow) => {
          if (flow.id === flowId) {
            return {
              ...flow,
              presets: {
                ...flow.presets,
                [stepType]: value,
              },
            };
          }
          return flow;
        }),
      );
    },
    [],
  );

  // Toggle preset mode
  const togglePresetMode = useCallback(
    (flowId: string, stepType: TradeSpecialAction) => {
      setTradeFlows((prev) =>
        prev.map((flow) => {
          if (flow.id === flowId) {
            return {
              ...flow,
              presetMode: {
                ...flow.presetMode,
                [stepType]: !flow.presetMode[stepType],
              },
            };
          }
          return flow;
        }),
      );
    },
    [],
  );

  // Update macro shortcut
  const updateMacroShortcut = useCallback(
    (flowId: string, shortcut: string) => {
      setTradeFlows((prev) =>
        prev.map((flow) => {
          if (flow.id === flowId) {
            return {
              ...flow,
              macro: shortcut,
            };
          }
          return flow;
        }),
      );
    },
    [],
  );

  // Delete trade flow
  const deleteTradeFlow = useCallback((flowId: string) => {
    setTradeFlows((prev) => prev.filter((flow) => flow.id !== flowId));
  }, []);

  // Remove specific step from trade flow (NEW)
  const removeStepFromTradeFlow = useCallback(
    (flowId: string, stepType: TradeSpecialAction) => {
      setTradeFlows((prev) =>
        prev.map((flow) => {
          if (flow.id === flowId) {
            // Filter out the step with this type
            const updatedTrades = flow.trades.filter(
              (trade) => !trade.includes(stepType),
            );

            return {
              ...flow,
              trades: updatedTrades,
              // If we're removing this step, also reset its preset mode and value
              presetMode: {
                ...flow.presetMode,
                [stepType]: false,
              },
            };
          }
          return flow;
        }),
      );
    },
    [],
  );

  // Activate trade flow
  const activateTradeFlow = useCallback(
    (flowId: string) => {
      // Clear any existing active flow
      if (activeTradeFlow) {
        setActiveTradeFlow(null);
        setActiveTradeFlowStep(0);
      } else {
        setActiveTradeFlow(flowId);
        setActiveTradeFlowStep(0);
        setMacroActive(true); // Ensure macro mode is active
      }
    },
    [activeTradeFlow],
  );

  // Calculate prices for preset modes
  const calculatePresetPrice = useCallback(
    (
      entryPrice: number,
      direction: TradeDirection,
      stepType: TradeSpecialAction,
      percentage: number,
    ): number => {
      if (stepType === "takeP") {
        return direction === "Buy"
          ? entryPrice * (1 + percentage / 100)
          : entryPrice * (1 - percentage / 100);
      } else {
        // stopL
        return direction === "Buy"
          ? entryPrice * (1 - percentage / 100)
          : entryPrice * (1 + percentage / 100);
      }
    },
    [],
  );

  // Determine trade direction based on stop loss position
  const determineDirection = (
    entryPrice: number,
    stopLossPrice: number,
  ): TradeDirection => {
    return stopLossPrice < entryPrice ? "Buy" : "Sell";
  };

  // Update refs when state changes
  useEffect(() => {
    macroActiveRef.current = macroActive;
  }, [macroActive]);

  useEffect(() => {
    activeTradeFlowRef.current = activeTradeFlow;
  }, [activeTradeFlow]);

  useEffect(() => {
    activeTradeFlowStepRef.current = activeTradeFlowStep;
  }, [activeTradeFlowStep]);

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

      // Check for custom macro shortcuts
      tradeFlows.forEach((flow) => {
        if (flow.macro && e.key === flow.macro.toUpperCase() && e.shiftKey) {
          activateTradeFlow(flow.id);
          e.preventDefault();
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearAllTradeLevels, activateTradeFlow, tradeFlows]);

  // Handle chart clicks
  const handleChartClick = useCallback(
    (param: { point?: { x: number; y: number } }) => {
      if (!param.point || !chartRefs.current.candleSeries) return;

      // Convert the y-coordinate to price
      const price = chartRefs.current.candleSeries.coordinateToPrice(
        param.point.y,
      );

      // Check if price is null before proceeding
      if (price === null) return;

      // Handle active trade flow
      if (activeTradeFlowRef.current) {
        const flow = tradeFlows.find(
          (f) => f.id === activeTradeFlowRef.current,
        );

        if (!flow) return;

        const step = activeTradeFlowStepRef.current;
        const trade = flow.trades[step];

        if (!trade) return;

        // If this is a market order and the first step (entry)
        if (flow.trades[0].includes("mark") && step === 0) {
          // For market orders, the entry is automatically set at the current price (last price)
          if (lastPrice.current === null) return;

          // Create unique ID for this trade level
          const id = `level-${Date.now()}`;

          // Entry color is green
          const color = "#4CAF50";
          const title = "Market Entry";

          // Create price line config
          const lineConfig = {
            price: lastPrice.current,
            color: color,
            lineWidth: 2 as LineWidth,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${title}: ${lastPrice.current.toFixed(2)}`,
          };

          // Add price line to chart
          const priceLine =
            chartRefs.current.candleSeries.createPriceLine(lineConfig);

          // Add to state
          setTradeLevels((prev) => [
            ...prev,
            {
              id: id,
              type: trade,
              active: true,
              quantity: 1,
              IpriceLine: priceLine,
            },
          ]);

          // Move directly to next step (skip manual entry placement)
          if (step < flow.trades.length - 1) {
            setActiveTradeFlowStep(step + 1);
          } else {
            // All steps completed
            setActiveTradeFlow(null);
            setActiveTradeFlowStep(0);
          }

          return;
        }

        // For limit orders (or subsequent steps in market orders)
        // Create unique ID for this trade level
        const id = `level-${Date.now()}`;

        // Determine color and title based on trade type
        let color = "#4CAF50"; // Default green for buys
        let title = "Limit Entry";

        if (trade.includes("takeP")) {
          color = "#2196F3"; // Blue for take profit
          title = "Take Profit (Limit)";
        } else if (trade.includes("stopL")) {
          color = "#FF9800"; // Orange for stop loss
          title = "Stop Loss (Limit)";
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
        const priceLine =
          chartRefs.current.candleSeries.createPriceLine(lineConfig);

        // Add to state
        setTradeLevels((prev) => [
          ...prev,
          {
            id: id,
            type: trade,
            active: true,
            quantity: 1,
            IpriceLine: priceLine,
          },
        ]);

        // Handle automatic preset calculations if needed
        if (step === 0 && flow.trades.length > 1) {
          // This is the entry point, check if we need to auto-place take profit or stop loss
          if (flow.presetMode.takeP && flow.presets.takeP !== null) {
            // Assume Buy direction initially, will be adjusted if stop loss is placed
            const direction: TradeDirection = "Buy";
            const takeProfitPrice = calculatePresetPrice(
              price,
              direction,
              "takeP",
              flow.presets.takeP,
            );

            // Create take profit line
            const takeProfitLineConfig = {
              price: takeProfitPrice,
              color: "#2196F3", // Blue for take profit
              lineWidth: 2 as LineWidth,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `Take Profit (Limit): ${takeProfitPrice.toFixed(2)}`,
            };

            const takeProfitId = `level-${Date.now() + 1}`;
            const takeProfitPriceLine =
              chartRefs.current.candleSeries.createPriceLine(
                takeProfitLineConfig,
              );

            // Add to state
            setTradeLevels((prev) => [
              ...prev,
              {
                id: takeProfitId,
                type: flow.trades.find((t) => t.includes("takeP")) as Trade,
                active: true,
                quantity: 1,
                IpriceLine: takeProfitPriceLine,
              },
            ]);
          }

          if (flow.presetMode.stopL && flow.presets.stopL !== null) {
            // Assume Buy direction initially, will be adjusted if needed
            const direction: TradeDirection = "Buy";
            const stopLossPrice = calculatePresetPrice(
              price,
              direction,
              "stopL",
              flow.presets.stopL,
            );

            // Create stop loss line
            const stopLossLineConfig = {
              price: stopLossPrice,
              color: "#FF9800", // Orange for stop loss
              lineWidth: 2 as LineWidth,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `Stop Loss (Limit): ${stopLossPrice.toFixed(2)}`,
            };

            const stopLossId = `level-${Date.now() + 2}`;
            const stopLossPriceLine =
              chartRefs.current.candleSeries.createPriceLine(
                stopLossLineConfig,
              );

            // Add to state
            setTradeLevels((prev) => [
              ...prev,
              {
                id: stopLossId,
                type: flow.trades.find((t) => t.includes("stopL")) as Trade,
                active: true,
                quantity: 1,
                IpriceLine: stopLossPriceLine,
              },
            ]);
          }
        }

        // Move to next step or deactivate flow
        if (step < flow.trades.length - 1) {
          // Skip steps that have preset mode enabled
          let nextStep = step + 1;
          while (
            nextStep < flow.trades.length &&
            ((flow.trades[nextStep].includes("takeP") &&
              flow.presetMode.takeP) ||
              (flow.trades[nextStep].includes("stopL") &&
                flow.presetMode.stopL))
          ) {
            nextStep++;
          }

          if (nextStep < flow.trades.length) {
            setActiveTradeFlowStep(nextStep);
          } else {
            // All steps completed
            setActiveTradeFlow(null);
            setActiveTradeFlowStep(0);
          }
        } else {
          // Last step completed
          setActiveTradeFlow(null);
          setActiveTradeFlowStep(0);
        }
      }
    },
    [tradeFlows, calculatePresetPrice],
  );

  // Chart configuration options - memoized to prevent unnecessary re-renders
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

  // Candlestick series options - memoized
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

  // Handle chart initialization
  const initializeChart = useCallback(() => {
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
    const chart = createChart(containerRef.current, chartOptions);
    const candleSeries = chart.addCandlestickSeries(candleSeriesOptions);

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

    // Start with empty candles
    if (chartRefs.current.candleSeries) {
      chartRefs.current.candleSeries.setData([]);
    }

    // Auto-fit content initially
    chart.timeScale().fitContent();
  }, [handleChartClick, chartOptions, candleSeriesOptions]);

  // Make chart responsive
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && chartRefs.current.chart) {
        chartRefs.current.chart.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Initialize chart when token changes
  useEffect(() => {
    initializeChart();

    return () => {
      if (chartRefs.current.chart) {
        chartRefs.current.chart.unsubscribeClick(handleChartClick);
      }
    };
  }, [selectedToken, initializeChart]);

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
          macroActive || activeTradeFlow ? "cursor-crosshair" : ""
        }`}
      />

      <div className="w-full mt-2 text-xs text-gray-400 flex justify-between items-center">
        <span>1 Minute Candles - Ask Price</span>
        <div className="flex gap-2">
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

      {macroActive && !activeTradeFlow && (
        <div className="w-full mt-2 bg-blue-900/20 border border-blue-700/30 rounded p-2 text-sm text-blue-100">
          <p className="text-blue-100 font-medium">Trading Macro Active</p>
          <p className="text-xs text-blue-200">
            Use the Trade Flows section below to execute trades
          </p>
          <p className="text-xs text-blue-200 mt-1">
            <span className="bg-gray-800 px-1 rounded text-gray-300">
              Shift+T
            </span>{" "}
            to toggle macro mode |
            <span className="bg-gray-800 px-1 rounded ml-1 text-gray-300">
              Shift+C
            </span>{" "}
            to clear all levels
          </p>
        </div>
      )}

      {activeTradeFlow && (
        <div className="w-full mt-2 bg-green-900/20 border border-green-700/30 rounded p-2 text-sm text-green-100">
          <p className="text-green-100 font-medium">TradeFlow Active</p>
          <p className="text-xs text-green-200">
            {`Step ${activeTradeFlowStep + 1}: ${
              tradeFlows
                .find((f) => f.id === activeTradeFlow)
                ?.trades[activeTradeFlowStep]?.includes("takeP")
                ? "Place take profit level (limit order)"
                : tradeFlows
                      .find((f) => f.id === activeTradeFlow)
                      ?.trades[activeTradeFlowStep]?.includes("stopL")
                  ? "Place stop loss level (limit order)"
                  : tradeFlows
                        .find((f) => f.id === activeTradeFlow)
                        ?.trades[0].includes("mark")
                    ? "Market entry will be placed automatically at current price"
                    : "Place limit entry level"
            }`}
          </p>
        </div>
      )}

      {/* TradeFlow Factory UI */}
      <div className="w-full mt-4 border-t border-gray-700 pt-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium text-gray-300">Trade Flows</h2>

          <div className="relative">
            <button
              className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
              onClick={() => setShowAddMacroDropdown((prev) => !prev)}
            >
              Add Macro
            </button>

            {showAddMacroDropdown && (
              <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  onClick={() => createTradeFlow("mark")}
                >
                  Market Order
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  onClick={() => createTradeFlow("limit")}
                >
                  Limit Order
                </button>
              </div>
            )}
          </div>
        </div>

        {tradeFlows.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No trade flows created yet. Click "Add Macro" to create one.
          </div>
        ) : (
          <div className="space-y-4">
            {tradeFlows.map((flow) => (
              <div
                key={flow.id}
                className="bg-gray-800 rounded p-3 border border-gray-700"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <span className="text-gray-300 font-medium">
                      {flow.trades[0].includes("mark") ? "Market" : "Limit"}{" "}
                      Flow
                    </span>

                    {flow.macro && (
                      <span className="ml-2 bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-400">
                        Shift+{flow.macro.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Key"
                      className="w-8 bg-gray-700 border border-gray-600 rounded px-1 text-center text-white text-sm"
                      value={flow.macro}
                      maxLength={1}
                      onChange={(e) =>
                        updateMacroShortcut(flow.id, e.target.value)
                      }
                    />

                    <button
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500"
                      onClick={() => activateTradeFlow(flow.id)}
                    >
                      Execute
                    </button>

                    <button
                      className="text-red-400 hover:text-red-300"
                      onClick={() => deleteTradeFlow(flow.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mb-3">
                  <div className="flex-1 flex items-center space-x-1">
                    {flow.trades.map((trade, index) => (
                      <div
                        key={`${flow.id}-trade-${index}`}
                        className="flex items-center group relative"
                      >
                        <div
                          className={`px-2 py-1 rounded text-xs ${
                            trade.includes("takeP")
                              ? "bg-blue-900/50 text-blue-200"
                              : trade.includes("stopL")
                                ? "bg-orange-900/50 text-orange-200"
                                : trade.includes("mark")
                                  ? "bg-green-900/50 text-green-200"
                                  : "bg-purple-900/50 text-purple-200"
                          }`}
                        >
                          {trade.includes("mark")
                            ? "Market Entry"
                            : trade.includes("takeP")
                              ? "Take Profit (Limit)"
                              : trade.includes("stopL")
                                ? "Stop Loss (Limit)"
                                : "Limit Entry"}

                          {/* Remove step button (only show for non-entry steps) */}
                          {index > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (trade.includes("takeP")) {
                                  removeStepFromTradeFlow(flow.id, "takeP");
                                } else if (trade.includes("stopL")) {
                                  removeStepFromTradeFlow(flow.id, "stopL");
                                }
                              }}
                              className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity"
                              title="Remove step"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {index < flow.trades.length - 1 && (
                          <span className="text-gray-500 mx-1">→</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {flow.trades.length < 3 && (
                    <div className="relative">
                      <button
                        className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                        onClick={() => {
                          // Show dropdown for adding steps
                          const dropdown = document.getElementById(
                            `dropdown-${flow.id}`,
                          );
                          if (dropdown) {
                            dropdown.classList.toggle("hidden");
                          }
                        }}
                      >
                        + Add Step
                      </button>

                      <div
                        id={`dropdown-${flow.id}`}
                        className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10 hidden"
                      >
                        {!flow.trades.some((t) => t.includes("takeP")) && (
                          <button
                            className="block w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700"
                            onClick={() => {
                              addStepToTradeFlow(flow.id, "takeP");
                              document
                                .getElementById(`dropdown-${flow.id}`)
                                ?.classList.add("hidden");
                            }}
                          >
                            Take Profit
                          </button>
                        )}

                        {!flow.trades.some((t) => t.includes("stopL")) && (
                          <button
                            className="block w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700"
                            onClick={() => {
                              addStepToTradeFlow(flow.id, "stopL");
                              document
                                .getElementById(`dropdown-${flow.id}`)
                                ?.classList.add("hidden");
                            }}
                          >
                            Stop Loss
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Percentage settings for take profit and stop loss */}
                <div className="space-y-2">
                  {flow.trades.some((t) => t.includes("takeP")) && (
                    <div className="flex items-center justify-between bg-gray-700/50 p-2 rounded relative group">
                      <span className="text-xs text-blue-300">Take Profit</span>

                      <div className="flex items-center space-x-2">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={flow.presetMode.takeP}
                            onChange={() => togglePresetMode(flow.id, "takeP")}
                            className="mr-1"
                          />
                          <span className="text-xs text-gray-400">Use %</span>
                        </label>

                        {flow.presetMode.takeP && (
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={flow.presets.takeP || ""}
                              onChange={(e) =>
                                updateTradeFlowPreset(
                                  flow.id,
                                  "takeP",
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-12 bg-gray-800 border border-gray-600 rounded px-1 text-center text-white text-xs"
                              min="0.1"
                              step="0.1"
                            />
                            <span className="text-xs text-gray-400 ml-1">
                              %
                            </span>
                          </div>
                        )}

                        {/* Remove take profit button */}
                        <button
                          onClick={() =>
                            removeStepFromTradeFlow(flow.id, "takeP")
                          }
                          className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove take profit"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {flow.trades.some((t) => t.includes("stopL")) && (
                    <div className="flex items-center justify-between bg-gray-700/50 p-2 rounded relative group">
                      <span className="text-xs text-orange-300">Stop Loss</span>

                      <div className="flex items-center space-x-2">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={flow.presetMode.stopL}
                            onChange={() => togglePresetMode(flow.id, "stopL")}
                            className="mr-1"
                          />
                          <span className="text-xs text-gray-400">Use %</span>
                        </label>

                        {flow.presetMode.stopL && (
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={flow.presets.stopL || ""}
                              onChange={(e) =>
                                updateTradeFlowPreset(
                                  flow.id,
                                  "stopL",
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-12 bg-gray-800 border border-gray-600 rounded px-1 text-center text-white text-xs"
                              min="0.1"
                              step="0.1"
                            />
                            <span className="text-xs text-gray-400 ml-1">
                              %
                            </span>
                          </div>
                        )}

                        {/* Remove stop loss button */}
                        <button
                          onClick={() =>
                            removeStepFromTradeFlow(flow.id, "stopL")
                          }
                          className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove stop loss"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {tradeLevels.length > 0 && (
        <div className="w-full mt-4 border-t border-gray-700 pt-4">
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
                    {level.IpriceLine.options().title}
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
