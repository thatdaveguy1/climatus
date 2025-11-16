

import React, { useMemo } from 'react';
import { ProcessedForecasts, ProcessedHourlyData } from '../types';
import { IconCloudSun, IconCloudRain, IconCloudSnow } from '../utils/weatherUtils';

interface DailyForecastViewProps {
    data: ProcessedForecasts;
}

const getWindGustColor = (gusts: number): string => {
    if (gusts >= 30) return 'text-red-400';
    if (gusts >= 20) return 'text-yellow-400';
    return 'text-green-400';
};

const getWeatherIcon = (day: ProcessedHourlyData): React.FC => {
    // FIX: Changed properties to `snowfall` and `rain` to match the ProcessedHourlyData type.
    const snow = day.snowfall ?? 0;
    const rain = day.rain ?? 0;

    // Prioritize snow if significant
    if (snow > 0.1 && snow > rain) {
        return IconCloudSnow;
    }
    // Then rain
    if (rain > 0.1) {
        return IconCloudRain;
    }
    // Default to partly cloudy for dry days
    return IconCloudSun;
};

const DailyForecastView: React.FC<DailyForecastViewProps> = ({ data }) => {
    const dailyData = useMemo(() => {
        const medianData = data?.median_model?.hourly;
        if (!medianData || medianData.length === 0) return null;
        return medianData.slice(0, 7);
    }, [data]);

    const tempRange = useMemo(() => {
        if (!dailyData) return { weekMin: 0, weekMax: 0, weekRange: 1 };
        
        let weekMin = Infinity;
        let weekMax = -Infinity;

        dailyData.forEach(day => {
            if (day.temperature_2m_min !== null && day.temperature_2m_min < weekMin) {
                weekMin = day.temperature_2m_min;
            }
            if (day.temperature_2m_max !== null && day.temperature_2m_max > weekMax) {
                weekMax = day.temperature_2m_max;
            }
        });

        const weekRange = weekMax - weekMin;
        // Avoid division by zero if all temps are the same
        return { weekMin, weekMax, weekRange: weekRange === 0 ? 1 : weekRange };

    }, [dailyData]);

    if (!dailyData) {
        return null;
    }

    return (
        <div className="mb-8 p-4 sm:p-6 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg">
            <div className="space-y-4">
                {dailyData.map((day, index) => {
                    const WeatherIcon = getWeatherIcon(day as any); // Cast to any to handle different data shapes
                    const dayLow = day.temperature_2m_min ?? 0;
                    const dayHigh = day.temperature_2m_max ?? 0;
                    const totalPrecip = day.precipitation ?? 0;

                    const barWidth = ((dayHigh - dayLow) / tempRange.weekRange) * 100;
                    const barOffset = ((dayLow - tempRange.weekMin) / tempRange.weekRange) * 100;
                    
                    // FIX: Correctly parse date-only string by treating it as UTC midnight.
                    const date = new Date(day.time + 'T00:00:00Z');
                    const dayLabel = !isNaN(date.getTime()) 
                        ? date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
                        : 'Invalid Date';

                    return (
                        <div key={index} className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-white/5">
                            <span className="w-10 text-lg font-bold text-gray-300 text-left">
                                {dayLabel}
                            </span>

                            <div className="flex flex-col items-center w-12 text-center">
                                <span className={`text-xl font-bold ${getWindGustColor(day.wind_gusts_10m_max ?? 0)}`}>
                                    {Math.round(day.wind_speed_10m_max ?? 0)}
                                </span>
                                <span className="text-xs text-gray-400">kts</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8">
                                    <WeatherIcon />
                                </div>
                                <div className="flex flex-col items-start w-16">
                                    <span className="text-md text-cyan-300 font-mono">
                                        {totalPrecip.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-gray-400 -mt-1">mm</span>
                                </div>
                            </div>

                            <span className="w-10 text-lg text-gray-400 font-mono text-right">
                                {Math.round(dayLow)}°
                            </span>

                            <div className="flex-1 h-2 bg-gray-700/50 rounded-full">
                                <div 
                                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        marginLeft: `${barOffset}%`,
                                    }}
                                ></div>
                            </div>
                            
                            <span className="w-10 text-lg text-white font-mono text-left">
                                {Math.round(dayHigh)}°
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DailyForecastView;