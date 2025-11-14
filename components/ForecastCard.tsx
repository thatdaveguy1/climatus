
import React, { useMemo } from 'react';
import { ForecastCardProps } from '../types';

const ForecastCard: React.FC<ForecastCardProps> = ({ modelName, data, activeView }) => {
  const userTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const forecastPoints = useMemo(() => {
    let points = data.hourly;

    if (activeView === 'hourly') {
      const now = new Date();
      const startIndex = points.findIndex(point => new Date(point.time + 'Z') >= now);
      
      if (startIndex !== -1) {
        points = points.slice(startIndex);
      } else {
        points = [];
      }
    }

    const displayCount = activeView === 'hourly' ? 6 : 7;
    return points.slice(0, displayCount);
  }, [data.hourly, activeView]);

  if (forecastPoints.length === 0) {
    return (
       <div className="bg-gray-900/70 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg p-4 flex flex-col h-full">
          <h3 className="text-lg font-bold text-center text-blue-400 truncate mb-4">{modelName}</h3>
          <p className="text-gray-400 text-center">No data available for this model.</p>
       </div>
    )
  }

  return (
    <div className="bg-gray-900/70 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg p-4 flex flex-col h-full transition-transform hover:scale-105 hover:border-blue-500">
      <h3 className="text-lg font-bold text-center text-blue-400 truncate mb-4">{modelName}</h3>
      <div className="space-y-4">
        {forecastPoints.map((point) => {
          const timeFormatOptions: Intl.DateTimeFormatOptions = activeView === 'hourly'
            ? { weekday: 'short', hour: 'numeric', hour12: true, timeZone: userTimeZone }
            : { weekday: 'short', month: 'short', day: 'numeric', timeZone: userTimeZone };
          
          return (
            <div key={point.time} className="text-sm">
              <p className="font-semibold text-gray-300">
                {new Date(point.time + 'Z').toLocaleDateString('en-US', timeFormatOptions)}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-gray-400">
                  {activeView === 'daily' ? (
                    (typeof point.temperature_2m_max === 'number' || typeof point.temperature_2m_min === 'number') && (
                      <p>Temp: <span className="font-medium text-gray-200">{point.temperature_2m_max?.toFixed(0) ?? '--'}° / {point.temperature_2m_min?.toFixed(0) ?? '--'}°C</span></p>
                    )
                  ) : (
                    typeof point.temperature_2m === 'number' && (
                      <p>Temp: <span className="font-medium text-gray-200">{point.temperature_2m.toFixed(1)}°C</span></p>
                    )
                  )}

                  {typeof point.rain === 'number' && point.rain > 0 && (
                    <p>Rain: <span className="font-medium text-gray-200">{point.rain.toFixed(1)} mm</span></p>
                  )}

                  {typeof point.snowfall === 'number' && point.snowfall > 0 && (
                    <p>Snow: <span className="font-medium text-gray-200">{point.snowfall.toFixed(1)} cm</span></p>
                  )}

                  {typeof point.wind_speed_10m === 'number' && (
                    <p>Wind: <span className="font-medium text-gray-200">{point.wind_speed_10m.toFixed(0)} kn {point.wind_direction_10m ?? ''}</span></p>
                  )}
                  
                  {typeof point.wind_gusts_10m === 'number' && (
                    <p>Gusts: <span className="font-medium text-gray-200">{point.wind_gusts_10m.toFixed(0)} kn</span></p>
                  )}

                  {typeof point.cloud_cover === 'number' && (
                    <p>Cloud Cover: <span className="font-medium text-gray-200">{point.cloud_cover.toFixed(0)}%</span></p>
                  )}

                  {typeof point.visibility === 'number' && (
                    <p>Visibility: <span className="font-medium text-gray-200">{point.visibility.toFixed(1)} mi</span></p>
                  )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default ForecastCard;
