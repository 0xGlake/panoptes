import React, { useState, useCallback, memo } from "react";
import { useTradingContext } from "../../context/TradingContext";
import { TradeFlowItem } from "./TradeFlowItem";

// Memoize the component to prevent unnecessary re-renders
export const TradeFlowFactory: React.FC = memo(() => {
  const { tradeFlows, createTradeFlow } = useTradingContext();
  const [showAddMacroDropdown, setShowAddMacroDropdown] = useState(false);

  // Handle creating new trade flow
  const handleCreateTradeFlow = useCallback(
    (tradeType: "mark" | "limit") => {
      createTradeFlow(tradeType);
      setShowAddMacroDropdown(false);
    },
    [createTradeFlow],
  );

  const toggleDropdown = useCallback(() => {
    setShowAddMacroDropdown((prev) => !prev);
  }, []);

  return (
    <div className="w-full mt-4 border-t border-gray-700 pt-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium text-gray-700">Trade Flows</h2>

        <div className="relative">
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
            onClick={toggleDropdown}
          >
            Add Macro
          </button>

          {showAddMacroDropdown && (
            <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                onClick={() => handleCreateTradeFlow("mark")}
              >
                Market Order
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                onClick={() => handleCreateTradeFlow("limit")}
              >
                Limit Order
              </button>
            </div>
          )}
        </div>
      </div>

      {tradeFlows.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No trade flows created yet. Click Add Macro to create one.
        </div>
      ) : (
        <div className="space-y-4">
          {tradeFlows.map((flow) => (
            <TradeFlowItem key={flow.id} flowId={flow.id} />
          ))}
        </div>
      )}
    </div>
  );
});

// Set display name for debugging
TradeFlowFactory.displayName = "TradeFlowFactory";
