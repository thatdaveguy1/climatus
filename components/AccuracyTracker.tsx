
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AccuracyScore, AccuracyInterval, Metric } from '../types';
import { getAccuracyScores, initDB, clearAccuracyData } from '../services/dbService';
import { runFullAccuracyCycleNow } from '../services/accuracyService';
import { TRACKABLE_METRICS, ACCURACY_LOCATIONS, ACCURACY_FIRST_RUN_KEY, LAST_ACCURACY_CHECK_KEY } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import AccuracyLeaderboard from './AccuracyLeaderboard';
import HistoricalComparisonChart from './HistoricalComparisonChart';

const AccuracyTracker: React.FC = () => {
    const [scores, setScores] = useState<AccuracyScore[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // UI State
    const [selectedLocationId, setSelectedLocationId] = useState<number>(ACCURACY_LOCATIONS[0].id);
    const [selectedInterval, setSelectedInterval] = useState<AccuracyInterval>('24h');
    const [selectedMetric, setSelectedMetric] = useState<Metric>(TRACKABLE_METRICS[0]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [processingMessage, setProcessingMessage] = useState<string>('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await initDB();
            const savedScores = await getAccuracyScores();
            setScores(savedScores);
        } catch (err) {
            console.error('[AccuracyTracker] Error loading scores:', err);
            setError(err instanceof Error ? err.message : 'Failed to load accuracy scores.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const initialLoad = async () => {
            setLoading(true);
            setError(null);
            try {
                await initDB();
                const savedScores = await getAccuracyScores();
                setScores(savedScores);
            } catch (err) {
                console.error('[AccuracyTracker] Initial score load failed:', err);
                setError(err instanceof Error ? err.message : 'Failed to load accuracy scores.');
                
                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => setRetryCount(prev => prev + 1), delay);
                }
            } finally {
                setLoading(false);
            }
        };
        initialLoad();
    }, [retryCount]);
    
    const totalHoursTrackedForView = useMemo(() => {
        if (!scores) return 0;
        return scores
            .filter(s => s.locationId === selectedLocationId && s.scores[selectedMetric.key]?.[selectedInterval])
            .reduce((total, score) => total + score.scores[selectedMetric.key][selectedInterval].hoursTracked, 0);
    }, [scores, selectedLocationId, selectedMetric, selectedInterval]);

    const showLowDataWarning = totalHoursTrackedForView > 0 && totalHoursTrackedForView < 1;


    const handleCheckForUpdates = async () => {
        setIsProcessing(true);
        setProcessingMessage('Forcing a full update cycle...');
        try {
            await runFullAccuracyCycleNow();
            setProcessingMessage('Update complete. Reloading scores...');
            await loadData();
        } catch (err) {
            console.error("Manual update check failed:", err);
            setError("Failed to run manual update. See console for details.");
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleResetData = async () => {
        if (window.confirm("Are you sure you want to delete all collected accuracy data and start over? This action cannot be undone.")) {
            setIsProcessing(true);
            setProcessingMessage('Clearing all accuracy data...');
            try {
                await clearAccuracyData();
                localStorage.removeItem(ACCURACY_FIRST_RUN_KEY);
                localStorage.removeItem(LAST_ACCURACY_CHECK_KEY);
                setScores([]);
                
                setProcessingMessage('Data cleared. Fetching initial forecasts...');
                await runFullAccuracyCycleNow();
                
                await loadData();
            } catch (err) {
                console.error("Resetting data failed:", err);
                setError("Failed to reset accuracy data. See console for details.");
            } finally {
                setIsProcessing(false);
                setProcessingMessage('');
            }
        }
    };

    const selectedLocation = ACCURACY_LOCATIONS.find(l => l.id === selectedLocationId) || ACCURACY_LOCATIONS[0];
    
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <LoadingSpinner />
                <p className="mt-4 text-lg text-gray-400">Initializing Accuracy Module...</p>
            </div>
        );
    }
    
     if (error) {
        return (
            <div className="text-center p-8 bg-red-900/50 border border-red-500 rounded-lg">
                <h2 className="text-2xl font-bold text-red-400">Error</h2>
                <p className="mt-2 text-red-300">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-center mb-2">
                Forecast Accuracy for {selectedLocation.name}
            </h2>
            <p className="text-center text-gray-400 mb-6">
                Ranking models by their average error for forecasts made for a specific time in the future.
            </p>

            <div className="flex justify-center items-center flex-wrap gap-4 mb-8 p-4 bg-gray-900/50 rounded-md border border-white/10">
                <button
                    onClick={handleCheckForUpdates}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    {isProcessing ? 'Processing...' : 'Force Full Update Now'}
                </button>
                <button
                    onClick={handleResetData}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    Reset Data
                </button>
                {isProcessing && <p className="w-full text-center text-yellow-400 mt-2">{processingMessage}</p>}
            </div>
            
            {/* Location Tabs */}
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 mb-6 border-b border-white/10">
                {ACCURACY_LOCATIONS.map(loc => (
                    <button 
                        key={loc.id} 
                        onClick={() => setSelectedLocationId(loc.id)}
                        disabled={isProcessing}
                        className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ease-in-out relative disabled:text-gray-500 disabled:cursor-not-allowed
                        ${selectedLocationId === loc.id ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        {loc.name}
                        {selectedLocationId === loc.id && 
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full"></span>
                        }
                    </button>
                ))}
            </div>

            {/* Metric Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {TRACKABLE_METRICS.map(metric => (
                    <button
                        key={metric.key}
                        onClick={() => setSelectedMetric(metric)}
                        disabled={isProcessing}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 border disabled:bg-gray-600 disabled:cursor-not-allowed ${
                            selectedMetric.key === metric.key
                            ? 'bg-blue-600 text-white shadow-md border-blue-500'
                            : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 border-white/10'
                        }`}
                    >
                        {metric.label}
                    </button>
                ))}
            </div>

            <p className="text-center text-sm text-gray-400 mb-6 -mt-4">
                Wind speed and gust errors are in knots; visibility errors are in statute miles.
            </p>
            
            {showLowDataWarning && (
                <div className="mb-6 p-4 bg-blue-900/50 border border-blue-700/50 rounded-lg text-sm text-blue-200 text-center">
                    <p><strong>Note:</strong> Scores are based on live forecast data. Reliability improves as more hours are tracked (48+ recommended).</p>
                </div>
            )}
            
            <AccuracyLeaderboard 
                scores={scores}
                selectedLocationId={selectedLocationId}
                selectedInterval={selectedInterval}
                setSelectedInterval={setSelectedInterval}
                selectedMetric={selectedMetric}
                isProcessing={isProcessing}
            />

            <div className="mt-12">
                <h3 className="text-2xl font-bold text-center mb-4">
                    Historical Forecast Performance (Past 36 Hours)
                </h3>
                <p className="text-center text-gray-400 mb-6 max-w-3xl mx-auto">
                    This chart compares the most recent forecasts made by each model for a specific hour against the actual recorded weather for that hour. This helps visualize model behavior and bias over time. Forecasts must be at least 6 hours old to be included.
                </p>
                <HistoricalComparisonChart
                    key={`${selectedLocationId}-${selectedMetric.key}`}
                    selectedLocationId={selectedLocationId}
                    selectedMetric={selectedMetric}
                />
            </div>
            
            <p className="text-center text-sm text-gray-500 mt-6 pt-4 border-t border-white/10">
                Please note: Accuracy tracking is performed for fixed locations and does not change with the city selected in the main search bar.
            </p>
        </div>
    );
};

export default AccuracyTracker;
