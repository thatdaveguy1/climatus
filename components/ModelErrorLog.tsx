import React from 'react';
import { ModelError } from '../types';

interface ModelErrorLogProps {
  errors: ModelError[];
  onClear: () => void;
}

const ModelErrorLog: React.FC<ModelErrorLogProps> = ({ errors, onClear }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="my-6 p-4 bg-red-900/50 border border-red-700 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-red-400">Model Data Issues</h3>
        <button
          onClick={onClear}
          className="text-red-300 hover:text-white"
          aria-label="Dismiss errors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-red-300 mb-4">The following models could not be loaded. They will be excluded from the charts and analysis.</p>
      <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
        {errors.map((error, index) => (
          <li key={index} className="p-2 bg-red-800/40 rounded">
            <span className="font-semibold text-red-200">{error.modelName}:</span>
            <span className="ml-2 text-red-300 font-mono">{error.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ModelErrorLog;
