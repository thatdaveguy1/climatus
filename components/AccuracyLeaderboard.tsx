
import React, { useMemo } from 'react';
import { AccuracyScore, AccuracyInterval, Metric } from '../types';
import { MODELS } from '../constants';

interface AccuracyLeaderboardProps {
    scores: AccuracyScore[];
    selectedLocationId: number;
    selectedInterval: AccuracyInterval;
    selectedMetric: Metric;
}

const AccuracyLeaderboard: React.FC<AccuracyLeaderboardProps> = ({
    scores,
    selectedLocationId,
    selectedInterval,
    selectedMetric,
}) => {
    const MIN_HOURS_MAP: Record<AccuracyInterval, number> = {
        '24h': 1,
        '48h': 1,
        '5d': 1,
    };
    const minHoursForReliability = MIN_HOURS_MAP[selectedInterval];

    const rankedScores = useMemo(() => {
        if (!scores || scores.length === 0) return [];
        
        return scores
            .filter(score => score.locationId === selectedLocationId)
            .map(modelScore => {
                const metricData = modelScore.scores[selectedMetric.key];
                if (!metricData || !metricData[selectedInterval]) return null;
                const intervalData = metricData[selectedInterval];
                return {
                    modelKey: modelScore.modelKey,
                    modelName: modelScore.modelName,
                    mae: intervalData.meanAbsoluteError,
                    hours: intervalData.hoursTracked,
                };
            })
            .filter((item): item is { modelKey: string; modelName: string; mae: number; hours: number; } => item !== null);
    }, [scores, selectedLocationId, selectedInterval, selectedMetric]);

    const allModelsData = useMemo(() => {
        const scoreMap = new Map<string, { mae: number; hours: number }>();
        rankedScores.forEach(score => {
            scoreMap.set(score.modelKey, { mae: score.mae, hours: score.hours });
        });

        const normalizeParam = (s: string) => s.replace(/_/g, '');
        const normalizedMetricKey = normalizeParam(selectedMetric.key);

        const allTrackableModels = MODELS.filter(m => 
            m.category !== 'Derived' &&
            m.params.some(p => normalizeParam(p) === normalizedMetricKey)
        );

        const displayData = allTrackableModels.map(model => {
            const scoreData = scoreMap.get(model.key);
            return {
                modelKey: model.key,
                modelName: model.name,
                mae: scoreData?.mae ?? 0,
                hours: scoreData?.hours ?? 0,
            };
        });

        return displayData.sort((a, b) => {
            if (a.hours > 0 && b.hours === 0) return -1;
            if (a.hours === 0 && b.hours > 0) return 1;
            if (a.hours === 0 && b.hours === 0) return a.modelName.localeCompare(b.modelName);
            return a.mae - b.mae;
        });
    }, [rankedScores, selectedMetric.key]);

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead>
                        <tr className="border-b border-white/10 text-sm text-gray-400">
                            <th className="p-3 font-semibold">Rank</th>
                            <th className="p-3 font-semibold">Model</th>
                            <th className="p-3 font-semibold text-right">Avg. Error (MAE)</th>
                            <th className="p-3 font-semibold text-right">Hours Tracked</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allModelsData.length > 0 ? (
                            allModelsData.map((score, index) => {
                                const isReliable = score.hours >= minHoursForReliability;
                                return (
                                    <tr key={score.modelKey} className="border-b border-white/10 hover:bg-gray-700/50">
                                        <td className="p-3 font-bold">{score.hours > 0 ? index + 1 : 'N/A'}</td>
                                        <td className="p-3">{score.modelName}</td>
                                        <td className="p-3 text-right font-mono">
                                            {score.hours > 0 ? (
                                                <>
                                                    {score.mae.toFixed(2)}
                                                    {!isReliable && <span className="text-yellow-400">*</span>}
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono">{score.hours}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-gray-400">
                                    No models support this metric.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {allModelsData.some(score => score.hours > 0 && score.hours < minHoursForReliability) && (
                 <p className="text-center text-sm text-yellow-400 mt-4">
                    * Scores with an asterisk are based on a low number of tracked hours (&lt;{minHoursForReliability}) and may not be statistically reliable yet.
                </p>
            )}
        </div>
    );
};

export default AccuracyLeaderboard;
