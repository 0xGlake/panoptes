import React, { useState, useEffect } from "react";

type TradeType = "perp" | "spot";
type TradePlacement = "mark" | "limit";
type TradeDirection = "buy" | "sell";
type TradeSpecialAction = "takeP" | "stopL";
type TradeDecorator = TradeDirection | TradeSpecialAction;
type Trade = `${TradeType}${TradePlacement}${TradeDecorator}`;

interface TradeFlow {
  id: string;
  macro: string;
  trades: Trade[];
}

interface TradeFlowFactoryProps {
  onExecuteTradeFlow: (tradeFlow: TradeFlow) => void;
}

const TradeFlowFactory: React.FC<TradeFlowFactoryProps> = ({
  onExecuteTradeFlow,
}) => {
  const [tradeFlows, setTradeFlows] = useState<TradeFlow[]>([]);
  const [editingMacroId, setEditingMacroId] = useState<string | null>(null);
  const [assigningKeyId, setAssigningKeyId] = useState<string | null>(null);
  const [listeningForKey, setListeningForKey] = useState(false);

  // Capture keyboard events for macro assignment
  useEffect(() => {
    if (!listeningForKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      // Only allow modifier + key combinations
      if (!(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) {
        return;
      }

      const keyCombo = [
        e.ctrlKey ? "Ctrl+" : "",
        e.altKey ? "Alt+" : "",
        e.shiftKey ? "Shift+" : "",
        e.metaKey ? "Meta+" : "",
        e.key.toUpperCase(),
      ].join("");

      if (assigningKeyId) {
        setTradeFlows((flows) =>
          flows.map((flow) =>
            flow.id === assigningKeyId ? { ...flow, macro: keyCombo } : flow,
          ),
        );
        setAssigningKeyId(null);
        setListeningForKey(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [listeningForKey, assigningKeyId]);

  // Listen for macro execution
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyCombo = [
        e.ctrlKey ? "Ctrl+" : "",
        e.altKey ? "Alt+" : "",
        e.shiftKey ? "Shift+" : "",
        e.metaKey ? "Meta+" : "",
        e.key.toUpperCase(),
      ].join("");

      const matchedFlow = tradeFlows.find((flow) => flow.macro === keyCombo);
      if (matchedFlow) {
        e.preventDefault();
        onExecuteTradeFlow(matchedFlow);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [tradeFlows, onExecuteTradeFlow]);

  // Create a new trade flow
  const createTradeFlow = (type: TradePlacement) => {
    const placement = type;
    // For MVP, hardcode as spot
    const tradeType: TradeType = "spot";

    // For now, always start with Buy
    const newTrade: Trade = `${tradeType}${placement}Buy`;

    const newFlow: TradeFlow = {
      id: `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      macro: "",
      trades: [newTrade],
    };

    setTradeFlows((prev) => [...prev, newFlow]);
    setEditingMacroId(newFlow.id);
  };

  // Add a step to an existing trade flow
  const addTradeStep = (flowId: string, step: TradeSpecialAction) => {
    setTradeFlows((flows) =>
      flows.map((flow) => {
        if (flow.id === flowId) {
          // Check if step already exists
          const hasStep = flow.trades.some((trade) => trade.includes(step));
          if (hasStep) return flow;

          // Get the current trade type and placement
          const [tradeType, placement] = flow.trades[0]
            .split(/(?=[A-Z])/)[0]
            .split(/(?=[a-z])/)
            .filter(Boolean) as [TradeType, TradePlacement];

          // Add the new step
          const newTrade: Trade = `${tradeType}${placement}${step}` as Trade;
          return { ...flow, trades: [...flow.trades, newTrade] };
        }
        return flow;
      }),
    );
  };

  // Remove a trade flow
  const removeTradeFlow = (flowId: string) => {
    setTradeFlows((flows) => flows.filter((flow) => flow.id !== flowId));
    if (editingMacroId === flowId) setEditingMacroId(null);
    if (assigningKeyId === flowId) {
      setAssigningKeyId(null);
      setListeningForKey(false);
    }
  };

  // Remove a specific step from a trade flow
  const removeTradeStep = (flowId: string, index: number) => {
    setTradeFlows((flows) =>
      flows.map((flow) => {
        if (flow.id === flowId) {
          // Keep the first element always (entry point)
          if (index === 0) return flow;

          const newTrades = flow.trades.filter((_, i) => i !== index);
          return { ...flow, trades: newTrades };
        }
        return flow;
      }),
    );
  };

  // Render UI for selecting trade steps based on what's already in the flow
  const renderStepOptions = (flow: TradeFlow) => {
    const hasTakeP = flow.trades.some((t) => t.includes("takeP"));
    const hasStopL = flow.trades.some((t) => t.includes("stopL"));

    return (
      <div className="flex space-x-2">
        {!hasTakeP && (
          <button
            onClick={() => addTradeStep(flow.id, "takeP")}
            className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 rounded text-white"
          >
            + Take Profit
          </button>
        )}
        {!hasStopL && (
          <button
            onClick={() => addTradeStep(flow.id, "stopL")}
            className="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 rounded text-white"
          >
            + Stop Loss
          </button>
        )}
      </div>
    );
  };

  // Get user-friendly name for trade step
  const getTradeStepName = (trade: Trade) => {
    if (trade.includes("mark") && trade.includes("Buy")) return "Entry (Buy)";
    if (trade.includes("mark") && trade.includes("Sell")) return "Entry (Sell)";
    if (trade.includes("limit") && trade.includes("Buy")) return "Limit Buy";
    if (trade.includes("limit") && trade.includes("Sell")) return "Limit Sell";
    if (trade.includes("takeP")) return "Take Profit";
    if (trade.includes("stopL")) return "Stop Loss";
    return trade;
  };

  // Get appropriate color for each trade step
  const getTradeStepColor = (trade: Trade) => {
    if (trade.includes("Buy")) return "bg-green-700";
    if (trade.includes("Sell")) return "bg-red-700";
    if (trade.includes("takeP")) return "bg-blue-700";
    if (trade.includes("stopL")) return "bg-orange-700";
    return "bg-gray-700";
  };

  return (
    <div className="w-full mt-4 border border-gray-700 rounded-lg p-4 bg-gray-900">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-white">Trade Flow Macros</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => createTradeFlow("mark")}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white"
          >
            Add Market Macro
          </button>
          <button
            onClick={() => createTradeFlow("limit")}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white"
          >
            Add Limit Macro
          </button>
        </div>
      </div>

      {tradeFlows.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          No trade flows yet. Create one by clicking &quot;Add Market
          Macro&quot; or &quot;Add &quot;.
        </div>
      ) : (
        <div className="space-y-4">
          {tradeFlows.map((flow) => (
            <div
              key={flow.id}
              className="border border-gray-700 rounded-lg p-3 bg-gray-800"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <span className="text-white font-medium mr-2">
                    {flow.trades[0].includes("mark")
                      ? "Market Flow"
                      : "Limit Flow"}
                  </span>
                  {flow.macro ? (
                    <span className="bg-gray-700 px-2 py-1 rounded text-xs text-white">
                      {flow.macro}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs italic">
                      No shortcut
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setAssigningKeyId(flow.id);
                      setListeningForKey(true);
                    }}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white"
                  >
                    {assigningKeyId === flow.id && listeningForKey
                      ? "Press keys..."
                      : "Assign Shortcut"}
                  </button>
                  <button
                    onClick={() => removeTradeFlow(flow.id)}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {flow.trades.map((trade, index) => (
                  <div
                    key={index}
                    className={`relative flex items-center rounded px-2 py-1 text-xs text-white ${getTradeStepColor(
                      trade,
                    )}`}
                  >
                    <span>{getTradeStepName(trade)}</span>
                    {index > 0 && (
                      <button
                        onClick={() => removeTradeStep(flow.id, index)}
                        className="ml-2 text-white opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {editingMacroId === flow.id && renderStepOptions(flow)}
              </div>

              <div className="flex justify-between">
                {editingMacroId === flow.id ? (
                  <button
                    onClick={() => setEditingMacroId(null)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Done
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingMacroId(flow.id)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Edit Steps
                  </button>
                )}
                <button
                  onClick={() => onExecuteTradeFlow(flow)}
                  className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white"
                >
                  Execute
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradeFlowFactory;
