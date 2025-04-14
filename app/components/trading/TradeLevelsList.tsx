import React from "react";
import { useTradingContext } from "../../context/TradingContext";

export const TradeLevelsList: React.FC = () => {
  const { tradeLevels, removeTradeLevel, clearAllTradeLevels } =
    useTradingContext();

  // If no trade levels, don't render the component
  if (tradeLevels.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-4 border-t border-gray-700 pt-4">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-medium text-gray-300">Trade Levels</h3>
        {tradeLevels.length > 1 && (
          <button
            className="text-red-400 hover:text-red-300 text-xs"
            onClick={clearAllTradeLevels}
          >
            Clear All
          </button>
        )}
      </div>
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
              onClick={() => removeTradeLevel(level.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
