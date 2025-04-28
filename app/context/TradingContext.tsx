// /context/TradingContext.tsx
import React, { createContext, useContext, useState, useCallback } from "react";
import {
  TradeType,
  TradePlacement,
  TradeDirection,
  TradeSpecialAction,
  TradeLevel,
  TradeFlow,
  Trade,
} from "../types/tradingTypes";
import { ArbitrageToken, ARBITRAGE_TOKENS } from "../types/arbitrageTokens";

interface TradingContextType {
  // State
  selectedToken: ArbitrageToken;
  macroActive: boolean;
  tradeLevels: TradeLevel[];
  tradeFlows: TradeFlow[];
  activeTradeFlow: string | null;
  activeTradeFlowStep: number;

  // Functions
  setSelectedToken: (token: ArbitrageToken) => void;
  setMacroActive: (active: boolean) => void;
  addTradeLevel: (level: Omit<TradeLevel, "id">) => void;
  removeTradeLevel: (id: string) => void;
  clearAllTradeLevels: () => void;
  createTradeFlow: (firstTradeType: TradePlacement) => void;
  deleteTradeFlow: (flowId: string) => void;
  addStepToTradeFlow: (flowId: string, stepType: TradeSpecialAction) => void;
  removeStepFromTradeFlow: (
    flowId: string,
    stepType: TradeSpecialAction,
  ) => void;
  updateTradeFlowPreset: (
    flowId: string,
    stepType: TradeSpecialAction,
    value: number,
  ) => void;
  togglePresetMode: (flowId: string, stepType: TradeSpecialAction) => void;
  updateMacroShortcut: (flowId: string, shortcut: string) => void;
  activateTradeFlow: (flowId: string) => void;
  setActiveTradeFlowStep: (step: number) => void;
  calculatePresetPrice: (
    entryPrice: number,
    direction: TradeDirection,
    stepType: TradeSpecialAction,
    percentage: number,
  ) => number;
}

// Create context with default values
export const TradingContext = createContext<TradingContextType>({
  selectedToken: ARBITRAGE_TOKENS[0],
  macroActive: false,
  tradeLevels: [],
  tradeFlows: [],
  activeTradeFlow: null,
  activeTradeFlowStep: 0,

  setSelectedToken: () => {},
  setMacroActive: () => {},
  addTradeLevel: () => {},
  removeTradeLevel: () => {},
  clearAllTradeLevels: () => {},
  createTradeFlow: () => {},
  deleteTradeFlow: () => {},
  addStepToTradeFlow: () => {},
  removeStepFromTradeFlow: () => {},
  updateTradeFlowPreset: () => {},
  togglePresetMode: () => {},
  updateMacroShortcut: () => {},
  activateTradeFlow: () => {},
  setActiveTradeFlowStep: () => {},
  calculatePresetPrice: () => 0,
});

export const useTradingContext = () => useContext(TradingContext);

interface TradingProviderProps {
  children: React.ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({
  children,
}) => {
  const [selectedToken, setSelectedToken] = useState<ArbitrageToken>(
    ARBITRAGE_TOKENS[0],
  );
  const [macroActive, setMacroActive] = useState(false);
  const [tradeLevels, setTradeLevels] = useState<TradeLevel[]>([]);
  const [tradeFlows, setTradeFlows] = useState<TradeFlow[]>([]);
  const [activeTradeFlow, setActiveTradeFlow] = useState<string | null>(null);
  const [activeTradeFlowStep, setActiveTradeFlowStep] = useState<number>(0);

  // Add a trade level - no chart manipulation, just state update
  const addTradeLevel = useCallback((level: Omit<TradeLevel, "id">) => {
    const id = `level-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    setTradeLevels((prev) => [...prev, { ...level, id }]);
  }, []);

  // Remove a trade level - no chart manipulation, just state update
  const removeTradeLevel = useCallback((id: string) => {
    setTradeLevels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Clear all trade levels - no chart manipulation, just state update
  const clearAllTradeLevels = useCallback(() => {
    setTradeLevels([]);
  }, []);

  // Create a new trade flow
  const createTradeFlow = useCallback((firstTradeType: TradePlacement) => {
    const id = `flow-${Date.now()}`;
    const tradeType: TradeType = "spot"; // For MVP, all trades are hardcoded as "spot" type
    const direction: TradeDirection = "Buy"; // Direction is initially set to Buy, will be determined dynamically later
    const firstTrade: Trade = `${tradeType}${firstTradeType}${direction}`;

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
  }, []);

  // Delete a trade flow
  const deleteTradeFlow = useCallback((flowId: string) => {
    setTradeFlows((prev) => prev.filter((flow) => flow.id !== flowId));
  }, []);

  // Add a step to a trade flow
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

  // Remove a step from a trade flow
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
              // If we're removing this step, also reset its preset mode
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

  // Activate a trade flow
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

  // Calculate preset price based on entry price, direction, and percentage
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

  // Prepare the context value
  const contextValue = {
    selectedToken,
    macroActive,
    tradeLevels,
    tradeFlows,
    activeTradeFlow,
    activeTradeFlowStep,

    setSelectedToken,
    setMacroActive,
    addTradeLevel,
    removeTradeLevel,
    clearAllTradeLevels,
    createTradeFlow,
    deleteTradeFlow,
    addStepToTradeFlow,
    removeStepFromTradeFlow,
    updateTradeFlowPreset,
    togglePresetMode,
    updateMacroShortcut,
    activateTradeFlow,
    setActiveTradeFlowStep,
    calculatePresetPrice,
  };

  return (
    <TradingContext.Provider value={contextValue}>
      {children}
    </TradingContext.Provider>
  );
};
