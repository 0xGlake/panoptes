import React, { useState } from "react";
import { TradeStep } from "./TradeStep";
import { useTradingContext } from "../../context/TradingContext";
import { TradeSpecialAction } from "../../types/tradingTypes";

interface TradeFlowItemProps {
  flowId: string;
}

export const TradeFlowItem: React.FC<TradeFlowItemProps> = ({ flowId }) => {
  const {
    tradeFlows,
    activateTradeFlow,
    updateMacroShortcut,
    deleteTradeFlow,
    addStepToTradeFlow,
    removeStepFromTradeFlow,
    togglePresetMode,
    updateTradeFlowPreset,
  } = useTradingContext();

  const [showStepDropdown, setShowStepDropdown] = useState(false);

  // Find the flow with this ID
  const flow = tradeFlows.find((f) => f.id === flowId);

  if (!flow) return null;

  // Is this a market or limit flow?
  const isMarketFlow = flow.trades[0].includes("mark");

  // How many steps are in this flow?
  const totalSteps = flow.trades.length;

  // Can we add more steps? (max 3 total steps)
  const canAddSteps = totalSteps < 3;

  // Handle adding a step
  const handleAddStep = (stepType: TradeSpecialAction) => {
    addStepToTradeFlow(flowId, stepType);
    setShowStepDropdown(false);
  };

  return (
    <div className="bg-gray-800 rounded p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <span className="text-gray-300 font-medium">
            {isMarketFlow ? "Market" : "Limit"} Flow
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
            onChange={(e) => updateMacroShortcut(flow.id, e.target.value)}
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
            <TradeStep
              key={`${flow.id}-trade-${index}`}
              flowId={flow.id}
              trade={trade}
              index={index}
              isLastStep={index === flow.trades.length - 1}
            />
          ))}
        </div>

        {canAddSteps && (
          <div className="relative">
            <button
              className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
              onClick={() => setShowStepDropdown(!showStepDropdown)}
            >
              + Add Step
            </button>

            {showStepDropdown && (
              <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
                {!flow.trades.some((t) => t.includes("takeP")) && (
                  <button
                    className="block w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700"
                    onClick={() => handleAddStep("takeP")}
                  >
                    Take Profit
                  </button>
                )}

                {!flow.trades.some((t) => t.includes("stopL")) && (
                  <button
                    className="block w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700"
                    onClick={() => handleAddStep("stopL")}
                  >
                    Stop Loss
                  </button>
                )}
              </div>
            )}
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
                  <span className="text-xs text-gray-400 ml-1">%</span>
                </div>
              )}

              {/* Remove take profit button */}
              <button
                onClick={() => removeStepFromTradeFlow(flow.id, "takeP")}
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
                  <span className="text-xs text-gray-400 ml-1">%</span>
                </div>
              )}

              {/* Remove stop loss button */}
              <button
                onClick={() => removeStepFromTradeFlow(flow.id, "stopL")}
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
  );
};
