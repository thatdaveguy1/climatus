
import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Metric, HistoricalForecastRecord, ActualWeatherRecord } from '../types';
import { getActualsForLocationAndTimeRange, getHistoricalForecasts } from '../services/dbService';
import LoadingSpinner from './LoadingSpinner';
import { MODELS, MODEL_COLORS } from '../constants';

interface HistoricalComparisonChartProps {
    selectedLocationId: number;
    selectedMetric: Metric;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const sortedPayload = [...payload]
            .filter(p => p.value !== null && p.value !== undefined)
            .sort((a, b) => {
                if (a.dataKey === 'actual') return -1; // Always show 'Actual' on top
                if (b.dataKey === 'actual') return 1;
                return b.value - a.value;
            });

        if (sortedPayload.length === 0) return null;

        return (
            <div className="relative z-50 p-3 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl min-w-[180px]">
                <p className="font-bold text-gray-200 mb-2 border-b border-gray-600 pb-2">{label}</p>
                <ul className="space-y-1.5">
                    {sortedPayload.map((pld: any) => (
                        <li key={pld.dataKey} className="flex items-center justify-between text-sm">
                            <div className="flex items-center">
                                <span
                                    className="w-3 h-3 rounded-full mr-3 border-2 border-white/20"
                                    style={{ backgroundColor: pld.color }}
                                ></span>
                                <span className="text-gray-300">{pld.name}</span>
                            </div>
                            <span className="font-bold font-mono text-white">
                                {pld.value.toFixed(1)} {pld.unit}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
    return null;
};

const HistoricalComparisonChart: React.FC<HistoricalComparisonChartProps> = ({ selectedLocationId, selectedMetric }) => {
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const userTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

    useEffect(() => {
        const fetchData = async () => {
            console.log(`[Historical Chart] Fetching data for location ID ${selectedLocationId} and metric ${selectedMetric.key}...`);
            setLoading(true);
            setError(null);
            setChartData([]); // Clear previous data before fetching
            try {
                const now = new Date();
                const startTime = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
                const endTime = now.toISOString();

                const [actuals, historical] = await Promise.all([
                    getActualsForLocationAndTimeRange(selectedLocationId, startTime, endTime),
                    getHistoricalForecasts(selectedLocationId, startTime, endTime),
                ]);

                console.log(`[Historical Chart] Fetched ${actuals.length} actual records and ${historical.length} historical forecast records.`);

                if (historical.length === 0 && actuals.length === 0) {
                    setError("No historical or actual weather data found for this period. Please allow more time for data collection.");
                    setLoading(false);
                    return;
                }
                
                const forecastsByTime = new Map<string, HistoricalForecastRecord[]>();
                historical.forEach(f => {
                    const list = forecastsByTime.get(f.targetTime) || [];
                    list.push(f);
                    forecastsByTime.set(f.targetTime, list);
                });
                
                const actualsMap = new Map<string, ActualWeatherRecord>();
                actuals.forEach(a => actualsMap.set(a.time, a));

                const finalData = [];
                const loopNow = new Date();
                loopNow.setMinutes(0, 0, 0); // Start from the top of the current hour

                let lastDay: string | null = null; // To track day changes

                // Create a full timeline for the past 36 hours
                for (let i = 36; i >= 0; i--) {
                    const date = new Date(loopNow.getTime() - i * 60 * 60 * 1000);
                    const time = date.toISOString();

                    // --- Start of new label logic ---
                    const currentDay = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: userTimeZone });
                    const hourFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: userTimeZone });

                    let label = hourFormatter.format(date);
                    if (date.getHours() % 12 === 0) { // Special labels for Midnight and Noon
                        label = date.getHours() === 0 ? 'Midnight' : 'Noon';
                    }
                    
                    let displayLabel = label;
                    // Prepend day of the week if it's the first data point or the day has changed
                    if (lastDay === null || currentDay !== lastDay) {
                        displayLabel = `${currentDay}, ${label}`;
                    }
                    lastDay = currentDay;
                    // --- End of new label logic ---

                    const dataPoint: { [key: string]: any } = {
                        time: displayLabel, // Use the new smart label
                        rawTime: time,
                        actual: null,
                        median_model: null,
                    };
                    
                    const actualRecord = actualsMap.get(time);
                    if (actualRecord) {
                        const actualValue = actualRecord[selectedMetric.key as keyof ActualWeatherRecord] as number | null;
                        dataPoint.actual = (typeof actualValue === 'number' && isFinite(actualValue)) ? actualValue : null;
                    }

                    const forecastsForThisHour = forecastsByTime.get(time) || [];
                    const metricValuesForMedian: number[] = [];

                    MODELS.forEach(model => {
                        const modelForecasts = forecastsForThisHour
                            .filter(f => 
                                f.modelKey === model.key && 
                                f.metricKey === selectedMetric.key && 
                                f.forecastLeadTimeHours >= 6
                            );

                        if (modelForecasts.length > 0) {
                            // Find the forecast made most recently (i.e., with the SHORTEST lead time).
                            const bestForecast = modelForecasts.reduce((prev, current) => (prev.forecastLeadTimeHours < current.forecastLeadTimeHours) ? prev : current);
                            const value = bestForecast.forecastedValue;
                            dataPoint[model.key] = value;
                            if (model.category !== 'Derived' && typeof value === 'number' && isFinite(value)) {
                                metricValuesForMedian.push(value);
                            }
                        }
                    });

                    if (metricValuesForMedian.length > 0) {
                        const sorted = [...metricValuesForMedian].sort((a, b) => a - b);
                        const mid = Math.floor(sorted.length / 2);
                        dataPoint.median_model = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                    }

                    finalData.push(dataPoint);
                }
                
                setChartData(finalData);
                console.log(`[Historical Chart] Processed data into ${finalData.length} chart points.`);

            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load historical data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedLocationId, selectedMetric, userTimeZone]);
    
    const modelEntries = useMemo(() => {
        return MODELS.filter(model => 
            chartData.some(d => typeof d[model.key] === 'number')
        );
    }, [chartData]);

    if (loading) {
        return <div className="flex justify-center items-center h-96"><LoadingSpinner /></div>;
    }

    if (error) {
        return <div className="text-center p-6 bg-yellow-900/30 border border-yellow-700 rounded-lg"><p>{error}</p></div>;
    }

    return (
        <div className="h-[60vh] sm:h-96 w-full">
            <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 5, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis dataKey="time" stroke="#a0aec0" fontSize={12} tick={{ fill: '#a0aec0' }} interval={5} />
                    <YAxis stroke="#a0aec0" fontSize={12} tick={{ fill: '#a0aec0' }} label={{ value: selectedMetric.unit, angle: -90, position: 'insideLeft', fill: '#a0aec0' }} />
                    <Tooltip content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }} />
                    <Legend />

                    {/* Actual Weather Line */}
                    <Line
                        type="monotone"
                        dataKey="actual"
                        name="Actual Weather"
                        stroke="#fafafa"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: '#fafafa' }}
                        unit={selectedMetric.unit}
                        connectNulls
                    />

                    {modelEntries.map((model) => (
                        <Line
                            key={model.key}
                            type="monotone"
                            dataKey={model.key}
                            name={model.name}
                            stroke={MODEL_COLORS[model.key] || '#ffffff'}
                            strokeWidth={model.key === 'median_model' ? 3 : 1.5}
                            strokeOpacity={model.key === 'median_model' ? 1 : 0.6}
                            dot={false}
                            unit={selectedMetric.unit}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default HistoricalComparisonChart;
