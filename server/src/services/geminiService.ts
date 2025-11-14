import { GoogleGenAI } from "@google/genai";
import { ProcessedForecasts, ForecastView, Location, ProcessedHourlyData } from '../types.js';

const API_KEY = process.env.GEMINI_API_KEY;

// Initialize the AI client only if the API key is available.
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const getFeelsLikeTemp = (tempC: number, wind_speed_10m_kn: number): number => {
    const windKmh = wind_speed_10m_kn * 1.852;
    if (tempC < 10 && windKmh > 5) {
        const windChill = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16);
        return Math.min(tempC, windChill);
    }
    return tempC;
};

function formatHourlyDataForPrompt(hourlyData: ProcessedHourlyData[]): string {
    let prompt = `Here is the hourly forecast data (median from multiple models) for timezone ${USER_TIMEZONE}:\n`;
    prompt += "Time, Temp (°C), FeelsLike (°C), Rain (mm), Snow (cm), Wind (kn), Gusts (kn), CloudCover (%), Visibility (mi), NotableEvent\n";
    
    const now = new Date();
    const startIndex = hourlyData.findIndex(point => new Date(point.time + 'Z') >= now);
    const dataToShow = startIndex !== -1 ? hourlyData.slice(startIndex, startIndex + 36) : [];

    if (dataToShow.length === 0) return prompt;
    
    // Pre-compute notable events
    const notableEvents: { [index: number]: string } = {};
    let firstSnowFound = false;
    let maxGust = 0;
    let maxGustIndex = -1;

    dataToShow.forEach((p, i) => {
        if ((p.snowfall ?? 0) > 0 && !firstSnowFound) {
            notableEvents[i] = 'first_snow';
            firstSnowFound = true;
        }
        if ((p.wind_gusts_10m ?? 0) > maxGust) {
            maxGust = p.wind_gusts_10m as number;
            maxGustIndex = i;
        }
        if (i > 1) {
            const tempNow = p.temperature_2m;
            const tempPrev2h = dataToShow[i - 2].temperature_2m;
            if (tempNow !== null && tempPrev2h !== null && (tempPrev2h - tempNow) > 5) {
                 notableEvents[i] = 'big_temp_drop';
            }
        }
    });
    if (maxGust > 30 && maxGustIndex !== -1) {
        notableEvents[maxGustIndex] = (notableEvents[maxGustIndex] || '') + ' strong_wind';
    }


    dataToShow.forEach((p, i) => {
        const time = new Date(p.time + 'Z').toLocaleString('en-US', { weekday: 'short', hour: 'numeric', hour12: true, timeZone: USER_TIMEZONE });
        const temp = p.temperature_2m;
        const feelsLike = (temp !== null && p.wind_speed_10m !== null) ? getFeelsLikeTemp(temp, p.wind_speed_10m).toFixed(1) : 'N/A';
        const rain = p.rain?.toFixed(1) ?? '0';
        const snow = p.snowfall?.toFixed(1) ?? '0';
        const wind = `${p.wind_speed_10m?.toFixed(0) ?? 'N/A'} ${p.wind_direction_10m ?? ''}`.trim();
        const gusts = p.wind_gusts_10m?.toFixed(0) ?? 'N/A';
        const cloud = p.cloud_cover?.toFixed(0) ?? 'N/A';
        const vis = p.visibility?.toFixed(1) ?? 'N/A';
        const event = notableEvents[i]?.trim() || 'none';

        prompt += `${time}, ${temp?.toFixed(1) ?? 'N/A'}, ${feelsLike}, ${rain}, ${snow}, ${wind}, ${gusts}, ${cloud}, ${vis}, ${event}\n`;
    });
    return prompt;
}

function formatDailyDataForPrompt(dailyData: ProcessedHourlyData[]): string {
    let prompt = `Here is the daily forecast data (median from multiple models) for timezone ${USER_TIMEZONE}:\n`;
    prompt += "Day, High (°C), Low (°C), Total Rain (mm), Total Snow (cm), Peak Wind (kn), NotableEvent\n";
    
    const dataToShow = dailyData.slice(0, 7);
    if (dataToShow.length === 0) return prompt;

    // Pre-compute notable events for the week
    const notableEvents: { [index: number]: string } = {};
    let warmestDayIndex = -1, coldestNightIndex = -1, windiestDayIndex = -1, firstPrecipIndex = -1;
    let maxTemp = -Infinity, minTemp = Infinity, maxWind = -Infinity;

    dataToShow.forEach((p, i) => {
        if (p.temperature_2m_max !== null && p.temperature_2m_max !== undefined && p.temperature_2m_max > maxTemp) {
            maxTemp = p.temperature_2m_max;
            warmestDayIndex = i;
        }
        if (p.temperature_2m_min !== null && p.temperature_2m_min !== undefined && p.temperature_2m_min < minTemp) {
            minTemp = p.temperature_2m_min;
            coldestNightIndex = i;
        }
        if (p.wind_speed_10m !== null && p.wind_speed_10m > maxWind) {
            maxWind = p.wind_speed_10m;
            windiestDayIndex = i;
        }
        if (firstPrecipIndex === -1 && (p.precipitation ?? 0) > 0.1) {
            firstPrecipIndex = i;
        }
    });

    if (warmestDayIndex !== -1) notableEvents[warmestDayIndex] = (notableEvents[warmestDayIndex] || '') + ' warmest_day';
    if (coldestNightIndex !== -1) notableEvents[coldestNightIndex] = (notableEvents[coldestNightIndex] || '') + ' coldest_night';
    if (windiestDayIndex !== -1) notableEvents[windiestDayIndex] = (notableEvents[windiestDayIndex] || '') + ' windiest_day';
    if (firstPrecipIndex !== -1) notableEvents[firstPrecipIndex] = (notableEvents[firstPrecipIndex] || '') + ' first_precip';


    dataToShow.forEach((p, i) => {
        const day = new Date(p.time + 'Z').toLocaleString('en-US', { weekday: 'long', timeZone: USER_TIMEZONE });
        const high = p.temperature_2m_max?.toFixed(0) ?? 'N/A';
        const low = p.temperature_2m_min?.toFixed(0) ?? 'N/A';
        const rain = p.rain?.toFixed(1) ?? '0';
        const snow = p.snowfall?.toFixed(1) ?? '0';
        const wind = `${p.wind_speed_10m?.toFixed(0) ?? 'N/A'} ${p.wind_direction_10m ?? ''}`.trim();
        const event = notableEvents[i]?.trim() || 'none';

        prompt += `${day}, ${high}, ${low}, ${rain}, ${snow}, ${wind}, ${event}\n`;
    });
    return prompt;
}

