import React, { useMemo } from 'react';
import { ProcessedForecasts, ProcessedHourlyData } from '../types';
import { IconCloudSun, IconCloudRain, IconCloudSnow, IconCloud } from '../utils/weatherUtils';

interface HourlyForecastViewProps {
    data: ProcessedForecasts;
}

const getWindGustColor = (gusts: number): string => {
    if (gusts >= 30) return 'text-red-400';
    if (gusts >= 20) return 'text-yellow-400';
    return 'text-green-400';
};

const getHourlyWeatherIcon = (hour: ProcessedHourlyData): React.FC => {
    const precipType = hour.precipitation_type ?? 0;
    const cloudCover = hour.cloud_cover ?? 0;

    if (precipType === 3) return IconCloudSnow; // Snow
    if (precipType === 2) return IconCloudRain; // Mix (use rain icon)
    if (precipType === 1) return IconCloudRain; // Rain
    
    if (cloudCover > 75) return IconCloud;
    
    return IconCloudSun; // Default for clear/partly cloudy
};


const HourlyForecastView: React.FC<HourlyForecastViewProps> = ({ data }) => {
    const userTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

    const hourlyData = useMemo(() => {
        const medianData = data?.median_model?.hourly;
        if (!medianData || medianData.length === 0) return null;
        
        const now = new Date();
        const startIndex = medianData.findIndex(p => new Date(p.time + 'Z') >= now);
        if (startIndex === -1) return [];

        const futureData = medianData.slice(startIndex, startIndex + 37);
        
        return futureData.filter((_, index) => index % 3 === 0);

    }, [data]);

    const tempRange = useMemo(() => {
        if (!hourlyData || hourlyData.length === 0) return { min: 0, max: 0, range: 1 };
        
        let min = Infinity;
        let max = -Infinity;

        hourlyData.forEach(hour => {
            if (hour.temperature_2m !== null) {
                if (hour.temperature_2m < min) min = hour.temperature_2m;
                if (hour.temperature_2m > max) max = hour.temperature_2m;
            }
        });

        const range = max - min;
        return { min, max, range: range === 0 ? 1 : range };
    }, [hourlyData]);


    if (!hourlyData || hourlyData.length === 0) {
        return null;
    }

    let lastDay: string | null = null;

    return (
        <div className="mb-8 p-4 sm:p-6 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg">
            <div className="space-y-4">
                {hourlyData.map((hour, index) => {
                    const WeatherIcon = getHourlyWeatherIcon(hour);
                    const date = new Date(hour.time + 'Z');
                    
                    const currentDay = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: userTimeZone });
                    let timeLabel: string;
                    
                    if (index === 0 || lastDay === null || currentDay !== lastDay) {
                        timeLabel = date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', hour12: true, timeZone: userTimeZone });
                    } else {
                        timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: userTimeZone });
                    }
                    lastDay = currentDay;
                    
                    const temp = hour.temperature_2m ?? 0;
                    const totalPrecip = hour.precipitation ?? 0;
                    const markerOffset = tempRange.range > 0 ? ((temp - tempRange.min) / tempRange.range) * 100 : 50;
                    const clampedOffset = Math.max(1, Math.min(99, markerOffset)); // Clamp to keep marker border visible

                    const windSpeed = Math.round(hour.wind_gusts_10m ?? 0);
                    const precipMm = totalPrecip.toFixed(2);
                    const timeOnly = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: userTimeZone });
                    const dataLabel = `${timeOnly} | ${windSpeed} kts | ${precipMm}mm`;

                    return (
                        <div key={index} className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-white/5">
                            <div className="w-32 text-left">
                                <div className="text-md font-bold text-gray-300">
                                    {timeLabel}
                                </div>
                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                    {dataLabel}
                                </div>
                            </div>

                            <span className={`w-8 text-xl font-bold text-center ${getWindGustColor(hour.wind_gusts_10m ?? 0)}`}>
                                {windSpeed}
                            </span>

                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8">
                                    <WeatherIcon />
                                </div>
                                <span className="w-12 text-md text-cyan-300 font-mono text-left">
                                    {precipMm}
                                </span>
                            </div>

                            <span className="w-10 text-lg text-white font-mono text-right">
                                {Math.round(temp)}°
                            </span>

                            <div className="flex-1 h-3 bg-gradient-to-r from-gray-800/60 via-gray-700/40 to-gray-800/60 rounded-full relative shadow-inner border border-gray-600/30">
                                {/* Temperature gradient background */}
                                <div 
                                    className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-400/30 to-orange-400/20 rounded-full opacity-60"
                                    style={{
                                        background: `linear-gradient(90deg, 
                                            rgba(59, 130, 246, 0.2) 0%, 
                                            rgba(34, 197, 94, 0.3) 25%, 
                                            rgba(251, 191, 36, 0.3) 50%, 
                                            rgba(239, 68, 68, 0.2) 100%)`
                                    }}
                                ></div>
                                
                                {/* Temperature marker */}
                                <div 
                                    className="absolute w-4 h-4 bg-gradient-to-br from-white via-cyan-200 to-blue-300 rounded-full border-2 border-white/80 shadow-lg transition-all duration-300 hover:scale-110"
                                    style={{
                                        left: `${clampedOffset}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        boxShadow: '0 0 12px rgba(34, 197, 94, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                                    }}
                                >
                                    {/* Inner glow */}
                                    <div className="absolute inset-0.5 bg-gradient-to-br from-cyan-100 to-blue-200 rounded-full opacity-80"></div>
                                </div>
                                
                                {/* Temperature value tooltip on hover */}
                                <div 
                                    className="absolute opacity-0 hover:opacity-100 transition-opacity duration-200 bg-gray-900/95 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
                                    style={{
                                        left: `${clampedOffset}%`,
                                        top: '-35px',
                                        transform: 'translateX(-50%)',
                                    }}
                                >
                                    {Math.round(temp)}°C
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HourlyForecastView;