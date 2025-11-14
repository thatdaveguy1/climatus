import React from 'react';
import { ForecastView } from '../types';

interface AISummaryProps {
  summary: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  activeView: ForecastView;
}

// Internal component for simple markdown rendering
const SimpleMarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // First, handle special replacements like the LaTeX degree symbols
  let cleanedText = text;
  cleanedText = cleanedText.replace(/\$(-?[\d.]+)\^\{[^\}]+\}\\text\{C\}\$/g, '$1°C');
  cleanedText = cleanedText.replace(/\$(-?[\d.]+)\^\{[^\}]+\}\$/g, '$1°');

  // Then, process basic markdown by splitting by bold/italic markers while keeping them
  const parts = cleanedText.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
};

const AISummary: React.FC<AISummaryProps> = ({ summary, isLoading, error, onRetry, activeView }) => {

  const renderSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-6 w-3/5 bg-gray-700 rounded mb-4"></div>
      {activeView === 'daily' ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start space-x-2">
              <div className="h-4 w-1/4 bg-gray-700 rounded"></div>
              <div className="h-4 w-4/5 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 w-5/6 bg-gray-700 rounded"></div>
          <div className="h-4 w-4/6 bg-gray-700 rounded"></div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return renderSkeleton();
    }

    if (error) {
      return (
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    
    if (summary) {
        if (activeView === 'daily') {
            const listMarker = '\n- **';
            const listStartIndex = summary.indexOf(listMarker);
            
            let overview = summary.trim();
            let listItemsRaw: string[] = [];

            if (listStartIndex !== -1) {
                overview = summary.substring(0, listStartIndex).trim();
                const listPart = summary.substring(listStartIndex).trim();
                listItemsRaw = listPart.split(/(?=\n- \*\*)/g).map(item => item.trim()).filter(Boolean);
            }
            
            const dayPattern = /^- \*\*(.*?):\*\* (.*)/s; // Use 's' flag to allow '.' to match newlines in content
            const validListItems = listItemsRaw.map(item => item.match(dayPattern)).filter((match): match is RegExpMatchArray => match !== null);

            const renderOverview = <p className="text-gray-300 mb-4"><SimpleMarkdownRenderer text={overview} /></p>;

            if (validListItems.length !== 7 && listStartIndex !== -1) {
                console.warn(`[AI Summary] Daily view expected 7 list items, but found ${validListItems.length}. Displaying overview only.`);
                return renderOverview;
            }

            if (validListItems.length > 0) {
                 return (
                    <>
                        {overview && renderOverview}
                        <ul className="space-y-3">
                            {validListItems.map((match, index) => {
                                const day = match[1];
                                const content = match[2];
                                return (
                                    <li key={index} className="grid grid-cols-[90px_1fr] gap-x-4 items-start">
                                        <span className="font-bold text-gray-100 text-right">{day}:</span>
                                        <span className="text-gray-300 leading-relaxed"><SimpleMarkdownRenderer text={content} /></span>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                );
            }
            
            // Fallback for when no list is detected at all.
            return <p className="text-gray-300 whitespace-pre-wrap leading-relaxed"><SimpleMarkdownRenderer text={summary} /></p>;
        }
        // For hourly view, just render the whole summary.
        return <p className="text-gray-300 whitespace-pre-wrap leading-relaxed"><SimpleMarkdownRenderer text={summary} /></p>;
    }

    return null;
  };

  // Only render the container if there's something to show (loading, error, or summary)
  if (!isLoading && !error && !summary) {
    return null;
  }

  return (
    <div className="mb-8 p-4 sm:p-6 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg">
      {renderContent()}
    </div>
  );
};

export default AISummary;