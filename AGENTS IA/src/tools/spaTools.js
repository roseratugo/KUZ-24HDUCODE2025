import axios from 'axios';
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { API_SPA_ENDPOINT, API_SPA_TOKEN, langfuse } from '../utils/config.js';

const originalConsoleLog = console.log;

const MOCK_SPA_DATA = [
  {
    id: 1,
    name: "Spa Sérénité",
    description: "Un havre de paix offrant une gamme complète de massages et soins relaxants",
    location: "Niveau -1, aile Est",
    opening_hours: "7h00 - 21h00, tous les jours",
    phone_number: "+33 1 23 45 67 89",
    email: "serenite@hotel-luxe.com"
  },
  {
    id: 2,
    name: "Spa Aqua Wellness",
    description: "Un espace aquatique luxueux avec bains à remous, sauna et hammam",
    location: "Niveau 2, près de la piscine",
    opening_hours: "8h00 - 22h00, tous les jours",
    phone_number: "+33 1 23 45 67 90",
    email: "aqua@hotel-luxe.com"
  },
  {
    id: 3,
    name: "Salon de Beauté Royal",
    description: "Des soins du visage et du corps exclusifs utilisant des produits de luxe",
    location: "Niveau 1, aile Ouest",
    opening_hours: "9h00 - 20h00, tous les jours",
    phone_number: "+33 1 23 45 67 91",
    email: "beaute@hotel-luxe.com"
  }
];

/**
 * Récupère la liste des spas depuis l'API
 * @param {Object} options - Options de recherche
 * @returns {Promise<Array>} - Liste des spas
 */
async function getSpaList(options = {}) {
  const span = langfuse.span({
    name: "spa_api_fetch",
    input: options
  });

  console.log("Recherche de spas avec options:", options);
  
  try {
    console.log("Appel de l'API:", API_SPA_ENDPOINT);
    
    const response = await axios.get(API_SPA_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${API_SPA_TOKEN}`
      },
      params: options
    });
    
    console.log("Réponse API reçue avec statut:", response.status);
    console.log("Nombre de spas retournés:", Array.isArray(response.data) ? response.data.length : "N/A (pas un tableau)");
    
    span.update({
      output: { count: Array.isArray(response.data) ? response.data.length : 0 },
      status: "success"
    });
    span.end();
    
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des spas:', error.message);
    console.error('Détails de l\'erreur:', error.response ? error.response.data : 'Pas de détails disponibles');
    
    span.update({
      status: "error",
      error: error.message
    });
    span.end();
    
    console.log("Utilisation des données de secours (mock data)");
    return MOCK_SPA_DATA;
  }
}

export const spaSearchTool = tool(
  async ({ query }) => {
    const span = langfuse.span({
      name: "spa_search_tool",
      input: query
    });

    console.log("Outil spa_search appelé avec:", query);
    
    const spas = await getSpaList();
    console.log(`${spas.length} spas trouvés`);
    
    if (spas.length === 0) {
      return "Aucun spa n'est disponible actuellement.";
    }
    
    const uniqueSpas = [];
    const spaNames = new Set();
    
    for (const spa of spas) {
      if (!spaNames.has(spa.name)) {
        spaNames.add(spa.name);
        uniqueSpas.push(spa);
      }
    }
    
    console.log(`${uniqueSpas.length} spas uniques après filtrage des doublons`);
    
    const lowerQuery = query.toLowerCase();
    const mentionsParis = lowerQuery.includes("paris");
    const mentionsLeMans = lowerQuery.includes("mans") || lowerQuery.includes("le mans");
    
    if (mentionsParis) {
      return "Je suis désolé, mais notre hôtel California est situé au Mans et non à Paris. Je peux vous donner des informations sur les spas disponibles dans notre hôtel au Mans. Voici les spas disponibles dans notre hôtel:\n" + 
        uniqueSpas.map(spa => 
          `- ${spa.name}: ${spa.description}
            Emplacement: ${spa.location}
            Horaires d'ouverture: ${spa.opening_hours}
            Contact: ${spa.phone_number}, ${spa.email}
          `
        ).join('\n\n');
    }
    
    const response = `Voici les spas disponibles dans notre hôtel${mentionsLeMans ? ' au Mans' : ''}:\n${uniqueSpas.map(spa => 
      `- ${spa.name}: ${spa.description}
        Emplacement: ${spa.location}
        Horaires d'ouverture: ${spa.opening_hours}
        Contact: ${spa.phone_number}, ${spa.email}`
          ).join('\n\n')}
      `;
    
    console.log("Réponse de l'outil spa_search:", response.substring(0, 100) + "...");
    originalConsoleLog("Réponse complète de spa_search générée (longueur: " + response.length + " caractères)");
    
    span.update({
      output: { responseLength: response.length },
      status: "success"
    });
    span.end();
    
    return response;
  },
  {
    name: "spa_search",
    description: "À UTILISER OBLIGATOIREMENT pour TOUTES les questions concernant les spas, les services disponibles et les réservations. Cet outil fournit des informations sur les spas disponibles dans l'hôtel.",
    schema: z.object({
      query: z.string().describe("La requête du client concernant les services de spa")
    })
  }
); 