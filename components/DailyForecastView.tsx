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
                    
                    const windSpeed = Math.round(day.wind_gusts_10m ?? 0);
                    const precipMm = totalPrecip.toFixed(2);
                    const dayName = new Date(day.time + 'Z').toLocaleDateString('en-US', { weekday: 'short' });
                    const dataLabel = `${windSpeed} kts | ${precipMm}mm`;

                    return (
                        <div key={index} className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-white/5">
                            <div className="w-16 text-left">
                                <div className="text-lg font-bold text-gray-300">
                                    {dayName}
                                </div>
                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                    {dataLabel}
                                </div>
                            </div>

                            <span className={`w-8 text-xl font-bold text-center ${getWindGustColor(day.wind_gusts_10m ?? 0)}`}>
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

                            <span className="w-10 text-lg text-gray-400 font-mono text-right">
                                {Math.round(dayLow)}°
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
                                
                                {/* Temperature range bar */}
                                <div 
                                    className="absolute h-full bg-gradient-to-r from-cyan-400/80 via-emerald-400/90 to-blue-500/80 rounded-full shadow-md transition-all duration-300 hover:shadow-lg"
                                    style={{
                                        width: `${Math.max(barWidth, 2)}%`,
                                        marginLeft: `${barOffset}%`,
                                        boxShadow: '0 0 8px rgba(34, 197, 94, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
                                    }}
                                >
                                    {/* Inner highlight */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/10 rounded-full"></div>
                                </div>
                                
                                {/* Low temperature marker */}
                                <div 
                                    className="absolute w-3 h-3 bg-gradient-to-br from-blue-300 to-cyan-500 rounded-full border border-white/60 shadow-sm"
                                    style={{
                                        left: `${barOffset}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                    }}
                                ></div>
                                
                                {/* High temperature marker */}
                                <div 
                                    className="absolute w-3 h-3 bg-gradient-to-br from-orange-300 to-red-400 rounded-full border border-white/60 shadow-sm"
                                    style={{
                                        left: `${barOffset + barWidth}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
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
