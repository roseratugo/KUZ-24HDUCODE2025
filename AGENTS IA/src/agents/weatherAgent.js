import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
    getCurrentWeatherTool,
    getForecastWeatherTool,
} from "../tools/weatherTools.js";
import {
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    langfuse,
    langfuseHandler,
} from "../utils/config.js";
import { HumanMessage } from "@langchain/core/messages";

const weatherModel = new ChatMistralAI({
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    temperature: 0.3,
    callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant météo spécialisé pour l'hôtel California, un établissement de luxe situé au Mans, France.
Ta mission est de fournir des informations météorologiques précises et utiles aux clients de l'hôtel.

RÈGLES STRICTES:
1. Réponds UNIQUEMENT à la période demandée par l'utilisateur:
   - Si l'utilisateur demande la météo d'aujourd'hui, donne UNIQUEMENT la météo d'aujourd'hui
   - Si l'utilisateur demande la météo de demain, donne UNIQUEMENT la météo de demain
   - Si l'utilisateur demande la météo pour une date spécifique, donne UNIQUEMENT la météo pour cette date
   - Ne fournis JAMAIS d'informations sur des périodes non demandées explicitement

FORMATAGE DES RÉPONSES:
1. Sois EXTRÊMEMENT CONCIS. Limite ta réponse à 2-3 phrases maximum.
2. Structure ta réponse ainsi:
   - Première phrase: conditions météorologiques (température, conditions) pour la période demandée UNIQUEMENT
   - Deuxième phrase (optionnelle): une suggestion d'activité très courte adaptée à la météo

Par défaut, si aucune ville n'est spécifiée, fournis la météo pour Le Mans, où se trouve l'hôtel.

Évite absolument:
- Les longues descriptions
- Les formules de politesse inutiles
- Les détails superflus
- Les prévisions pour des périodes non demandées
- Les informations non pertinentes`;

console.log(
    "Configuration de l'agent météo avec outils:",
    getCurrentWeatherTool.name,
    getForecastWeatherTool.name
);

export const weatherAgent = createReactAgent({
    llm: weatherModel,
    tools: [getCurrentWeatherTool, getForecastWeatherTool],
    systemMessage: systemPrompt,
});

/**
 * Fonction pour interagir avec l'agent météo
 * @param {string} query - Requête de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function queryWeatherAgent(
    query,
    sessionId = "weather-" + Date.now()
) {
    console.log("Agent Météo: Traitement de la requête:", query);

    let enhancedQuery = query;
    if (
        !query.toLowerCase().includes("mans") &&
        !query.toLowerCase().includes("le mans")
    ) {
        enhancedQuery = `Quel temps fait-il au Mans ${query}`;
    }

    enhancedQuery = `${enhancedQuery}. IMPORTANT: Réponds en 3-4 phrases maximum, sois extrêmement concis.`;

    try {
        const response = await weatherModel.invoke([
            new HumanMessage(systemPrompt),
            new HumanMessage(enhancedQuery),
        ]);

        const agentResponse = response.content;
        console.log("Agent Météo: Réponse reçue");
        console.log(
            "Agent Météo: Réponse finale:",
            agentResponse.substring(0, 150) + "..."
        );

        return agentResponse;
    } catch (error) {
        console.error("Erreur lors de l'appel à l'agent météo:", error);
        throw error;
    }
}
