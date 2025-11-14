

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceArea,
} from 'recharts';
import { ComparisonChartProps, ProcessedHourlyData } from '../types';
import { MODEL_COLORS, MODELS } from '../constants';
import { MedianLabel } from './ChartComponents';

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload]
      .filter(p => p.value !== null && p.value !== undefined)
      .sort((a, b) => {
        if (payload.some(p => p.dataKey === 'temperature_2m' && p.dataKey !== 'wind_gusts_10m')) {
          return 0;
        }
        return b.value - a.value;
      });

    if (sortedPayload.length === 0) return null;

    return (
      <div className="relative z-50 p-3 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl min-w-[180px]">
        <p className="font-bold text-gray-200 mb-2 border-b border-gray-600 pb-2">{label}</p>
        <ul className="space-y-1.5">
          {sortedPayload.map((pld: any) => {
            const isPrecip = pld.dataKey === 'precipitation';
            const value = (isPrecip && pld.payload.originalPrecipitation !== undefined) ? pld.payload.originalPrecipitation : pld.value;

            return (
                <li key={pld.dataKey} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <span
                      className="w-3 h-3 rounded-full mr-3 border-2 border-white/20"
                      style={{ backgroundColor: pld.color || pld.fill }}
                    ></span>
                    <span className="text-gray-300">{pld.name}</span>
                  </div>
                  <span className="font-bold font-mono text-white">
                    {value.toFixed(1)} {pld.unit}
                  </span>
                </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return null;
};

type TagPosition = 'default' | 'staggered';

const PRECIP_LEGEND_ITEMS = [
    { value: 'Rain', color: 'rgba(75, 150, 255, 0.4)' },
    { value: 'Mix/Freezing', color: 'rgba(173, 53, 255, 0.4)' },
    { value: 'Snow', color: 'rgba(230, 230, 230, 0.4)' },
];

const CustomLegend: React.FC<any> = (props) => {
    const { payload, metric } = props;

    return (
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-xs text-gray-400 -translate-y-2">
            {payload.map((entry, index) => (
                <div key={`item-${index}`} className="flex items-center">
                    <span className="w-3 h-0.5 mr-1.5" style={{ backgroundColor: entry.color }}></span>
                    <span>{entry.value}</span>
                </div>
            ))}
            
            {(metric.key === 'rain' || metric.key === 'snowfall') && (
                <>
                    <div className="h-4 w-px bg-gray-600 mx-2"></div>
                    <span className="font-semibold text-gray-300">Precip Type:</span>
                    {PRECIP_LEGEND_ITEMS.map((item, index) => (
                         <div key={`precip-item-${index}`} className="flex items-center">
                            <span className="w-3 h-3 mr-1.5 rounded-sm" style={{ backgroundColor: item.color }}></span>
                            <span>{item.value}</span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

const ComparisonChart: React.FC<ComparisonChartProps> = ({ hourlyData, dailyData, metric, activeView }) => {
  interface ChartDataPoint {
    xIndex: number;
    time: string;
    rawTime: string;
    precipitation_type: number;
    median_model?: number | null;
    median_model_min?: number | null;
    [key: string]: string | number | null | undefined;
  }
  
  const userTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const keyForView = useMemo(() => {
    if (activeView === 'daily') {
        switch(metric.key) {
            case 'temperature_2m': return 'temperature_2m_max';
            case 'rain': return 'rain';
            case 'snowfall': return 'snowfall';
            case 'wind_speed_10m': return 'wind_speed_10m_max';
            case 'wind_gusts_10m': return 'wind_gusts_10m_max';
        }
    }
    return metric.key;
  }, [activeView, metric.key]);

  const dailyAggregates = useMemo(() => {
    const aggregates = new Map<string, { cloudCoverMedian: number | null; visibilityMin: number | null }>();
    if (activeView !== 'daily' || !hourlyData?.median_model?.hourly) {
        return aggregates;
    }

    const hourlyByDay = hourlyData.median_model.hourly.reduce((acc, hour) => {
        const day = hour.time.split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(hour);
        return acc;
    }, {} as { [day: string]: ProcessedHourlyData[] });

    for (const day in hourlyByDay) {
        const dayData = hourlyByDay[day];
        const cloudCovers = dayData.map(h => h.cloud_cover).filter((v): v is number => v !== null);
        const cloudCoverMedian = cloudCovers.length > 0 ? [...cloudCovers].sort((a, b) => a - b)[Math.floor(cloudCovers.length / 2)] : null;
        const visibilities = dayData.map(h => h.visibility).filter((v): v is number => v !== null);
        const visibilityMin = visibilities.length > 0 ? Math.min(...visibilities) : null;
        aggregates.set(day, { cloudCoverMedian, visibilityMin });
    }
    return aggregates;
  }, [hourlyData, activeView]);

  const comparisonChartData = useMemo(() => {
    const data = activeView === 'hourly' ? hourlyData : dailyData;
    let referenceHourlyData = data.median_model?.hourly;
    if (!referenceHourlyData || referenceHourlyData.length === 0) return [];

    if (activeView === 'hourly') {
      const now = new Date();
      const startIndex = referenceHourlyData.findIndex(point => new Date(point.time + 'Z') >= now);
      referenceHourlyData = (startIndex !== -1) ? referenceHourlyData.slice(startIndex, startIndex + 36) : [];
    }

    const dataMap: { [model: string]: { [time: string]: ProcessedHourlyData } } = {};
    for (const model of MODELS) {
        if (data[model.key]?.hourly) {
            dataMap[model.key] = data[model.key].hourly.reduce((acc, curr) => {
                acc[curr.time] = curr;
                return acc;
            }, {} as { [time: string]: ProcessedHourlyData });
        }
    }

    let lastDay: string | null = null;
    return referenceHourlyData.map((refPoint, index) => {
        const { time } = refPoint;
        let displayLabel: string;
        if (activeView === 'hourly') {
            const date = new Date(time + 'Z');
            const currentDay = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: userTimeZone });
            const hourFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: userTimeZone });
            let label = hourFormatter.format(date);
            if (date.getHours() % 12 === 0) label = date.getHours() === 0 ? 'Midnight' : 'Noon';
            displayLabel = label;
            if (lastDay === null || currentDay !== lastDay) displayLabel = `${currentDay}, ${label}`;
            lastDay = currentDay;
        } else {
            const timeFormatOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', timeZone: userTimeZone };
            displayLabel = new Date(time + 'Z').toLocaleDateString('en-US', timeFormatOptions);
        }

        const dataPoint: ChartDataPoint = {
            xIndex: index,
            time: displayLabel,
            rawTime: time,
            precipitation_type: dataMap['median_model']?.[time]?.precipitation_type ?? 0,
        };
        
        const dailyAggs = activeView === 'daily' ? dailyAggregates.get(time) : undefined;

        for (const model of MODELS) {
            if (activeView === 'daily' && model.key !== 'median_model' && (metric.key === 'cloud_cover' || metric.key === 'visibility')) {
              dataPoint[model.key] = null;
              continue;
            }

            const hourlyPoint = dataMap[model.key]?.[time];
            let value = hourlyPoint?.[keyForView as keyof ProcessedHourlyData];

            if (activeView === 'daily' && model.key === 'median_model') {
                if (metric.key === 'cloud_cover') value = dailyAggs?.cloudCoverMedian;
                if (metric.key === 'visibility') value = dailyAggs?.visibilityMin;
            }

            dataPoint[model.key] = typeof value === 'number' ? value : null;

            if (activeView === 'daily' && metric.key === 'temperature_2m' && model.key === 'median_model') {
                const min_value = hourlyPoint?.temperature_2m_min;
                dataPoint['median_model_min'] = typeof min_value === 'number' ? min_value : null;
            }
        }
        return dataPoint;
    });
  }, [activeView, hourlyData, dailyData, metric.key, userTimeZone, keyForView, dailyAggregates]);
  
  const modelEntries = useMemo(() => {
    const data = activeView === 'hourly' ? hourlyData : dailyData;
    if (activeView === 'daily' && (metric.key === 'cloud_cover' || metric.key === 'visibility')) {
        const medianModel = MODELS.find(m => m.key === 'median_model');
        if (medianModel && data[medianModel.key]?.hourly.length > 0) return [medianModel];
        return [];
    }
    return MODELS.filter(model => data[model.key] && data[model.key].hourly.some(h => typeof h[keyForView as keyof ProcessedHourlyData] === 'number'));
  }, [hourlyData, dailyData, metric.key, activeView, keyForView]);

  const yDomain = useMemo(() => {
    const allValues = comparisonChartData.flatMap(d => modelEntries.map(m => d[m.key]).filter((v): v is number => typeof v === 'number'));
    if (allValues.length === 0) return ['auto', 'auto'] as const;
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    const topPadding = range > 0 ? range * 0.35 : 5;
    return [ (dataMin: number) => Math.floor(Math.min(min, dataMin)), (dataMax: number) => Math.ceil(Math.max(max, dataMax) + topPadding) ] as const;
  }, [comparisonChartData, modelEntries]);
  
  const tagIndices = useMemo(() => {
    const indices = new Map<number, { position: TagPosition }>();
    if (comparisonChartData.length === 0) return indices;
    const medianData = comparisonChartData.map(d => ({ value: d.median_model as number | null, rawTime: d.rawTime as string, }));
    
    if (activeView === 'hourly') {
        const findExtremumIndex = (type: 'min' | 'max') => {
            let extremumValue = type === 'max' ? -Infinity : Infinity;
            let extremumIndex = -1;
            medianData.forEach(({ value }, index) => {
                if (value !== null) {
                    if ((type === 'max' && value > extremumValue) || (type === 'min' && value < extremumValue)) {
                        extremumValue = value;
                        extremumIndex = index;
                    }
                }
            });
            return extremumIndex;
        };

        switch (metric.key) {
            case 'temperature_2m':
                const maxTempIdx = findExtremumIndex('max');
                const minTempIdx = findExtremumIndex('min');
                if (maxTempIdx !== -1) indices.set(maxTempIdx, { position: 'default' });
                if (minTempIdx !== -1) indices.set(minTempIdx, { position: 'default' });
                break;
            case 'rain': case 'snowfall':
                let precipTagCounter = 0;
                medianData.forEach(({ value }, index) => {
                    if (value !== null && value > 0.05) { // Threshold for significant precip
                        indices.set(index, { position: precipTagCounter % 2 === 0 ? 'default' : 'staggered' });
                        precipTagCounter++;
                    }
                });
                break;
            case 'wind_speed_10m': case 'wind_gusts_10m':
                const maxWindIdx = findExtremumIndex('max');
                if (maxWindIdx !== -1) indices.set(maxWindIdx, { position: 'default' });
                break;
            case 'visibility':
                const minVisIdx = findExtremumIndex('min');
                if (minVisIdx !== -1) indices.set(minVisIdx, { position: 'default' });
                break;
            case 'cloud_cover':
                const days = medianData.reduce((acc, { rawTime }, index) => {
                    const day = rawTime.split('T')[0];
                    if (!acc.has(day)) acc.set(day, []);
                    acc.get(day)!.push({ index, time: new Date(rawTime + 'Z') });
                    return acc;
                }, new Map<string, { index: number, time: Date }[]>());
                days.forEach(dayPoints => {
                    const targetHours = [12, 16];
                    let tagged = false;
                    for (const hour of targetHours) {
                        if (tagged) break;
                        let closestPoint: { index: number, diff: number } | null = null;
                        for (const point of dayPoints) {
                            const diff = Math.abs(point.time.getUTCHours() - hour);
                            if (!closestPoint || diff < closestPoint.diff) closestPoint = { index: point.index, diff };
                        }
                        if (closestPoint && closestPoint.diff <= 1) {
                            indices.set(closestPoint.index, { position: 'default' });
                            tagged = true;
                        }
                    }
                });
                break;
        }
    } else {
        medianData.forEach(({ value }, index) => {
            if (value !== null && (metric.key !== 'rain' && metric.key !== 'snowfall' || value > 0.05)) {
                indices.set(index, { position: index % 2 === 0 ? 'default' : 'staggered' });
            }
        });
    }
    return indices;
  }, [comparisonChartData, metric.key, activeView]);
  
  const precipTypeSegments = useMemo(() => {
    if (!comparisonChartData || comparisonChartData.length === 0) return [];
    const segments: { type: number; x1: number; x2: number }[] = [];
    let currentSegment: { type: number; x1: number; x2: number } | null = null;
    for (let i = 0; i < comparisonChartData.length; i++) {
        const point = comparisonChartData[i];
        const type = point.precipitation_type as number;
        if (type === 0) {
            if (currentSegment) { segments.push(currentSegment); currentSegment = null; }
            continue;
        }
        if (currentSegment) {
            if (currentSegment.type === type) { currentSegment.x2 = point.xIndex as number; } 
            else { segments.push(currentSegment); currentSegment = { type, x1: point.xIndex as number, x2: point.xIndex as number }; }
        } else {
            currentSegment = { type, x1: point.xIndex as number, x2: point.xIndex as number };
        }
    }
    if (currentSegment) segments.push(currentSegment);
    return segments;
  }, [comparisonChartData]);

  if (metric.key === 'overview') return null;

  return (
    <div className="h-[60vh] sm:h-96 w-full">
      <ResponsiveContainer>
        <LineChart data={comparisonChartData} margin={{ top: 70, right: 30, left: 5, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis dataKey="xIndex" stroke="#a0aec0" fontSize={12} tick={{ fill: '#a0aec0' }} interval={activeView === 'hourly' ? 5 : 0} tickFormatter={(value: number) => comparisonChartData[value]?.time ?? ''} />
          <YAxis stroke="#a0aec0" fontSize={12} tick={{ fill: '#a0aec0' }} label={{ value: metric.unit, angle: -90, position: 'insideLeft', fill: '#a0aec0' }} domain={yDomain} allowDataOverflow={true} />
          <Tooltip content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }} />
          <Legend content={<CustomLegend metric={metric} />} />
          {(metric.key === 'rain' || metric.key === 'snowfall') && precipTypeSegments.map((segment, index) => {
              const PRECIP_TYPE_COLORS: { [key: number]: string } = { 1: 'rgba(75, 150, 255, 0.1)', 2: 'rgba(173, 53, 255, 0.1)', 3: 'rgba(230, 230, 230, 0.1)' };
              return <ReferenceArea key={`precip-area-${index}`} x1={segment.x1} x2={segment.x2} fill={PRECIP_TYPE_COLORS[segment.type]} stroke="none" ifOverflow="visible"/>;
          })}

          {modelEntries.map((model) => (
            <Line key={model.key} type="monotone" dataKey={model.key} name={model.name} stroke={MODEL_COLORS[model.key] || '#ffffff'} strokeWidth={model.key === 'median_model' ? 3 : 1.5} strokeOpacity={model.key === 'median_model' ? 1 : 0.3} dot={false} unit={metric.unit} connectNulls/>
          ))}
          {Array.from(tagIndices.entries()).map(([index, { position }]) => {
            const entry = comparisonChartData[index];
            const medianValue = entry?.median_model as number | null;
            const medianMinValue = (entry as any)?.median_model_min as number | null;
            if (medianValue === null || !isFinite(medianValue)) return null;

            const isDailyTemp = activeView === 'daily' && metric.key === 'temperature_2m';
            const valueString = isDailyTemp && medianMinValue !== null
                ? `${Math.round(medianValue)} / ${Math.round(medianMinValue)}°`
                : `${medianValue.toFixed(1)} ${metric.unit}`;

            return (
              <ReferenceDot
                key={`median-tag-${index}`} x={index} y={medianValue} r={0}
                ifOverflow="extendDomain"
                label={ <MedianLabel text={valueString} dy={position === 'staggered' ? -48 : -24} /> }
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ComparisonChart;
