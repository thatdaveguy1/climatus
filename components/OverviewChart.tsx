
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

  const items = payload
    .filter((p: any) => p.value !== null && p.value !== undefined)
    .sort((a: any, b: any) => {
      const order = ['tempMax', 'temp', 'tempMin', 'precip', 'gusts'];
      return order.indexOf(a.dataKey) - order.indexOf(b.dataKey);
    });

  return (
    <div className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-100">
      <div className="mb-1 font-semibold">{label}</div>
      {items.map((p: any) => (
        <div key={p.dataKey}>
          {p.name}: {p.value.toFixed(1)} {p.unit || ''}
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

      const base: OverviewPoint[] = slice.map((p, index) => ({
        xIndex: index,
        label: fmt.format(toDate(p.time)),
        rawTime: p.time,
        temp: p.temperature_2m ?? null,
        tempMax: null,
        tempMin: null,
        precip: p.precipitation ?? null,
        gusts: p.wind_gusts_10m ?? null,
      }));

      // Compute 4 tags: today's high/low, tomorrow's low/high
      const dayKey = (d: Date) =>
        d.toLocaleDateString('en-CA', { timeZone });

      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const todayStr = dayKey(today);
      const tomorrowStr = dayKey(tomorrow);

      const belongsTo = (pt: OverviewPoint, key: string) =>
        dayKey(toDate(pt.rawTime)) === key;

      const todayPoints = base.filter((p) => belongsTo(p, todayStr));
      const tomorrowPoints = base.filter((p) => belongsTo(p, tomorrowStr));

      const findExtremumIndex = (
        points: OverviewPoint[],
        kind: 'high' | 'low'
      ): number => {
        let idx = -1;
        for (const p of points) {
          if (p.temp === null || !isFinite(p.temp)) continue;
          if (idx === -1) {
            idx = p.xIndex;
            continue;
          }
          if (kind === 'high' && p.temp! > base[idx].temp!) idx = p.xIndex;
          if (kind === 'low' && p.temp! < base[idx].temp!) idx = p.xIndex;
        }
        return idx;
      };

      const tagAt = (
        index: number,
        where: 'above' | 'below',
        label: string
      ) => {
        if (index < 0 || index >= base.length) return;
        const p = base[index];
        if (p.temp === null || !isFinite(p.temp)) return;
        const text = `${label}: ${Math.round(p.temp)}°`;
        if (where === 'above') p.tagAbove = text;
        else p.tagBelow = text;
      };

      tagAt(findExtremumIndex(todayPoints, 'high'), 'above', "Today's High");
      tagAt(findExtremumIndex(todayPoints, 'low'), 'below', "Today's Low");
      tagAt(
        findExtremumIndex(tomorrowPoints, 'low'),
        'below',
        "Tomorrow's Low"
      );
      tagAt(
        findExtremumIndex(tomorrowPoints, 'high'),
        'above',
        "Tomorrow's High"
      );

      return base;
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
      const rain = (p as any).rain ?? (p as any).precipitation ?? 0;
      const snow = (p as any).snowfall ?? 0;
      const precipTotal = (typeof rain === 'number' ? rain : 0) + (typeof snow === 'number' ? snow : 0);
      const gust = (p as any).wind_gusts_10m_max ?? (p as any).wind_gusts_10m ?? null;

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
        precip: typeof precipTotal === 'number' ? precipTotal : 0,
        gusts: typeof gust === 'number' ? gust : null,
        combinedLabel,
      } as OverviewPoint;
    });
  }, [hourly, activeView, timeZone]);

  if (!medianModel || !chartData.length) {
    return null;
  }

  const isHourly = activeView === 'hourly';

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
          <ComposedChart data={chartData} margin={{ top: 50, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis dataKey="xIndex" tickFormatter={(value: number) => chartData[value]?.label ?? ''} stroke="#a0aec0" tick={{ fill: '#a0aec0' }}/>
            <YAxis 
              yAxisId="left" 
              stroke="#f6ad55" 
              tick={{ fill: '#f6ad55' }} 
              domain={['auto', 'auto']} 
              label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#f6ad55', style: { textAnchor: 'middle' } }}
            />
            <YAxis yAxisId="right" orientation="right" stroke="#63b3ed" tick={{ fill: '#63b3ed' }} domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            <Area type="monotone" yAxisId="right" dataKey="precip" name="Precipitation" stroke="#3182ce" fill="#3182ce33" unit=" mm"/>
            <Bar yAxisId="right" dataKey="gusts" name="Wind Gusts" fill="#63b3ed" unit=" kn" barSize={8}/>

            <Line
              yAxisId="left"
              type="monotone"
              dataKey={isHourly ? 'temp' : 'tempMax'}
              name={isHourly ? 'Temperature' : 'High Temp'}
              stroke="#f6ad55"
              strokeWidth={3}
              dot={{ r: 3 }}
              isAnimationActive={false}
            >
              {isHourly ? (
                <LabelList
                  dataKey="temp"
                  content={(props: any) => {
                    const { index } = props;
                    const point = chartData[index];
                    if (!point || (!point.tagAbove && !point.tagBelow)) return null;
                    const text = point.tagAbove ?? point.tagBelow!;
                    const dy = point.tagAbove ? -24 : 24;
                    const dx = text.startsWith("Today's") ? -10 : text.startsWith("Tomorrow's") ? 10 : 0;
                    return <MedianLabel {...props} text={text} dx={dx} dy={dy} />;
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
              <Line yAxisId="left" name="tempMin" dataKey="tempMin" stroke="#f6ad55" strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OverviewChart;
