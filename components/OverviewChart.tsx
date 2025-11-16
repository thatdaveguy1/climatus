
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  LabelList,
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
  precip: number | null;
  gusts: number | null;
  tagAbove?: string | null;
  tagBelow?: string | null;
  combinedLabel?: string | null;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isHourly = data.temp !== null;
  const items: {name: string, value: string, color: string}[] = [];

  if (isHourly) {
    if (data.temp !== null) items.push({name: "Temperature", value: `${data.temp.toFixed(1)} °C`, color: '#fafafa'});
  } else {
    if (data.tempMax !== null && data.tempMin !== null) {
        items.push({name: "High / Low", value: `${Math.round(data.tempMax)}° / ${Math.round(data.tempMin)}°`, color: '#fafafa'});
    }
  }

  if (data.precip && data.precip > 0.05) items.push({name: "Precipitation", value: `${data.precip.toFixed(1)} mm`, color: '#38b2ac'});
  if (data.gusts !== null) items.push({name: "Wind Gusts", value: `${data.gusts.toFixed(0)} kn`, color: '#4a5568'});

  return (
    <div className="relative z-50 p-3 bg-gray-800/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl min-w-[180px]">
      <p className="font-bold text-gray-200 mb-2 border-b border-gray-600 pb-2">{label}</p>
      <ul className="space-y-1.5">
        {items.map((item: any) => (
          <li key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span
                className="w-3 h-3 rounded-full mr-3 border-2 border-white/20"
                style={{ backgroundColor: item.color }}
              ></span>
              <span className="text-gray-300">{item.name}</span>
            </div>
            <span className="font-bold font-mono text-white">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};


const LEGEND_ITEMS = [
    { value: 'Temperature', color: '#fafafa' },
    { value: 'Precipitation', color: '#38b2ac' },
    { value: 'Wind Gusts', color: '#4a5568' },
];

const CustomLegend: React.FC = () => (
    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-xs text-gray-400 -translate-y-2">
        {LEGEND_ITEMS.map((item, index) => (
            <div key={`item-${index}`} className="flex items-center">
                <span className="w-3 h-0.5 mr-1.5" style={{ backgroundColor: item.color }}></span>
                <span>{item.value}</span>
            </div>
        ))}
    </div>
);


const OverviewChart: React.FC<OverviewChartProps> = ({ data, activeView }) => {
  const medianModel = data?.median_model;
  const hourly = medianModel?.hourly ?? [];

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const chartData: OverviewPoint[] = useMemo(() => {
    if (!hourly.length) return [];

    const toDate = (iso: string | null | undefined): Date | null => {
        if (!iso) return null;
        // FIX: If the string is just a date (YYYY-MM-DD), append T00:00:00Z to parse it as UTC midnight.
        // Otherwise, assume it's a datetime string and append Z to parse as UTC. This handles both
        // hourly ('YYYY-MM-DDTHH:MM') and daily ('YYYY-MM-DD') formats correctly.
        const dateString = iso.includes('T') ? iso + 'Z' : iso + 'T00:00:00Z';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? null : d;
    };

    if (activeView === 'hourly') {
      const now = new Date();
      const startIndex = hourly.findIndex(
        (p: ProcessedHourlyData) => {
            const d = toDate(p.time);
            return d ? d >= now : false;
        }
      );
      if (startIndex === -1) return [];

      const slice = hourly.slice(startIndex, startIndex + 36);
      
      let lastDayLabel: string | null = null;
      const base = slice.map((p, index) => {
        const date = toDate(p.time);
        if (!date) {
            return null;
        }

        let displayLabel = '';
        const hour = date.getHours();
        
        // Only create labels for hours divisible by 6 to reduce clutter
        if (hour % 6 === 0) {
            const currentDayLabel = date.toLocaleDateString('en-US', { weekday: 'short', timeZone });
            
            // FIX: Use '12am'/'12pm' format instead of 'Midnight'/'Noon' for a cleaner look.
            const timeStr = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone }).format(date).replace(/\s/g, '').toLowerCase();

            // Show day only for the very first label to establish context.
            if (lastDayLabel === null) {
                displayLabel = `${currentDayLabel}, ${timeStr}`;
            } else {
                displayLabel = timeStr;
            }
            // We update lastDayLabel regardless of display, to correctly identify the first label.
            lastDayLabel = currentDayLabel;
        }
        
        return {
            xIndex: index,
            label: displayLabel,
            rawTime: p.time,
            temp: p.temperature_2m ?? null,
            tempMax: null,
            tempMin: null,
            precip: p.precipitation ?? null,
            gusts: p.wind_gusts_10m ?? null,
        } as OverviewPoint;
      }).filter((p): p is OverviewPoint => p !== null);
      
      if (!base.length) return [];
      
      // Find overall high and low for the 36-hour period
      let minTemp = Infinity, maxTemp = -Infinity;
      let minIndex = -1, maxIndex = -1;

      base.forEach((p, index) => {
          if (p.temp !== null) {
              if (p.temp < minTemp) {
                  minTemp = p.temp;
                  minIndex = index;
              }
              if (p.temp > maxTemp) {
                  maxTemp = p.temp;
                  maxIndex = index;
              }
          }
      });
      
      const formatTimeForTag = (rawTime: string): string => {
          const date = toDate(rawTime);
          if (!date) return '';
          return new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone }).format(date).replace(/\s/g, '');
      };

      if (maxIndex !== -1) {
          const point = base[maxIndex];
          const timeStr = formatTimeForTag(point.rawTime);
          point.tagAbove = `High: ${Math.round(point.temp!)}° (${timeStr})`;
      }
      
      if (minIndex !== -1) {
          const point = base[minIndex];
          const timeStr = formatTimeForTag(point.rawTime);
          point.tagBelow = `Low: ${Math.round(point.temp!)}° (${timeStr})`;
      }

      return base;
    }

    // FIX: Simplify day labels to 3-letter abbreviations (e.g., 'Thu') for a cleaner axis.
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone,
    });

    const dailyRows = hourly.slice(0, 7);

    return dailyRows.map((p, index) => {
      const date = toDate(p.time);
      if (!date) return null;
      
      const label = dayFormatter.format(date);
      const max = p.temperature_2m_max ?? null;
      const min = p.temperature_2m_min ?? null;
      const precip = p.precipitation ?? null;
      const gust = p.wind_gusts_10m_max ?? null;

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
        precip: typeof precip === 'number' ? precip : null,
        gusts: typeof gust === 'number' ? gust : null,
        combinedLabel,
      } as OverviewPoint;
    }).filter((p): p is OverviewPoint => p !== null);
  }, [hourly, activeView, timeZone]);

  if (!medianModel || !chartData.length) {
    return (
        <div className="flex items-center justify-center h-96">
            <p className="text-gray-400">Overview data is not available.</p>
        </div>
    );
  }

  const isHourly = activeView === 'hourly';

  return (
    <div className="h-[60vh] sm:h-96 w-full">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 70, right: 30, left: 5, bottom: 40 }}>
            <defs>
                <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38b2ac" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38b2ac" stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis dataKey="xIndex" tickFormatter={(value: number) => chartData[value]?.label ?? ''} stroke="#a0aec0" tick={{ fill: '#a0aec0' }} interval={0} />
            <YAxis 
              yAxisId="left" 
              stroke="#a0aec0" 
              tick={{ fill: '#a0aec0' }} 
              domain={['auto', 'auto']} 
              label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#a0aec0' }}
            />
            <YAxis yAxisId="right" orientation="right" stroke="#a0aec0" tick={{ fill: '#a0aec0' }} domain={[0, 'auto']} label={{ value: 'mm / kn', angle: 90, position: 'insideRight', fill: '#a0aec0' }} />
            <Tooltip content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }}/>
            <Legend content={<CustomLegend />} />

            <Area type="monotone" yAxisId="right" dataKey="precip" name="Precipitation" stroke="#38b2ac" strokeWidth={2} fill="url(#precipGradient)" unit="mm"/>
            <Bar yAxisId="right" dataKey="gusts" name="Wind Gusts" fill="#4a5568" unit="kn" barSize={isHourly ? 4 : 8}/>

            <Line
              yAxisId="left"
              type="monotone"
              dataKey={isHourly ? 'temp' : 'tempMax'}
              name={isHourly ? 'Temperature' : 'High / Low Temp'}
              stroke="#fafafa"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            >
              {isHourly ? (
                <LabelList
                  dataKey="temp"
                  content={(props: any) => {
                    const { index } = props;
                    const point = chartData[index];
                    if (!point) return null;
                    return (
                      <>
                        {point.tagAbove && <MedianLabel {...props} text={point.tagAbove} dy={-24} />}
                        {point.tagBelow && <MedianLabel {...props} text={point.tagBelow} dy={24} />}
                      </>
                    );
                  }}
                />
              ) : (
                <LabelList
                  dataKey="tempMax"
                  content={(props: any) => {
                    const { index } = props;
                    const point = chartData[index];
                    if (!point || !point.combinedLabel) return null;
                    const dy = index % 2 === 0 ? -24 : -48;
                    return <MedianLabel {...props} text={point.combinedLabel} dy={dy} />;
                  }}
                />
              )}
            </Line>
            
            {!isHourly && (
              <Line yAxisId="left" dataKey="tempMin" stroke="#fafafa" strokeWidth={2} strokeOpacity={0.6} strokeDasharray="3 5" dot={false} isAnimationActive={false} legendType="none" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
  );
};

export default OverviewChart;
