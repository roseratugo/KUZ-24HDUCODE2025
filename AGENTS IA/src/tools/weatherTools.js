import axios from 'axios';
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { langfuse } from '../utils/config.js';

/**
 * Récupère les données météo actuelles pour une ville
 * @param {string} city - Nom de la ville
 * @param {string} apiKey - Clé API OpenWeatherMap
 * @returns {Promise<Object>} - Données météo
 */
async function getCurrentWeather(city, apiKey) {
  const span = langfuse.span({
    name: "weather_api_current",
    input: { city }
  });

  try {
    console.log(`Récupération de la météo actuelle pour: ${city}`);
    
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`, {
        params: {
          q: city,
          appid: apiKey,
          units: 'metric',
          lang: 'fr'
        }
      }
    );
    
    console.log(`Météo actuelle récupérée pour: ${city}`);
    
    const weatherData = {
      city: response.data.name,
      country: response.data.sys.country || "FR",
      temperature: Math.round(response.data.main.temp * 10) / 10,
      feels_like: Math.round(response.data.main.feels_like * 10) / 10,
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      wind_speed: Math.round(response.data.wind.speed * 10) / 10,
      date: new Date(response.data.dt * 1000).toLocaleDateString('fr-FR'),
      time: new Date(response.data.dt * 1000).toLocaleTimeString('fr-FR'),
      icon: response.data.weather[0].icon
    };
    
    span.update({
      output: { 
        city: weatherData.city,
        temperature: weatherData.temperature,
        description: weatherData.description
      },
      status: "success"
    });
    span.end();
    
    return weatherData;
  } catch (error) {
    console.error(`Erreur lors de la récupération de la météo pour ${city}:`, error.message);
    
    if (error.response && error.response.status === 404) {
      console.log(`Ville "${city}" non trouvée, tentative avec "Le Mans"`);
      
      if (city.toLowerCase() !== "le mans") {
        try {
          span.update({
            status: "redirected",
            error: `Ville ${city} non trouvée, redirection vers Le Mans`
          });
          span.end();
          
          return await getCurrentWeather("Le Mans", apiKey);
        } catch (fallbackError) {
          console.error("Échec du fallback sur Le Mans:", fallbackError.message);
        }
      }
    }
    
    span.update({
      status: "error",
      error: error.message
    });
    span.end();
    
    return {
      city: city,
      country: "FR",
      temperature: "--",
      feels_like: "--",
      description: "Information non disponible",
      humidity: "--",
      wind_speed: "--",
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR'),
      error: "Impossible de récupérer les données météo actuelles"
    };
  }
}

/**
 * Récupère les prévisions météo pour une ville
 * @param {string} city - Nom de la ville
 * @param {string} apiKey - Clé API OpenWeatherMap
 * @returns {Promise<Array>} - Prévisions météo
 */
async function getForecastWeather(city, apiKey) {
  const span = langfuse.span({
    name: "weather_api_forecast",
    input: { city }
  });

  try {
    console.log(`Récupération des prévisions météo pour: ${city}`);
    
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast`, {
        params: {
          q: city,
          appid: apiKey,
          units: 'metric',
          lang: 'fr'
        }
      }
    );
    
    console.log(`Prévisions météo récupérées pour: ${city}`);
    
    const forecasts = [];
    
    const dailyForecasts = {};
    
    if (response.data && response.data.list && Array.isArray(response.data.list)) {
      const cityName = response.data.city?.name || city;
      
      response.data.list.forEach(item => {
        if (!item || !item.dt || !item.main || !item.weather || !Array.isArray(item.weather) || item.weather.length === 0) {
          console.warn("Format de données incorrect dans l'entrée de prévision:", item);
          return;
        }
        
        const date = new Date(item.dt * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        if (!dailyForecasts[dateStr]) {
          dailyForecasts[dateStr] = {
            date: date.toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            }),
            temperatures: [],
            descriptions: [],
            icons: [],
            precipitation: [],
            wind_speeds: []
          };
        }
        
        dailyForecasts[dateStr].temperatures.push(item.main.temp);
        dailyForecasts[dateStr].descriptions.push(item.weather[0].description);
        dailyForecasts[dateStr].icons.push(item.weather[0].icon);
        
        if (item.rain && item.rain['3h']) {
          dailyForecasts[dateStr].precipitation.push(item.rain['3h']);
        } else if (item.snow && item.snow['3h']) {
          dailyForecasts[dateStr].precipitation.push(item.snow['3h']);
        } else {
          dailyForecasts[dateStr].precipitation.push(0);
        }
        
        if (item.wind && item.wind.speed) {
          dailyForecasts[dateStr].wind_speeds.push(item.wind.speed);
        }
      });
      
      Object.keys(dailyForecasts).sort().forEach(date => {
        const forecast = dailyForecasts[date];
        const temps = forecast.temperatures;
        const winds = forecast.wind_speeds;
        
        const mostFreqDesc = getMostFrequent(forecast.descriptions);
        const descIndex = forecast.descriptions.indexOf(mostFreqDesc);
        const icon = descIndex >= 0 ? forecast.icons[descIndex] : '';
        
        const avgPrecip = forecast.precipitation.length > 0 
          ? forecast.precipitation.reduce((sum, val) => sum + val, 0) / forecast.precipitation.length 
          : 0;
          
        const hasPrecipitation = avgPrecip > 0;
        
        const avgWind = winds.length > 0 
          ? Math.round((winds.reduce((sum, val) => sum + val, 0) / winds.length) * 10) / 10 
          : 0;
        
        forecasts.push({
          date: forecast.date,
          min_temperature: Math.round(Math.min(...temps) * 10) / 10,
          max_temperature: Math.round(Math.max(...temps) * 10) / 10,
          avg_temperature: Math.round((temps.reduce((sum, val) => sum + val, 0) / temps.length) * 10) / 10,
          description: mostFreqDesc,
          precipitation: hasPrecipitation ? `${Math.round(avgPrecip * 10) / 10} mm` : "Pas de précipitation",
          wind_speed: `${avgWind} m/s`,
          icon: icon
        });
      });
    } else {
      console.error("Format de réponse API inattendu:", response.data);
      throw new Error("Format de réponse API incorrect");
    }
    
    span.update({
      output: { 
        city: city,
        days: forecasts.length,
        first_day: forecasts.length > 0 ? forecasts[0].date : null
      },
      status: "success"
    });
    span.end();
    
    return forecasts;
  } catch (error) {
    console.error(`Erreur lors de la récupération des prévisions pour ${city}:`, error.message);
    
    if (error.response && error.response.status === 404) {
      console.log(`Ville "${city}" non trouvée pour les prévisions, tentative avec "Le Mans"`);
      
      if (city.toLowerCase() !== "le mans") {
        try {
          span.update({
            status: "redirected",
            error: `Ville ${city} non trouvée, redirection vers Le Mans`
          });
          span.end();
          
          return await getForecastWeather("Le Mans", apiKey);
        } catch (fallbackError) {
          console.error("Échec du fallback sur Le Mans pour les prévisions:", fallbackError.message);
        }
      }
    }
    
    span.update({
      status: "error",
      error: error.message
    });
    span.end();
    
    const forecasts = [];
    const today = new Date();
    const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    
    for (let i = 0; i < 5; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + i);
      
      const dayName = dayNames[forecastDate.getDay()];
      const day = forecastDate.getDate();
      const month = monthNames[forecastDate.getMonth()];
      const year = forecastDate.getFullYear();
      const formattedDate = `${dayName} ${day} ${month} ${year}`;
      
      forecasts.push({
        date: formattedDate,
        min_temperature: "--",
        max_temperature: "--",
        avg_temperature: "--",
        description: "Information non disponible",
        precipitation: "Données non disponibles",
        wind_speed: "Données non disponibles",
        error: i === 0 ? "Impossible de récupérer les prévisions météo" : undefined
      });
    }
    
    return forecasts;
  }
}

