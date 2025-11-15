import { ProcessedForecasts, Location, CurrentWeather, ActualWeatherRecord, ForecastView } from '../types';

// Use same origin for API calls since the server serves both frontend and API
const API_BASE_URL = '';

class ApiService {
  private async fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}/api${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Weather API methods
  async fetchForecasts(type: 'hourly' | 'daily', latitude: number, longitude: number) {
    return this.fetchApi<{ forecasts: ProcessedForecasts; errors: any[] }>(
      `/weather/forecasts/${type}?latitude=${latitude}&longitude=${longitude}`
    );
  }

  async searchLocations(query: string): Promise<Location[]> {
    return this.fetchApi<Location[]>(`/weather/locations/search?q=${encodeURIComponent(query)}`);
  }

  async fetchCurrentWeather(latitude: number, longitude: number) {
    return this.fetchApi<{ current: CurrentWeather; timezoneAbbreviation: string; error?: string }>(
      `/weather/current?latitude=${latitude}&longitude=${longitude}`
    );
  }

  async fetchPastWeather(latitude: number, longitude: number, days: number): Promise<ActualWeatherRecord[]> {
    return this.fetchApi<ActualWeatherRecord[]>(
      `/weather/past?latitude=${latitude}&longitude=${longitude}&days=${days}`
    );
  }

  // AI API methods
  async generateForecastSummary(forecasts: ProcessedForecasts, view: ForecastView, location: Location): Promise<string> {
    const response = await this.fetchApi<{ summary: string }>('/ai/summary', {
      method: 'POST',
      body: JSON.stringify({ forecasts, view, location }),
    });
    return response.summary;
  }

  // Accuracy API methods
  async triggerAccuracyUpdate() {
    return this.fetchApi<{ status: string; message: string }>('/accuracy/update', {
      method: 'POST',
    });
  }

  async triggerFullAccuracyCycle() {
    return this.fetchApi<{ status: string; message: string }>('/accuracy/full-cycle', {
      method: 'POST',
    });
  }

  async getAccuracyStatus() {
    return this.fetchApi<{
      lastCheck: string | null;
      timeSinceLastCheck: number;
      shouldRunCheck: boolean;
      nextCheckIn: number;
    }>('/accuracy/status');
  }

  // Health check methods
  async checkHealth() {
    return this.fetchApi<{ status: string; timestamp: string }>('/health');
  }

  async checkAiHealth() {
    return this.fetchApi<{ status: string; hasApiKey: boolean }>('/ai/health');
  }
}

export const apiService = new ApiService();

// Export individual functions for backward compatibility
export const fetchForecasts = apiService.fetchForecasts.bind(apiService);
export const searchLocations = apiService.searchLocations.bind(apiService);
export const fetchCurrentWeather = apiService.fetchCurrentWeather.bind(apiService);
export const fetchPastWeather = apiService.fetchPastWeather.bind(apiService);
export const generateForecastSummary = apiService.generateForecastSummary.bind(apiService);
export const checkAndRunHourlyUpdate = apiService.triggerAccuracyUpdate.bind(apiService);
export const runFullAccuracyCycleNow = apiService.triggerFullAccuracyCycle.bind(apiService);