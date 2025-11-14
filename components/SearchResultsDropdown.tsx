
import React from 'react';
import { Location } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface SearchResultsDropdownProps {
  results: Location[];
  isLoading: boolean;
  error: string | null;
  onSelect: (location: Location) => void;
}

const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({ results, isLoading, error, onSelect }) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <LoadingSpinner />
          <span className="ml-3 text-gray-400">Searching...</span>
        </div>
      );
    }

    if (error) {
      return <p className="p-4 text-center text-red-400">{error}</p>;
    }

    if (results.length > 0) {
      return (
        <ul className="space-y-1">
          {results.map((result) => (
            <li key={result.id}>
              <button
                onClick={() => onSelect(result)}
                className="w-full text-left p-3 bg-gray-700 hover:bg-blue-600 rounded-md transition-colors"
              >
                <p className="font-semibold text-gray-100">{result.name}</p>
                <p className="text-sm text-gray-400">
                  {result.admin1}, {result.country}
                </p>
              </button>
            </li>
          ))}
        </ul>
      );
    }
    
    // This state (no results, no error, not loading) happens for short queries, so render nothing.
    return null; 
  };
  
  return (
    <div className="absolute top-full mt-2 w-full max-w-lg left-1/2 -translate-x-1/2 z-50">
      <div className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl max-h-80 overflow-y-auto p-2">
        {renderContent()}
      </div>
    </div>
  );
};

export default SearchResultsDropdown;