/**
 * Fonction utilitaire pour obtenir l'élément le plus fréquent d'un tableau
 * @param {Array} arr - Tableau d'éléments
 * @returns {*} - Élément le plus fréquent
 */
function getMostFrequent(arr) {
  if (!arr || arr.length === 0) return null;
  
  const counts = {};
  let maxCount = 0;
  let maxItem = arr[0];
  
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  }
  
  return maxItem;
}

export const getCurrentWeatherTool = tool(
  async ({ city = "Le Mans" }) => {
    if (city.toLowerCase().includes("mans") && !city.toLowerCase().includes("le mans")) {
      city = "Le Mans";
    }
    
    const span = langfuse.span({
      name: "weather_current_tool",
      input: { city }
    });

    console.log(`Outil getCurrentWeather appelé pour la ville: ${city}`);
    
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      console.error("Clé API OpenWeatherMap manquante");
      return "Je ne peux pas accéder aux données météo pour le moment. La clé API est manquante.";
    }
    
    try {
      const weatherData = await getCurrentWeather(city, apiKey);
      
      if (weatherData.error) {
        return `Désolé, je n'ai pas pu obtenir la météo pour ${city}. ${weatherData.error}`;
      }
      
      const response = `Voici la météo actuelle pour ${weatherData.city} (${weatherData.country}) :
        - Date et heure : ${weatherData.date} à ${weatherData.time}
        - Température : ${weatherData.temperature}°C (ressenti : ${weatherData.feels_like}°C)
        - Conditions : ${weatherData.description}
        - Humidité : ${weatherData.humidity}%
        - Vitesse du vent : ${weatherData.wind_speed} m/s
      `;
      
      console.log(`Réponse pour la météo actuelle générée pour: ${city}`);
      
      span.update({
        output: response.substring(0, 500),
        status: "success"
      });
      span.end();
      
      return response;
    } catch (error) {
      console.error("Erreur lors de l'utilisation de l'outil météo:", error);
      
      span.update({
        status: "error",
        error: error.message
      });
      span.end();
      
      return `Désolé, une erreur est survenue lors de la récupération des informations météo pour ${city}.`;
    }
  },
  {
    name: "get_current_weather",
    description: "Obtient les informations météorologiques actuelles pour une ville donnée",
    schema: z.object({
      city: z.string().optional().describe("Le nom de la ville pour laquelle obtenir la météo actuelle. Par défaut: Le Mans")
    })
  }
);

