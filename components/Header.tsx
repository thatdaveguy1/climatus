
import React from 'react';
import { HeaderProps } from '../types';

const Header: React.FC<HeaderProps> = ({ location, searchQuery, setSearchQuery, onSearchFocus }) => {
  return (
    <header className="text-center mb-2">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
        Climatus
      </h1>
      <p className="mt-2 text-lg text-gray-400">
        {location.name}, {location.admin1}, {location.country}
      </p>

      <div className="mt-6 max-w-lg mx-auto">
        <div className="flex items-center bg-gray-800 border-2 border-gray-700 rounded-full shadow-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={onSearchFocus}
            placeholder="Search for a city (e.g., Edmonton)"
            className="w-full bg-transparent py-3 px-6 text-gray-200 placeholder-gray-500 focus:outline-none"
            aria-label="Search for a location"
            autoComplete="off"
          />
          <div className="p-3">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
