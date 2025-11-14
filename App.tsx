

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchForecasts, searchLocations, fetchCurrentWeather, fetchPastWeather } from './services/openMeteoService';
import { ProcessedForecasts, Metric, ForecastView, Location, ModelError, CurrentWeather as CurrentWeatherType, ProcessedHourlyData } from './types';
import { METRICS, DEFAULT_LOCATION, LAST_ACCURACY_CHECK_KEY, MODELS } from './constants';
import Header from './components/Header';
import ComparisonChart from './components/ComparisonChart';
import LoadingSpinner from './components/LoadingSpinner';
import AccuracyTracker from './components/AccuracyTracker';
import { checkAndRunHourlyUpdate, runFullAccuracyCycleNow } from './services/accuracyService';
import ModelErrorLog from './components/ModelErrorLog';
import CurrentWeather from './components/CurrentWeather';
import SearchResultsDropdown from './components/SearchResultsDropdown';
import DailyForecastInfo from './components/DailyForecastInfo';
import AISummary from './components/AISummary';
import { generateForecastSummary } from './services/geminiService';
import ForecastCard from './components/ForecastCard';
import ErrorBoundary from './components/ErrorBoundary';
import DailyForecastView from './components/DailyForecastView';
import HourlyForecastView from './components/HourlyForecastView';
import OverviewChart from './components/OverviewChart';