export const getForecastWeatherTool = tool(
  async ({ city = "Le Mans", days = 5 }) => {
    if (city.toLowerCase().includes("mans") && !city.toLowerCase().includes("le mans")) {
      city = "Le Mans";
    }
    
    const span = langfuse.span({
      name: "weather_forecast_tool",
      input: { city, days }
    });

    console.log(`Outil getForecastWeather appelé pour la ville: ${city}, jours: ${days}`);
    
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      console.error("Clé API OpenWeatherMap manquante");
      return "Je ne peux pas accéder aux prévisions météo pour le moment. La clé API est manquante.";
    }
    
    try {
      const forecastData = await getForecastWeather(city, apiKey);
      
      if (forecastData.length === 0 || forecastData[0]?.error) {
        return `Désolé, je n'ai pas pu obtenir les prévisions pour ${city}. ${forecastData[0]?.error || "Aucune donnée disponible."}`;
      }
      
      const limitedForecast = forecastData.slice(0, Math.min(days, forecastData.length));
      
      let forecastText = "";
      
      limitedForecast.forEach(day => {
        let dayForecast = `- ${day.date} : ${day.min_temperature}°C à ${day.max_temperature}°C, ${day.description}`;
        
        if (day.precipitation && day.precipitation !== "Pas de précipitation" && day.precipitation !== "Données non disponibles") {
          dayForecast += `, précipitations de ${day.precipitation}`;
        }
        
        if (day.wind_speed && day.wind_speed !== "Données non disponibles") {
          dayForecast += `, vent à ${day.wind_speed}`;
        }
        
        forecastText += dayForecast + "\n";
      });
      
      const response = `Voici les prévisions météo pour ${city} pour les ${limitedForecast.length} prochains jours :\n${forecastText}`;
      
      console.log(`Réponse pour les prévisions météo générée pour: ${city}`);
      
      span.update({
        output: response,
        status: "success"
      });
      span.end();
      
      return response;
    } catch (error) {
      console.error("Erreur lors de l'utilisation de l'outil de prévisions:", error);
      
      span.update({
        status: "error",
        error: error.message
      });
      span.end();
      
      return `Désolé, une erreur est survenue lors de la récupération des prévisions météo pour ${city}.`;
    }
  },
  {
    name: "get_forecast_weather",
    description: "Obtient les prévisions météorologiques pour une ville donnée pour les prochains jours",
    schema: z.object({
      city: z.string().optional().describe("Le nom de la ville pour laquelle obtenir les prévisions météo. Par défaut: Le Mans"),
      days: z.number().optional().describe("Le nombre de jours de prévisions souhaités (max 5)")
    })
  }
); 