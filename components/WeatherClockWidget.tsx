'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSun, Sun, Snowflake, MapPin } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  cityName: string;
}

const REGIONS = [
  { name: 'Ostrava', lat: 49.8209, lon: 18.2625 },
  { name: 'Praha', lat: 50.0755, lon: 14.4378 },
  { name: 'Brno', lat: 49.1951, lon: 16.6068 },
  { name: 'Olomouc', lat: 49.5938, lon: 17.2509 },
];

export function WeatherClockWidget({ compact = false }: { compact?: boolean }) {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [regionIndex, setRegionIndex] = useState<number>(0);
  const [weather, setWeather] = useState<WeatherData | null>({
    temperature: 21,
    weatherCode: 1,
    cityName: 'Ostrava',
  });

  // Live Clock & Date Update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('cs-CZ', {
          hour: '2-digit',
          minute: '2-digit',
          second: compact ? undefined : '2-digit',
        })
      );
      const dayName = now.toLocaleDateString('cs-CZ', { weekday: 'short' });
      const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const dateFormatted = now.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
      });
      setDateStr(`${dayNameCap} ${dateFormatted}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [compact]);

  // Fetch Open-Meteo Weather for selected Czech region
  useEffect(() => {
    const region = REGIONS[regionIndex];
    let isMounted = true;

    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current_weather=true`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.current_weather && isMounted) {
            setWeather({
              temperature: Math.round(data.current_weather.temperature),
              weatherCode: data.current_weather.weathercode,
              cityName: region.name,
            });
          }
        }
      } catch {
        // Keep existing fallback weather state on network offline
      }
    }

    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 600_000); // 10 minutes
    return () => {
      isMounted = false;
      clearInterval(weatherInterval);
    };
  }, [regionIndex]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun size={14} className="text-amber-500" />;
    if (code >= 1 && code <= 3) return <CloudSun size={14} className="text-amber-400" />;
    if (code >= 51 && code <= 67) return <CloudRain size={14} className="text-sky-400" />;
    if (code >= 71 && code <= 77) return <Snowflake size={14} className="text-indigo-400" />;
    return <Cloud size={14} className="text-slate-400" />;
  };

  const cycleRegion = () => {
    setRegionIndex((prev) => (prev + 1) % REGIONS.length);
  };

  if (compact) {
    return (
      <button
        onClick={cycleRegion}
        className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300 font-bold hover:bg-slate-800 transition"
        title="Přepnout region počasí"
      >
        <span className="font-mono font-black text-white">{timeStr || '00:00'}</span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1">
          {weather && getWeatherIcon(weather.weatherCode)}
          <span className="text-emerald-400 font-black">{weather?.temperature ?? 20}°C</span>
          <span className="text-[10px] text-slate-400">{weather?.cityName ?? 'Ostrava'}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-xs text-slate-700 shadow-xs">
      {/* Clock & Date */}
      <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
        <span className="font-mono font-black text-slate-950 text-sm tracking-tight">
          {timeStr || '00:00:00'}
        </span>
        <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
          {dateStr || 'Po 1.1.'}
        </span>
      </div>

      {/* Weather Widget */}
      <button
        onClick={cycleRegion}
        title="Kliknutím přepnete region (Ostrava, Praha, Brno, Olomouc) pro počasí na montážích"
        className="flex items-center gap-1.5 font-bold hover:bg-white hover:shadow-xs px-2 py-1 rounded-xl transition cursor-pointer"
      >
        {weather && getWeatherIcon(weather.weatherCode)}
        <span className="text-slate-900 font-extrabold">{weather?.temperature ?? 20}°C</span>
        <span className="text-slate-500 text-[11px] flex items-center gap-0.5">
          <MapPin size={10} className="text-rose-500" />
          {weather?.cityName ?? 'Ostrava'}
        </span>
      </button>
    </div>
  );
}