export const generateForecastSummary = async (
    forecasts: ProcessedForecasts,
    view: ForecastView,
    location: Location
): Promise<string> => {
    // Short-circuit if the API key is not configured. This prevents errors in the UI.
    if (!ai) {
        throw new Error("Gemini API key not configured; AI summary is disabled.");
    }
    
    const medianForecast = forecasts.median_model;

    if (!medianForecast || medianForecast.hourly.length === 0) {
        throw new Error("Median model data is not available for summary.");
    }

    let dataPrompt: string;
    let systemInstruction: string;

    if (view === 'hourly') {
        dataPrompt = formatHourlyDataForPrompt(medianForecast.hourly);
        systemInstruction = `
You are a concise, expert meteorologist writing for an intelligent Canadian homeowner.

TASK:
Using only the data provided for ${location.name}, write a short Markdown summary for the next 36 hours. Pay close attention to the 'NotableEvent' column to identify the main story beats for your summary.

OUTPUT FORMAT (strict):
1. A one-sentence headline on its own line summarizing the overall story.
2. A bulleted list with exactly 3 bullet points:
   - First bullet: temperature story. Describe the trend (e.g., "falling then rising"). Explicitly mention if temperatures cross the 0°C freezing mark in either direction. State the warmest and coldest periods.
   - Second bullet: precipitation story (any rain/snow, when it starts/ends, confidence, "stays dry" if none).
   - Third bullet: wind/visibility story. Describe the trend (e.g., "strong initially, easing later"). Mention strongest gusts, directions, and any visibility issues. Do not just state a single condition for the whole period.

STYLE RULES:
- Use varied, natural language; avoid repeating phrases like "expect dry conditions".
- Prefer short sentences (under 20 words).
- Mention units (°C, kn, mm) only when helpful; don't spam numbers.
- Never restate the raw table.
- Do NOT add sections, titles, or text outside the headline and 3 bullets.
`;
    } else if (view === 'daily') {
        dataPrompt = formatDailyDataForPrompt(medianForecast.hourly);
        systemInstruction = `
You are a concise, expert meteorologist.

TASK:
Using only the data provided for ${location.name}, create an engaging 7-day outlook in Markdown. Pay attention to the 'NotableEvent' column to identify the main story beats for your summary.

OUTPUT FORMAT (strict):
1. A one-sentence overview paragraph summarizing the whole week (trend in temperature + wet/dry signal).
2. A Markdown list of exactly 7 items, one per day, in this format:

- **Thursday:** Short vivid sentence about key weather for that day.
- **Friday:** ...
- **Saturday:** ...
(continue through all 7 days)

CONTENT RULES FOR EACH DAY:
- Include high and low temperatures in °C (rounded) only if they matter to the story.
- Mention precipitation type only if non-zero rain/snow is present (e.g., "light snow in the evening").
- When the day is similar to neighbours, say so explicitly (e.g., "similar to Sunday, still dry and cool") instead of repeating generic text.
- Highlight extremes: warmest day, coldest night, windiest day, first day with any precip.

STYLE RULES:
- One sentence per day, maximum 25 words.
- Vary phrasing across days; don't start every sentence with "Expect".
- No extra headings, tables, or commentary outside the overview paragraph and the 7 list items.
`;
    } else {
        throw new Error("Unsupported view for AI summary.");
    }
    
    const fullPrompt = `${dataPrompt}

Follow the OUTPUT FORMAT and STYLE RULES from the system message exactly.
`;

    console.log(`[Gemini] Sending prompt for ${view} view. Prompt length: ${fullPrompt.length} chars.`);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: fullPrompt,
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.3,
            },
        });
        
        console.log(`[Gemini] Successfully received response.`);
        return response.text || 'No response text available';
    } catch (error) {
        console.error("[Gemini] API call failed:", error);
        throw new Error("The AI summary could not be generated at this time.");
    }
};