import React from 'react';
import { CurrentWeather as CurrentWeatherType } from '../types';
import { getWeatherInfo } from '../utils/weatherUtils';
import CloudCoverBreakdown from './CloudCoverBreakdown';

interface CurrentWeatherProps {
  data: CurrentWeatherType | null;
  loading: boolean;
  error: string | null;
  timezoneAbbr: string | null;
  precipLast6h: number | null;
  precipNext6h: number | null;
}

// --- SVG Icons for Metrics (Minimalist Style) ---
const IconWind = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>;
const IconPressure = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5V2.5"/><path d="m22 2-5 5"/></svg>;
const IconDewPoint = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 0-7.53 16.58L12 22l7.53-3.42A10 10 0 0 0 12 2z"/><path d="M12 7a3 3 0 0 0-3 3c0 1.66 3 4.5 3 4.5s3-2.84 3-4.5a3 3 0 0 0-3-3z"/></svg>;
const IconVisibility = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconPrecipitation = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C5 11.1 4 13 4 15a7 7 0 0 0 7 7z"/></svg>;


const MetricItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
    <div className="flex items-center gap-3">
        <div className="w-8 h-8 text-gray-400 flex-shrink-0">{icon}</div>
        <div>
            <p className="text-sm text-gray-400">{label}</p>
            <div className="text-lg text-white">{value}</div>
        </div>
    </div>
);


const CurrentWeather: React.FC<CurrentWeatherProps> = ({ data, loading, error, timezoneAbbr, precipLast6h, precipNext6h }) => {
  if (loading) {
    return <div className="text-center p-8 text-gray-400">Loading current conditions...</div>;
  }
  if (error) {
    return <div className="my-8 text-center p-8 bg-red-900/30 rounded-xl text-red-400">Error: {error}</div>;
  }
  if (!data) {
    return <div className="my-8 text-center p-8 bg-gray-800/50 rounded-xl text-gray-400">Current weather data is unavailable.</div>;
  }

  const { description, Icon } = getWeatherInfo(data.weather_code, data.is_day === 1);
  const feelsLikeTemp = getFeelsLikeTemp(data.temperature_2m, data.wind_speed_10m);
  const pressureInHg = data.pressure_msl ? (data.pressure_msl * 0.029529983).toFixed(2) : '--';
  
  return (
    <div className="my-8 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl shadow-lg overflow-hidden">
      {/* Top Part: Primary Weather Info */}
      <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-6">
          <div className="w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0">
              <Icon />
          </div>
          <div>
              <p className="text-7xl sm:text-8xl font-bold text-white">
                  {data.temperature_2m.toFixed(0)}<span className="text-5xl align-top -mt-2">°</span>
              </p>
              <p className="text-xl font-medium text-gray-200 -mt-2">{description}</p>
              <p className="text-md text-gray-400 mt-1">
                  Feels like {feelsLikeTemp.toFixed(0)}°
              </p>
          </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 mx-6 sm:mx-8"></div>

      {/* Bottom Part: Secondary Metrics in a Symmetrical Grid */}
      <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
          <MetricItem 
              icon={<IconWind />}
              label="Wind"
              value={
                  <span className="font-semibold">
                      {data.wind_speed_10m.toFixed(0)} <span className="text-sm text-gray-400">kn</span> / G: {data.wind_gusts_10m.toFixed(0)} <span className="text-sm text-gray-400">kn</span>
                  </span>
              }
          />
          <MetricItem 
              icon={<IconPressure />}
              label="Pressure"
              value={<span className="font-semibold">{pressureInHg} <span className="text-sm text-gray-400">inHg</span></span>}
          />
          <MetricItem 
              icon={<IconDewPoint />}
              label="Dew Point"
              value={<span className="font-semibold">{data.dew_point_2m?.toFixed(0)}°</span>}
          />
          <MetricItem 
              icon={<IconVisibility />}
              label="Visibility"
              value={<span className="font-semibold">{(data.visibility / 1609.34).toFixed(1)} <span className="text-sm text-gray-400">mi</span></span>}
          />
          <MetricItem 
              icon={<IconPrecipitation />}
              label="Precip (Past / Next 6h)"
              value={
                  <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold">{precipLast6h?.toFixed(1) ?? '--'}</span>
                      <span className="text-gray-500 text-lg">/</span>
                      <span className="font-semibold">{precipNext6h?.toFixed(1) ?? '--'}</span>
                      <span className="text-sm text-gray-400 ml-1">mm</span>
                  </div>
              }
          />
          <CloudCoverBreakdown 
            low={data.cloud_cover_low} 
            mid={data.cloud_cover_mid} 
            high={data.cloud_cover_high} 
          />
      </div>
    </div>
  );
};

// Wind Chill Calculation
const getFeelsLikeTemp = (tempC: number, wind_speed_10m_kn: number): number => {
    const windKmh = wind_speed_10m_kn * 1.852;
    // Only apply wind chill if temp is below 10°C and wind is above 5 km/h
    if (tempC < 10 && windKmh > 5) {
        const windChill = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16);
        // "Feels like" should not be warmer than the actual temperature
        return Math.min(tempC, windChill);
    }
    // No significant wind chill effect, return the actual temperature
    return tempC;
};

export default CurrentWeather;