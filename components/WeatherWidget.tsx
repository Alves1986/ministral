import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, MapPin, Loader2, RefreshCw } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
  timestamp: number;
}

const CACHE_KEY = 'widget_weather_data_v4';
const CACHE_EXPIRATION = 1000 * 60 * 30; // 30 Minutos

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const getWeatherIcon = (code: number) => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return <Sun className="text-orange-500" size={24} />;
    if (code >= 1 && code <= 3) return <Cloud className="text-zinc-400" size={24} />;
    if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400" size={24} />;
    if (code >= 71 && code <= 77) return <CloudSnow className="text-cyan-200" size={24} />;
    if (code >= 80 && code <= 82) return <CloudRain className="text-blue-500" size={24} />;
    if (code >= 95) return <CloudLightning className="text-purple-500" size={24} />;
    return <Sun className="text-orange-500" size={24} />;
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
              const weatherRes = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);

              if (!weatherRes.ok) {
                  const errText = await weatherRes.text();
                  throw new Error(`Weather API Error: ${weatherRes.status} ${errText}`);
              }
              const weatherJson = await weatherRes.json();
              
              const newData: WeatherData = {
                  temperature: weatherJson.temperature,
                  weatherCode: weatherJson.weatherCode,
                  city: weatherJson.city,
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
              setLoading(false);
              setRefreshing(false);
              setError(true);
              return;
          }

          const options = { 
            enableHighAccuracy: true, // Solicita dados mais precisos do GPS/WiFi
            timeout: 5000, 
            maximumAge: refreshing ? 0 : 600000 
          };

          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
              },
              (err) => {
                  console.warn("Erro ao obter local de alta precisão, tentando fallback convencional:", err);
                  navigator.geolocation.getCurrentPosition(
                      (pos) => {
                          fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
                      },
                      (err2) => {
                          console.warn("Erro de geolocalização geral:", err2);
                          if (isMounted) {
                              setLoading(false);
                              setRefreshing(false);
                              // Se já temos dados em cache, não mostramos erro crítico na tela
                              if (!weather) setError(true);
                          }
                      },
                      { 
                        enableHighAccuracy: false, 
                        timeout: 10000, 
                        maximumAge: refreshing ? 0 : 600000 
                      }
                  );
              },
              options
          );
      };

      // 1. Tenta carregar do Cache
      const cached = localStorage.getItem(CACHE_KEY);
      let shouldFetch = true;

      if (cached) {
          try {
              const parsed: WeatherData = JSON.parse(cached);
              setWeather(parsed);
              setLoading(false); 
              
              // Se o cache é recente e não estamos num refresh manual, não precisa buscar
              if (Date.now() - parsed.timestamp < CACHE_EXPIRATION && !refreshing) {
                  shouldFetch = false;
              }
          } catch (e) {
              localStorage.removeItem(CACHE_KEY);
          }
      }

      // 2. Se não tem cache válido ou é refresh manual, busca novos dados
      if (shouldFetch || refreshing) {
          getLocationAndFetch();
      }

      return () => { isMounted = false; };
  }, [refreshing]);

  const handleRefresh = (e: React.MouseEvent) => {
      e.stopPropagation();
      setRefreshing(true);
  };

  if (loading && !weather) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-pulse">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-400">Localizando...</span>
      </div>
    );
  }

  if (error && !weather) {
      return null;
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