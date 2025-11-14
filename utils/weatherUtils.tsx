import React from 'react';

// --- SVG Icon Components ---

const IconSun = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-yellow-400">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
);

const IconMoon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-slate-400">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);

export const IconCloud = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-gray-400">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
    </svg>
);

// FIX: Export IconCloudSun to make it available for import in other components.
export const IconCloudSun = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-gray-300">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        <circle cx="12" cy="10" r="4" className="text-yellow-400" fill="currentColor" stroke="none"></circle>
    </svg>
);

const IconCloudMoon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-gray-300">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        <path d="M16 12.79A9 9 0 1 1 6.21 3 7 7 0 0 0 16 12.79z" className="text-slate-400" fill="currentColor" stroke="none"></path>
    </svg>
);

const IconFog = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-gray-500">
        <path d="M2 12h20M7 12V9a5 5 0 0 1 10 0v3M4 17h16M4 20h16"></path>
    </svg>
);

const IconCloudDrizzle = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-cyan-400">
        <path d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"></path>
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
    </svg>
);

// FIX: Export IconCloudRain to make it available for import in other components.
export const IconCloudRain = () => (
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-400">
        <path d="M16 13v8M8 13v8M12 15v8"></path>
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
    </svg>
);

// FIX: Export IconCloudSnow to make it available for import in other components.
export const IconCloudSnow = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-white">
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path>
        <path d="m8 15 4 4 4-4m-4-4v8m0 0-4-4m4 4 4-4"></path>
    </svg>
);

const IconCloudLightning = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-yellow-300">
        <path d="M21.54 15a4 4 0 0 0-2.1-7.36A8 8 0 0 0 4.46 15H4a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3h-.46z"></path>
        <path d="m13 19-3 4 5 .5-3 4"></path>
    </svg>
);

// --- Weather Code Mapping ---

interface WeatherInfo {
  description: string;
  Icon: React.FC;
}

export const getWeatherInfo = (code: number, isDay: boolean): WeatherInfo => {
  switch (code) {
    case 0:
      return { description: 'Clear sky', Icon: isDay ? IconSun : IconMoon };
    case 1:
      return { description: 'Mainly clear', Icon: isDay ? IconCloudSun : IconCloudMoon };
    case 2:
      return { description: 'Partly cloudy', Icon: isDay ? IconCloudSun : IconCloudMoon };
    case 3:
      return { description: 'Overcast', Icon: IconCloud };
    case 45:
    case 48:
      return { description: 'Fog', Icon: IconFog };
    case 51:
    case 53:
    case 55:
      return { description: 'Drizzle', Icon: IconCloudDrizzle };
    case 56:
    case 57:
      return { description: 'Freezing Drizzle', Icon: IconCloudDrizzle };
    case 61:
      return { description: 'Slight rain', Icon: IconCloudRain };
    case 63:
      return { description: 'Moderate rain', Icon: IconCloudRain };
    case 65:
      return { description: 'Heavy rain', Icon: IconCloudRain };
    case 66:
    case 67:
      return { description: 'Freezing Rain', Icon: IconCloudRain };
    case 71:
      return { description: 'Slight snow fall', Icon: IconCloudSnow };
    case 73:
      return { description: 'Moderate snow fall', Icon: IconCloudSnow };
    case 75:
      return { description: 'Heavy snow fall', Icon: IconCloudSnow };
    case 77:
      return { description: 'Snow grains', Icon: IconCloudSnow };
    case 80:
    case 81:
    case 82:
      return { description: 'Rain showers', Icon: IconCloudRain };
    case 85:
    case 86:
      return { description: 'Snow showers', Icon: IconCloudSnow };
    case 95:
      return { description: 'Thunderstorm', Icon: IconCloudLightning };
    case 96:
    case 99:
      return { description: 'Thunderstorm with hail', Icon: IconCloudLightning };
    default:
      return { description: 'Unknown', Icon: isDay ? IconSun : IconMoon };
  }
};
