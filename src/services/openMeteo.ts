/**
 * Lightweight Open‑Meteo wrapper using plain fetch (browser-friendly)
 * Returns a normalized object with `current`, `hourly`, and `daily` fields.
 */
export async function fetchWeatherForPoint(lat: number, lon: number) {
  const base = 'https://api.open-meteo.com/v1/forecast';
  // Use "current=" for richer current fields, not legacy current_weather
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    current: [
      'temperature_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation',
      'precipitation_probability',
      'wind_speed_10m',
      'wind_gusts_10m',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
    ].join(','),
  });

  const url = `${base}?${params.toString()}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open‑Meteo request failed: ${r.status}`);
  const j = await r.json();

  // Normalize to match UI expectations
  const currentSrc = j.current || j.current_weather || {};
  const current = (currentSrc && (currentSrc.temperature_2m != null || currentSrc.temperature != null))
    ? {
        time: currentSrc.time ? new Date(currentSrc.time) : null,
        temperature_2m: currentSrc.temperature_2m ?? currentSrc.temperature ?? null,
        precipitation: currentSrc.precipitation ?? null,
        weather_code: currentSrc.weather_code ?? currentSrc.weathercode ?? null,
        wind_speed_10m: currentSrc.wind_speed_10m ?? currentSrc.windspeed ?? null,
        wind_gusts_10m: currentSrc.wind_gusts_10m ?? null,
        wind_direction_10m: currentSrc.wind_direction_10m ?? currentSrc.winddirection ?? null,
      }
    : null;

  const hourlyBlock = j.hourly || {};
  const hourly = hourlyBlock && (hourlyBlock.temperature_2m || hourlyBlock.precipitation)
    ? {
        time: hourlyBlock.time || [],
        temperature_2m: hourlyBlock.temperature_2m || [],
        precipitation: hourlyBlock.precipitation || [],
        precipitation_probability: hourlyBlock.precipitation_probability || [],
        wind_speed_10m: hourlyBlock.wind_speed_10m || [],
        wind_gusts_10m: hourlyBlock.wind_gusts_10m || [],
      }
    : null;

  const dailyBlock = j.daily || {};
  const daily = dailyBlock && (dailyBlock.temperature_2m_max || dailyBlock.weather_code)
    ? {
        time: dailyBlock.time || [],
        weather_code: dailyBlock.weather_code || dailyBlock.weathercode || [],
        temperature_2m_max: dailyBlock.temperature_2m_max || [],
        temperature_2m_min: dailyBlock.temperature_2m_min || [],
        wind_speed_10m_max: dailyBlock.wind_speed_10m_max || [],
        wind_gusts_10m_max: dailyBlock.wind_gusts_10m_max || [],
      }
    : null;

  return {
    latitude: j.latitude ?? null,
    longitude: j.longitude ?? null,
    elevation: j.elevation ?? null,
    timezoneOffsetSeconds: (typeof j.utc_offset_seconds === 'number' ? j.utc_offset_seconds : 0),
    current,
    hourly,
    daily,
    raw: j,
  };
}

/**
 * Basic heuristic to determine whether a forecast indicates a storm.
 * - returns true when any of the following are exceeded:
 *   - max wind gusts above `gustThreshold` (m/s)
 *   - hourly precipitation probability above `precipProbThreshold` (%)
 *   - weather code in thunderstorm range (95..99)
 */
export function isStormForecast(weather: any, options?: { gustThreshold?: number; precipProbThreshold?: number }) {
  if (!weather) return false;
  const gustThreshold = options?.gustThreshold ?? 20; // m/s (~72 km/h)
  const precipProbThreshold = options?.precipProbThreshold ?? 60; // % chance

  // check daily gusts
  try {
    const dailyGusts = weather.daily && weather.daily.wind_gusts_10m_max;
    if (Array.isArray(dailyGusts) && dailyGusts.some((g: number) => g >= gustThreshold)) return true;

    // check hourly gusts
    const hourlyGusts = weather.hourly && weather.hourly.wind_gusts_10m;
    if (Array.isArray(hourlyGusts) && hourlyGusts.some((g: number) => g >= gustThreshold)) return true;

    // check precipitation probability
    const precipProb = weather.hourly && weather.hourly.precipitation_probability;
    if (Array.isArray(precipProb) && precipProb.some((p: number) => p >= precipProbThreshold)) return true;

    // check weather codes (95-99 thunderstorm / hail)
    const dailyCodes = weather.daily && weather.daily.weather_code;
    if (Array.isArray(dailyCodes) && dailyCodes.some((c: number) => c >= 95 && c <= 99)) return true;
  } catch (e) {
    // ignore parsing errors and return false
  }

  return false;
}

/** Example usage:
 *
 * import { fetchWeatherForPoint, isStormForecast } from '../services/openMeteo';
 * const data = await fetchWeatherForPoint(52.52, 13.41);
 * const storm = isStormForecast(data);
 */
