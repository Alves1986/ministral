import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, MapPin, Loader2, RefreshCw, Wind } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
  timestamp: number;
}

const CACHE_KEY = 'widget_weather_data_v6';
const CACHE_EXPIRATION = 1000 * 60 * 30; // 30 Minutos

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const getWeatherIcon = (code: number, size = 24) => {
    if (code === 0) return <Sun className="text-orange-400" size={size} />;
    if (code >= 1 && code <= 3) return <Cloud className="text-zinc-400" size={size} />;
    if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400" size={size} />;
    if (code >= 71 && code <= 77) return <CloudSnow className="text-cyan-200" size={size} />;
    if (code >= 80 && code <= 82) return <CloudRain className="text-blue-500" size={size} />;
    if (code >= 95) return <CloudLightning className="text-purple-500" size={size} />;
    return <Sun className="text-orange-400" size={size} />;
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return "Céu Limpo";
    if (code >= 1 && code <= 3) return "Nublado";
    if (code >= 51 && code <= 67) return "Chuva";
    if (code >= 71 && code <= 77) return "Neve";
    if (code >= 95) return "Tempestade";
    return "Ensolarado";
  };

  useEffect(() => {
    let isMounted = true;

    const fetchWeatherData = async (lat: number, lon: number) => {
      try {
        // Chama a API do Open-Meteo diretamente do browser (sem servidor Express)
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );

        if (!weatherRes.ok) throw new Error(`Weather API Error: ${weatherRes.status}`);
        const weatherJson = await weatherRes.json();

        let city = "Sua Localização";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const cityRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=pt-BR`,
            { signal: controller.signal, headers: { 'User-Agent': 'GestaoEscala/1.0' } }
          );
          clearTimeout(timeoutId);
          if (cityRes.ok) {
            const cityJson = await cityRes.json();
            const addr = cityJson.address;
            city = addr?.city || addr?.town || addr?.village || addr?.suburb || addr?.county || "Sua Localização";
          }
        } catch { /* ignora erro de geocodificação reversa */ }

        const newData: WeatherData = {
          temperature: weatherJson.current_weather?.temperature ?? 0,
          weatherCode: weatherJson.current_weather?.weathercode ?? 0,
          city,
          timestamp: Date.now()
        };

        if (isMounted) {
          setWeather(newData);
          localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
          setError(false);
        }
      } catch (e: any) {
        console.warn("Aviso ao buscar clima:", e.message || e);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    const getLocationAndFetch = () => {
      if (!navigator.geolocation) {
        fetchWeatherData(-23.5505, -46.6333); // fallback São Paulo
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeatherData(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeatherData(-23.5505, -46.6333), // fallback se recusar
        { enableHighAccuracy: false, timeout: 8000, maximumAge: refreshing ? 0 : 600000 }
      );
    };

    // 1. Tenta carregar do cache
    const cached = localStorage.getItem(CACHE_KEY);
    let shouldFetch = true;
    if (cached) {
      try {
        const parsed: WeatherData = JSON.parse(cached);
        setWeather(parsed);
        setLoading(false);
        if (Date.now() - parsed.timestamp < CACHE_EXPIRATION && !refreshing) {
          shouldFetch = false;
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }

    if (shouldFetch || refreshing) {
      getLocationAndFetch();
    }

    return () => { isMounted = false; };
  }, [refreshing]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
  };

  // Estado de loading
  if (loading && !weather) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/80 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-pulse">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-400 font-medium">Localizando...</span>
      </div>
    );
  }

  // Fallback visual quando erro e sem cache — NÃO some, mostra widget vazio
  if (error && !weather) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <Wind size={20} className="text-zinc-400 shrink-0" />
        <div>
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Clima indisponível</p>
          <button onClick={handleRefresh} className="text-[10px] text-zinc-400 hover:text-ministral-500 flex items-center gap-1 transition-colors" disabled={refreshing}>
            <RefreshCw size={8} className={refreshing ? "animate-spin text-ministral-500" : ""} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center justify-center md:justify-start gap-3 sm:gap-4 px-4 sm:px-5 py-3 w-full md:w-auto bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      
      <div className="flex flex-col items-end shrink-0">
        <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-100 font-bold text-lg leading-none">
          {Math.round(weather.temperature)}°C
          <div className="group-hover:scale-110 transition-transform duration-300">
             {getWeatherIcon(weather.weatherCode)}
          </div>
        </div>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate max-w-[120px]">{getWeatherDescription(weather.weatherCode)}</span>
      </div>
      
      <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 md:mx-2 shrink-0"></div>

      <div className="flex flex-col justify-center min-w-0 flex-1 md:flex-none">
        <div className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide" title={weather.city}>
           <MapPin size={12} className="text-red-500 shrink-0" /> <span className="truncate">{weather.city}</span>
        </div>
        <button 
            onClick={handleRefresh}
            className="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-400 hover:text-ministral-500 transition-colors"
            disabled={refreshing}
        >
            <span className="shrink-0">Atualizar Local</span>
            <RefreshCw size={8} className={`shrink-0 ${refreshing ? "animate-spin text-ministral-500" : ""}`}/>
        </button>
      </div>
    </div>
  );
};

