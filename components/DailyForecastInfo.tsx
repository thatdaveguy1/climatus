

import React, { useState } from 'react';

const DailyForecastInfo: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="relative my-4 p-4 bg-gray-900/70 backdrop-blur-sm border border-blue-500/30 rounded-xl shadow-md text-sm text-gray-300">
            <button
                onClick={() => setIsVisible(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white"
                aria-label="Dismiss"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <h4 className="font-bold text-blue-400 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                7-Day Forecast Logic
            </h4>
            <p className="mb-2">Daily values are aggregated directly from the API for the local timezone:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 list-disc list-inside">
                <li><strong>Temperatures:</strong> Daily maximum/minimum</li>
                <li><strong>Rainfall:</strong> Total accumulation</li>
                <li><strong>Snowfall:</strong> Total accumulation</li>
                <li><strong>Wind Speed:</strong> Peak for the day</li>
                <li><strong>Wind Gusts:</strong> Peak for the day</li>
                <li><strong>Cloud/Visibility:</strong> Daily median/minimum (median model only)</li>
            </ul>
        </div>
    );
};

export default DailyForecastInfo;