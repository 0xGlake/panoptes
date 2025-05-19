import React, { useEffect } from "react";
import { TradingProvider, useTradingContext } from "../context/TradingContext";
import { TradingChart } from "./trading/TradingChart";
import { TradeFlowFactory } from "./trading/TradeFlowFactory";
import { TradeLevelsList } from "./trading/TradeLevelsList";

// We create an inner component to use the context
const TradingInterfaceInner: React.FC = () => {
  const {
    macroActive,
    activeTradeFlow,
    clearAllTradeLevels,
    tradeFlows,
    activateTradeFlow,
    activeTradeFlowStep,
  } = useTradingContext();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Get the active flow for guidance messages
  const activeFlow = tradeFlows.find((f) => f.id === activeTradeFlow);

  return (
    <div className="flex flex-col items-center w-full max-w-5xl">
      {/* Trading Chart Component */}
      <TradingChart />

      {/* Macro Active Indicator */}
      {macroActive && !activeTradeFlow && (
        <div className="w-full mt-2 bg-blue-900/20 border border-blue-700/30 rounded p-2 text-sm text-blue-100">
          <p className="text-gray-700 font-medium">Trading Macro Active</p>
          <p className="text-xs text-gray-700">
            Use the Trade Flows section below to execute trades
          </p>
        </div>
      )}

      {/* Active Trade Flow Guidance */}
      {activeTradeFlow && (
        <div className="w-full mt-2 bg-green-900/20 border border-green-700/30 rounded p-2 text-sm text-green-100">
          <p className="text-green-700 font-medium">TradeFlow Active</p>
          <p className="text-xs text-green-700">
            {`Step ${activeTradeFlowStep + 1}: ${
              activeFlow?.trades[activeTradeFlowStep]?.includes("takeP")
                ? "Place take profit level (limit order)"
                : activeFlow?.trades[activeTradeFlowStep]?.includes("stopL")
                  ? "Place stop loss level (limit order)"
                  : activeFlow?.trades[0].includes("mark")
                    ? "Market entry will be placed automatically at current price"
                    : "Place limit entry level"
            }`}
          </p>
        </div>
      )}

      {/* TradeFlowFactory Component */}
      <TradeFlowFactory />

      {/* TradeLevelsList Component */}
      <TradeLevelsList />
    </div>
  );
};

// The main component wraps the inner component with the provider
const TradingInterface: React.FC = () => {
  return (
    <TradingProvider>
      <TradingInterfaceInner />
    </TradingProvider>
  );
};

export default TradingInterface;