const App: React.FC = () => {
  const [hourlyForecasts, setHourlyForecasts] = useState<ProcessedForecasts | null>(null);
  const [dailyForecasts, setDailyForecasts] = useState<ProcessedForecasts | null>(null);
  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherType | null>(null);
  const [currentTimezoneAbbr, setCurrentTimezoneAbbr] = useState<string | null>(null);
  const [loadingForecasts, setLoadingForecasts] = useState<boolean>(true);
  const [loadingCurrent, setLoadingCurrent] = useState<boolean>(true);
  const [currentWeatherError, setCurrentWeatherError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelErrors, setModelErrors] = useState<ModelError[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<Metric>(METRICS[0]);
  const [activeView, setActiveView] = useState<ForecastView>('hourly');

  const [location, setLocation] = useState<Location>(DEFAULT_LOCATION);
  
  // New state for autocomplete search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchDropdownVisible, setIsSearchDropdownVisible] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // State for AI summaries (pre-loaded and cached)
  const [hourlyAiSummary, setHourlyAiSummary] = useState<string | null>(null);
  const [dailyAiSummary, setDailyAiSummary] = useState<string | null>(null);
  const [isHourlyAiSummaryLoading, setIsHourlyAiSummaryLoading] = useState<boolean>(false);
  const [isDailyAiSummaryLoading, setIsDailyAiSummaryLoading] = useState<boolean>(false);
  const [hourlyAiSummaryError, setHourlyAiSummaryError] = useState<string | null>(null);
  const [dailyAiSummaryError, setDailyAiSummaryError] = useState<string | null>(null);
  
  // State for expandable card view section
  const [isCardViewExpanded, setIsCardViewExpanded] = useState<boolean>(false);

  // State for derived precipitation data
  const [precipLast6h, setPrecipLast6h] = useState<number | null>(null);
  const [precipNext6h, setPrecipNext6h] = useState<number | null>(null);
  
  const refreshIntervalRef = useRef<number | null>(null);
  const accuracyIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // For development: uncomment the following line to force a full accuracy
    // update cycle on application load. This is useful for quickly seeding
    // data for the accuracy charts and bypassing the initial one-hour wait.
    // runFullAccuracyCycleNow().catch(console.error);
    console.log("App component mounted.");
  }, []);

  const loadCurrentWeather = useCallback(async (loc: Location) => {
    console.log(`[Weather] Starting to load current weather for ${loc.name}...`);
    setLoadingCurrent(true);
    setCurrentWeather(null); 
    setCurrentTimezoneAbbr(null);
    setCurrentWeatherError(null);
    setPrecipLast6h(null);

    try {
        const [{ current, timezoneAbbreviation, error: currentError }, pastData] = await Promise.all([
            fetchCurrentWeather(loc.latitude, loc.longitude),
            fetchPastWeather(loc.latitude, loc.longitude, 1) // Fetch 1 day of past data for precip calc
        ]);

        if (currentError) {
            console.error(`[Weather] Error loading current weather for ${loc.name}:`, currentError);
            setCurrentWeatherError(currentError);
        } else {
            console.log(`[Weather] Successfully loaded current weather for ${loc.name}.`);
            setCurrentWeather(current); // Can be null
            setCurrentTimezoneAbbr(timezoneAbbreviation ?? null);

            // Calculate precipitation for the last 6 hours
            const now = new Date();
            const sixHoursAgo = now.getTime() - 6 * 3600 * 1000;
            const relevantPastData = pastData.filter(record => {
                const recordTime = new Date(record.time!).getTime();
                return recordTime > sixHoursAgo && recordTime <= now.getTime();
            });
            const totalPrecip = relevantPastData.reduce((sum, record) => {
                const rain = record.rain ?? 0; // rain is in mm
                const snowMM = (record.snowfall ?? 0) * 10; // snowfall from service is in cm, convert to mm
                return sum + rain + snowMM;
            }, 0);
            setPrecipLast6h(totalPrecip);
            console.log(`[Weather] Calculated last 6h precipitation: ${totalPrecip.toFixed(2)} mm`);
        }
    } catch (err) {
        console.error("[Weather] Critical UI error in loadCurrentWeather.", err);
        setCurrentWeatherError('An unexpected client-side error occurred.');
    } finally {
        setLoadingCurrent(false);
    }
}, []);

  
  const loadAllForecasts = useCallback(async (loc: Location) => {
    setLoadingForecasts(true);
    setError(null);
    setModelErrors([]);
    try {
      console.log(`[Forecast] Starting to load all forecasts for ${loc.name}...`);
      const [hourlyResult, dailyResult] = await Promise.all([
        fetchForecasts('hourly', loc.latitude, loc.longitude),
        fetchForecasts('daily', loc.latitude, loc.longitude),
      ]);
  
      setHourlyForecasts(hourlyResult.forecasts);
      setDailyForecasts(dailyResult.forecasts);
  
      const allErrors = [...hourlyResult.errors, ...dailyResult.errors];
      const uniqueErrors = Array.from(new Map(allErrors.map(e => [`${e.modelName}-${e.reason}`, e])).values());
      setModelErrors(uniqueErrors);
      
      console.log(`[Forecast] Successfully loaded all forecasts for ${loc.name}.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(`[Forecast] Failed to load forecasts for ${loc.name}:`, errorMessage);
    } finally {
      setLoadingForecasts(false);
    }
  }, []);

  // Effect for fetching current weather. Runs on initial load and when location changes.
  useEffect(() => {
    loadCurrentWeather(location);
  }, [loadCurrentWeather, location]);

  // Effect for fetching forecasts. Runs on initial load and when location changes.
  useEffect(() => {
    loadAllForecasts(location);
  }, [loadAllForecasts, location]);

  // Effect to calculate precipitation for the next 6 hours from forecast data
  useEffect(() => {
    if (!hourlyForecasts || !hourlyForecasts.median_model) {
        setPrecipNext6h(null);
        return;
    }
    const medianData = hourlyForecasts.median_model.hourly;
    const now = new Date();
    const startIndex = medianData.findIndex(p => new Date(p.time + 'Z') >= now);

    if (startIndex === -1) {
        setPrecipNext6h(0);
        return;
    }
    const next6HoursData = medianData.slice(startIndex, startIndex + 6);
    const totalPrecip = next6HoursData.reduce((sum, hour) => sum + (hour.precipitation ?? 0), 0);
    setPrecipNext6h(totalPrecip);
    console.log(`[Forecast] Calculated next 6h precipitation: ${totalPrecip.toFixed(2)} mm`);
  }, [hourlyForecasts]);
  
  const loadAllAiSummaries = useCallback(async (
    hForecasts: ProcessedForecasts,
    dForecasts: ProcessedForecasts
  ) => {
    setIsHourlyAiSummaryLoading(true);
    setIsDailyAiSummaryLoading(true);
    setHourlyAiSummaryError(null);
    setDailyAiSummaryError(null);
    setHourlyAiSummary(null);
    setDailyAiSummary(null);

    console.log(`[AI] Pre-loading summaries for both views for ${location.name}...`);

    const [hourlyResult, dailyResult] = await Promise.allSettled([
      generateForecastSummary(hForecasts, 'hourly', location),
      generateForecastSummary(dForecasts, 'daily', location),
    ]);

    if (hourlyResult.status === 'fulfilled') {
      setHourlyAiSummary(hourlyResult.value);
      console.log(`[AI] Successfully generated hourly summary.`);
    } else {
      const errorMessage = hourlyResult.reason instanceof Error ? hourlyResult.reason.message : 'An AI summary error occurred.';
      setHourlyAiSummaryError(errorMessage);
      console.error(`[AI] Error generating hourly summary:`, hourlyResult.reason);
    }
    setIsHourlyAiSummaryLoading(false);

    if (dailyResult.status === 'fulfilled') {
      setDailyAiSummary(dailyResult.value);
      console.log(`[AI] Successfully generated daily summary.`);
    } else {
      const errorMessage = dailyResult.reason instanceof Error ? dailyResult.reason.message : 'An AI summary error occurred.';
      setDailyAiSummaryError(errorMessage);
      console.error(`[AI] Error generating daily summary:`, dailyResult.reason);
    }
    setIsDailyAiSummaryLoading(false);
  }, [location]);

  // Effect for AI Summary: pre-loads both summaries when forecast data is ready.
  useEffect(() => {
    if (!loadingForecasts && hourlyForecasts && dailyForecasts) {
      loadAllAiSummaries(hourlyForecasts, dailyForecasts);
    }
  }, [hourlyForecasts, dailyForecasts, loadingForecasts, loadAllAiSummaries]);

  const handleAiSummaryRetry = useCallback(async () => {
    console.log(`[AI] Retrying summary for ${activeView} view...`);
    if (activeView === 'hourly') {
        if (!hourlyForecasts) return;
        setIsHourlyAiSummaryLoading(true);
        setHourlyAiSummaryError(null);
        setHourlyAiSummary(null);
        try {
            const summary = await generateForecastSummary(hourlyForecasts, 'hourly', location);
            setHourlyAiSummary(summary);
        } catch (err) {
            setHourlyAiSummaryError(err instanceof Error ? err.message : 'An AI summary error occurred.');
        } finally {
            setIsHourlyAiSummaryLoading(false);
        }
    } else if (activeView === 'daily') {
        if (!dailyForecasts) return;
        setIsDailyAiSummaryLoading(true);
        setDailyAiSummaryError(null);
        setDailyAiSummary(null);
        try {
            const summary = await generateForecastSummary(dailyForecasts, 'daily', location);
            setDailyAiSummary(summary);
        } catch (err) {
            setDailyAiSummaryError(err instanceof Error ? err.message : 'An AI summary error occurred.');
        } finally {
            setIsDailyAiSummaryLoading(false);
        }
    }
  }, [activeView, hourlyForecasts, dailyForecasts, location]);
  
  useEffect(() => {
    const runCheck = async () => {
        const lastCheckString = localStorage.getItem(LAST_ACCURACY_CHECK_KEY);
        const now = Date.now();
        const oneHour = 3600 * 1000;
        const lastCheckTime = lastCheckString ? parseInt(lastCheckString, 10) : 0;

        if (!lastCheckString || isNaN(lastCheckTime) || (now - lastCheckTime) > oneHour) {
            console.log("Time to run hourly accuracy check...");
            try {
                await checkAndRunHourlyUpdate();
                console.log("Accuracy check process finished.");
            } catch (err) {
                // This catch block is now robust. It should be rarely hit because the service swallows errors,
                // but it's here as a safeguard to prevent the "failed: null" message.
                const message =
                    err instanceof Error
                    ? err.message
                    : err != null
                        ? String(err)
                        : "Unknown error (no error object provided)";

                console.error("[UI] Hourly accuracy check wrapper failed:", message, err);
            }
        } else {
             console.log("Skipping accuracy check, not enough time has passed since last run.");
        }
    };

    // Run once shortly after initial load
    const initialCheckTimeout = setTimeout(runCheck, 2000);

    // Then, set up the check to run every hour
    if (accuracyIntervalRef.current) {
      clearInterval(accuracyIntervalRef.current);
    }
    accuracyIntervalRef.current = window.setInterval(runCheck, 3600 * 1000);
    
    // Clean up timers when the component unmounts
    return () => {
      clearTimeout(initialCheckTimeout);
      if (accuracyIntervalRef.current) {
        clearInterval(accuracyIntervalRef.current);
        accuracyIntervalRef.current = null;
      }
    };
  }, []);

  // Effect for seamless background data refresh every 15 minutes.
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

    const refreshData = () => {
      console.log(`[Refresh] Performing scheduled 15-minute background data refresh for ${location.name}...`);
      loadCurrentWeather(location);
      loadAllForecasts(location);
    };

    // Clear any existing interval before setting new one
    if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
    }
    refreshIntervalRef.current = window.setInterval(refreshData, REFRESH_INTERVAL_MS);

    // Clean up the interval when the component unmounts or when dependencies change,
    // to prevent memory leaks and reset the timer on location/view change.
    return () => {
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }
    };
  }, [location, loadCurrentWeather, loadAllForecasts]);


  // Debounce user input for search
  useEffect(() => {
    if (!isSearchDropdownVisible) {
      return; // Don't start timer if dropdown isn't visible
    }
    
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, isSearchDropdownVisible]);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!isSearchDropdownVisible || debouncedSearchQuery.trim().length < 3) {
        setSearchResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }

      console.log(`[Search] Performing search for query: "${debouncedSearchQuery}"`);
      setIsSearching(true);
      setSearchError(null);
      setSearchResults([]);

      try {
        const results = await searchLocations(debouncedSearchQuery);
        if (results.length === 0) {
          setSearchError('No locations found.');
        } else {
          setSearchResults(results);
        }
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Failed to fetch locations.');
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, isSearchDropdownVisible]);

  // Handle clicking outside of the search component to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLocationSelect = (selectedLocation: Location) => {
    console.log(`[UI] Location selected: ${selectedLocation.name}, ${selectedLocation.country}`);
    setLocation(selectedLocation);
    setSearchResults([]);
    setSearchQuery('');
    setIsSearchDropdownVisible(false);
  };
  
  const handleViewChange = (view: ForecastView) => {
    console.log(`[UI] View changed to: ${view}`);
    setActiveView(view);
    // If switching to a forecast view, ensure a valid metric is selected
    if ((view === 'hourly' || view === 'daily') && selectedMetric.key === 'overview') {
        setSelectedMetric(METRICS[1]); // Default to Temperature
    } else if (view === 'accuracy') {
        setSelectedMetric(METRICS[0]); // Reset to overview for accuracy or other views
    }
  };

  const renderContent = () => {
    if (activeView === 'accuracy') {
        return <AccuracyTracker />;
    }
    
    if (loadingForecasts) {
      return (
        <div className="flex flex-col items-center justify-center h-96">
          <LoadingSpinner />
          <p className="mt-4 text-lg text-gray-400">Fetching all forecasts for {location.name}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-8 bg-red-900/50 border border-red-500 rounded-lg">
          <h2 className="text-2xl font-bold text-red-400">Error</h2>
          <p className="mt-2 text-red-300">{error}</p>
           <button 
             onClick={() => loadAllForecasts(location)} 
             className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
           >
             Retry
           </button>
        </div>
      );
    }

    if (!hourlyForecasts || !dailyForecasts || Object.keys(hourlyForecasts).length <= 2) { // Allow for mean/median models
      return (
         <div className="text-center p-8 bg-yellow-900/30 border border-yellow-700 rounded-lg">
           <h2 className="text-2xl font-bold text-yellow-400">No Data Available</h2>
           <p className="mt-2 text-yellow-300">No models returned data for {location.name}. This can happen for locations outside of standard model coverage (e.g., over oceans).</p>
         </div>
      );
    }
    
    const forecastsForCardView = activeView === 'daily' ? dailyForecasts : hourlyForecasts;

    const summary = activeView === 'daily' ? dailyAiSummary : hourlyAiSummary;
    const isAiSummaryLoading = activeView === 'daily' ? isDailyAiSummaryLoading : isHourlyAiSummaryLoading;
    const aiSummaryError = activeView === 'daily' ? dailyAiSummaryError : hourlyAiSummaryError;

    return (
      <>
        {activeView === 'daily' && <DailyForecastInfo />}
        
        {(activeView === 'hourly' || activeView === 'daily') && (
            <div className="mb-8 p-4 sm:p-6 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-lg">
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                    {METRICS.map((metric) => (
                    <button
                        key={metric.key}
                        onClick={() => setSelectedMetric(metric)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 border ${
                        selectedMetric.key === metric.key
                            ? 'bg-blue-600 text-white shadow-md border-blue-500'
                            : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 border-white/10'
                        }`}
                    >
                        {metric.label}
                    </button>
                    ))}
                </div>
                {selectedMetric.key === 'overview' ? (
                  <OverviewChart
                    data={activeView === 'daily' ? dailyForecasts : hourlyForecasts}
                    activeView={activeView}
                  />
                ) : (
                  <ComparisonChart
                    hourlyData={hourlyForecasts}
                    dailyData={dailyForecasts}
                    metric={selectedMetric}
                    activeView={activeView}
                  />
                )}
            </div>
        )}

        {activeView === 'hourly' && (
          <HourlyForecastView data={hourlyForecasts} />
        )}

        {activeView === 'daily' && (
          <DailyForecastView data={dailyForecasts} />
        )}
        
        {(activeView === 'hourly' || activeView === 'daily') && (
          <AISummary
            summary={summary}
            isLoading={isAiSummaryLoading}
            error={aiSummaryError}
            onRetry={handleAiSummaryRetry}
            activeView={activeView}
          />
        )}

        {(activeView === 'hourly' || activeView === 'daily') && (
            <div className="mt-8">
                <button
                    onClick={() => setIsCardViewExpanded(!isCardViewExpanded)}
                    className="w-full flex justify-between items-center p-4 bg-black/20 rounded-xl shadow-lg hover:bg-gray-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10"
                    aria-expanded={isCardViewExpanded}
                    aria-controls="individual-forecast-cards"
                >
                    <h3 className="text-xl font-bold text-gray-200">
                        Individual Model Forecasts
                    </h3>
                    <svg
                        className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${
                        isCardViewExpanded ? 'transform rotate-180' : ''
                        }`}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </button>
                {isCardViewExpanded && (
                    <div id="individual-forecast-cards" className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {MODELS
                            .filter(model => forecastsForCardView[model.key] && forecastsForCardView[model.key].hourly.length > 0)
                            .map(model => (
                                <ForecastCard 
                                    key={model.key}
                                    modelName={model.name}
                                    data={forecastsForCardView[model.key]}
                                    activeView={activeView}
                                />
                            ))
                        }
                    </div>
                )}
            </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <ErrorBoundary>
          <div ref={searchContainerRef} className="relative">
              <Header
                  location={location}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onSearchFocus={() => setIsSearchDropdownVisible(true)}
              />
              {isSearchDropdownVisible && searchQuery.length >= 3 && (
                  <SearchResultsDropdown
                      results={searchResults}
                      isLoading={isSearching}
                      error={searchError}
                      onSelect={handleLocationSelect}
                  />
              )}
          </div>

          <ModelErrorLog errors={modelErrors} onClear={() => setModelErrors([])} />
          
          <CurrentWeather 
            data={currentWeather} 
            loading={loadingCurrent} 
            error={currentWeatherError} 
            timezoneAbbr={currentTimezoneAbbr} 
            precipLast6h={precipLast6h}
            precipNext6h={precipNext6h}
          />
          
          <div className="mb-6 flex justify-center border-b border-white/10">
            <button
              onClick={() => handleViewChange('hourly')}
              className={`px-6 py-3 text-lg font-medium transition-colors duration-200 ease-in-out
                ${activeView === 'hourly' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              36-Hour Forecast
            </button>
            <button
              onClick={() => handleViewChange('daily')}
              className={`px-6 py-3 text-lg font-medium transition-colors duration-200 ease-in-out
                ${activeView === 'daily' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              7-Day Forecast
            </button>
            <button
              onClick={() => handleViewChange('accuracy')}
              className={`px-6 py-3 text-lg font-medium transition-colors duration-200 ease-in-out
                ${activeView === 'accuracy' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Forecast Accuracy
            </button>
          </div>
          <main>
            <ErrorBoundary fallback={<div className="p-4 text-red-400 text-center">Content failed to load. A component may have crashed.</div>}>
                {renderContent()}
            </ErrorBoundary>
          </main>
          <footer className="text-center mt-12 text-gray-500 text-sm">
            <p>Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Open-Meteo</a>.</p>
          </footer>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;