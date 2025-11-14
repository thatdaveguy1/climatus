
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from 'recharts';
import { ProcessedForecasts, ForecastView, ProcessedHourlyData } from '../types';
import { MedianLabel } from './ChartComponents';

interface OverviewChartProps {
  data: ProcessedForecasts;
  activeView: ForecastView;
}

interface OverviewPoint {
  xIndex: number;
  label: string;
  rawTime: string;
  temp: number | null;
  tempMax: number | null;
  tempMin: number | null;
  tagLabel?: string | null;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const items = payload.filter((p: any) => p.value !== null && p.value !== undefined);

  return (
    <div className="relative z-50 p-3 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl min-w-[180px]">
      <p className="font-bold text-gray-200 mb-2 border-b border-gray-600 pb-2">{label}</p>
      <ul className="space-y-1.5">
        {items.map((pld: any) => (
          <li key={pld.dataKey} className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span
                className="w-3 h-3 rounded-full mr-3 border-2 border-white/20"
                style={{ backgroundColor: pld.color }}
              ></span>
              <span className="text-gray-300">{pld.name}</span>
            </div>
            <span className="font-bold font-mono text-white">
              {pld.value.toFixed(1)}°C
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CustomLegend: React.FC<any> = (props) => {
  const { payload } = props;

  return (
    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-xs text-gray-400 -translate-y-2">
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center">
          <span className="w-3 h-0.5 mr-1.5" style={{ backgroundColor: entry.color }}></span>
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const OverviewChart: React.FC<OverviewChartProps> = ({ data, activeView }) => {
  const medianModel = data?.median_model;
  const hourly = medianModel?.hourly ?? [];

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const chartData: OverviewPoint[] = useMemo(() => {
    if (!hourly.length) return [];

    const toDate = (iso: string) => new Date(iso + 'Z');

    if (activeView === 'hourly') {
      // 36-hour median hourly view
      const now = new Date();
      const startIndex = hourly.findIndex(
        (p: ProcessedHourlyData) => toDate(p.time) >= now
      );
      if (startIndex === -1) return [];

      const slice = hourly.slice(startIndex, startIndex + 36);
      const fmt = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: 'numeric',
        hour12: true,
        timeZone,
      });

      return slice.map((p, index) => ({
        xIndex: index,
        label: fmt.format(toDate(p.time)),
        rawTime: p.time,
        temp: p.temperature_2m ?? null,
        tempMax: null,
        tempMin: null,
      }));
    }

    // 7-day view: use first 7 daily rows from median_model.hourly
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone,
    });

    const dailyRows = hourly.slice(0, 7);

    return dailyRows.map((p, index) => {
      const date = toDate(p.time);
      const label = dayFormatter.format(date);
      const max = (p as any).temperature_2m_max ?? null;
      const min = (p as any).temperature_2m_min ?? null;

      const combinedLabel = (typeof max === 'number' && isFinite(max) && typeof min === 'number' && isFinite(min))
        ? `${Math.round(max)}° / ${Math.round(min)}°`
        : null;

      return {
        xIndex: index,
        label,
        rawTime: p.time,
        temp: null,
        tempMax: typeof max === 'number' ? max : null,
        tempMin: typeof min === 'number' ? min : null,
        tagLabel: combinedLabel,
      } as OverviewPoint;
    });
  }, [hourly, activeView, timeZone]);

  // Calculate tag indices for temperature extremes
  const tagIndices = useMemo(() => {
    const indices = new Map<number, { label: string; position: 'default' | 'staggered' }>();
    if (chartData.length === 0) return indices;

    if (activeView === 'hourly') {
      // Find temperature extremes for hourly view
      const findExtremumIndex = (type: 'min' | 'max') => {
        let extremumValue = type === 'max' ? -Infinity : Infinity;
        let extremumIndex = -1;
        chartData.forEach(({ temp }, index) => {
          if (temp !== null) {
            if ((type === 'max' && temp > extremumValue) || (type === 'min' && temp < extremumValue)) {
              extremumValue = temp;
              extremumIndex = index;
            }
          }
        });
        return extremumIndex;
      };

      const maxTempIdx = findExtremumIndex('max');
      const minTempIdx = findExtremumIndex('min');
      
      if (maxTempIdx !== -1) {
        const temp = chartData[maxTempIdx].temp!;
        indices.set(maxTempIdx, { label: `${Math.round(temp)}°C`, position: 'default' });
      }
      if (minTempIdx !== -1) {
        const temp = chartData[minTempIdx].temp!;
        indices.set(minTempIdx, { label: `${Math.round(temp)}°C`, position: 'default' });
      }
    } else {
      // For daily view, add labels for high/low combinations
      chartData.forEach((point, index) => {
        if (point.tagLabel) {
          indices.set(index, { 
            label: point.tagLabel, 
            position: index % 2 === 0 ? 'default' : 'staggered' 
          });
        }
      });
    }

    return indices;
  }, [chartData, activeView]);

  if (!medianModel || !chartData.length) {
    return null;
  }

  const isHourly = activeView === 'hourly';

  // Calculate Y domain with padding for labels
  const yDomain = useMemo(() => {
    const allValues = chartData.flatMap(d => [d.temp, d.tempMax, d.tempMin]).filter((v): v is number => typeof v === 'number');
    if (allValues.length === 0) return ['auto', 'auto'] as const;
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    const topPadding = range > 0 ? range * 0.35 : 5;
    return [ 
      (dataMin: number) => Math.floor(Math.min(min, dataMin)), 
      (dataMax: number) => Math.ceil(Math.max(max, dataMax) + topPadding) 
    ] as const;
  }, [chartData]);

  return (
    <div className="w-full rounded-xl bg-slate-900/80 p-4 shadow-lg">
      <h2 className="mb-1 text-center text-xl font-semibold text-slate-100">
        Forecast Overview
      </h2>
      <p className="mb-4 text-center text-sm text-slate-400">
        Median of all models for the next {isHourly ? '36 hours' : '7 days'}.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 50, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis 
              dataKey="xIndex" 
              stroke="#a0aec0" 
              fontSize={12} 
              tick={{ fill: '#a0aec0' }} 
              interval={isHourly ? 5 : 0}
              tickFormatter={(value: number) => chartData[value]?.label ?? ''} 
            />
            <YAxis 
              stroke="#a0aec0" 
              fontSize={12} 
              tick={{ fill: '#a0aec0' }} 
              label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#a0aec0' }} 
              domain={yDomain}
              allowDataOverflow={true}
            />
            <Tooltip content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }} />
            <Legend content={<CustomLegend />} />

            {/* Main temperature line */}
            <Line
              type="monotone"
              dataKey={isHourly ? 'temp' : 'tempMax'}
              name={isHourly ? 'Temperature' : 'High Temp'}
              stroke="#fafafa"
              strokeWidth={3}
              strokeOpacity={1}
              dot={false}
              unit="°C"
              connectNulls
            />
            
            {/* Min temperature line for daily view */}
            {!isHourly && (
              <Line 
                type="monotone"
                dataKey="tempMin" 
                name="Low Temp" 
                stroke="#fafafa" 
                strokeWidth={2} 
                strokeDasharray="2 4" 
                strokeOpacity={0.7}
                dot={false} 
                unit="°C"
                connectNulls
              />
            )}

            {/* Temperature labels */}
            {Array.from(tagIndices.entries()).map(([index, { label, position }]) => {
              const entry = chartData[index];
              const value = isHourly ? entry?.temp : entry?.tempMax;
              if (value === null || !isFinite(value)) return null;

              return (
                <ReferenceDot
                  key={`temp-tag-${index}`} 
                  x={index} 
                  y={value} 
                  r={0}
                  ifOverflow="extendDomain"
                  label={ <MedianLabel text={label} dy={position === 'staggered' ? -48 : -24} /> }
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OverviewChart;
