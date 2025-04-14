import React from "react";
import { Trade, TradeSpecialAction } from "../../types/tradingTypes";
import { useTradingContext } from "../../context/TradingContext";

interface TradeStepProps {
  flowId: string;
  trade: Trade;
  index: number;
  isLastStep: boolean;
}

export const TradeStep: React.FC<TradeStepProps> = ({
  flowId,
  trade,
  index,
  isLastStep,
}) => {
  const { removeStepFromTradeFlow } = useTradingContext();

  // Determine the step type for display and styling
  const getStepDisplay = () => {
    if (trade.includes("mark")) {
      return {
        label: "Market Entry",
        bgClass: "bg-green-900/50 text-green-200",
      };
    } else if (trade.includes("takeP")) {
      return {
        label: "Take Profit (Limit)",
        bgClass: "bg-blue-900/50 text-blue-200",
      };
    } else if (trade.includes("stopL")) {
      return {
        label: "Stop Loss (Limit)",
        bgClass: "bg-orange-900/50 text-orange-200",
      };
    } else {
      return {
        label: "Limit Entry",
        bgClass: "bg-purple-900/50 text-purple-200",
      };
    }
  };

  const { label, bgClass } = getStepDisplay();

  // Determine if this step can be removed (entry steps cannot be removed)
  const canRemove = index > 0;

  // Determine the step type for removal
  const getStepType = (): TradeSpecialAction | null => {
    if (trade.includes("takeP")) return "takeP";
    if (trade.includes("stopL")) return "stopL";
    return null;
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    const stepType = getStepType();
    if (stepType) {
      removeStepFromTradeFlow(flowId, stepType);
    }
  };

  return (
    <div className="flex items-center group relative">
      <div className={`px-2 py-1 rounded text-xs ${bgClass}`}>
        {label}

        {/* Remove step button (only show for non-entry steps) */}
        {canRemove && (
          <button
            onClick={handleRemove}
            className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity"
            title="Remove step"
          >
            ✕
          </button>
        )}
      </div>

      {!isLastStep && <span className="text-gray-500 mx-1">→</span>}
    </div>
  );
};
