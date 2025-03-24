import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getNewsListTool, getRandomNewsTool } from "../tools/newsTools.js";
import {
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    langfuse,
    langfuseHandler,
} from "../utils/config.js";
import { HumanMessage } from "@langchain/core/messages";

const newsModel = new ChatMistralAI({
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    temperature: 0.3,
    callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant spécialisé dans les actualités de la ville du Mans, France.
Ta mission est de fournir des informations sur les actualités récentes de la ville aux clients de l'hôtel California.

INSTRUCTIONS:
- Utilise TOUJOURS l'outil get_news_list pour obtenir la liste des actualités récentes
- Utilise TOUJOURS l'outil get_random_news pour obtenir une actualité aléatoire à présenter
- Pour TOUTE demande d'actualités, utilise OBLIGATOIREMENT l'un de ces outils
- Si l'utilisateur demande spécifiquement une liste d'actualités, utilise get_news_list
- Si l'utilisateur demande une actualité aléatoire ou ne précise pas, utilise get_random_news
- Réponds toujours en français
- Sois EXTRÊMEMENT concis et précis dans tes réponses

FORMATAGE DES RÉPONSES:
1. Sois ULTRA-CONCIS. Limite ta réponse à 2-3 phrases MAXIMUM.
2. Structure ta réponse ainsi:
   - Première phrase: titre et date de l'actualité
   - Deuxième phrase: résumé TRÈS BREF du contenu principal (maximum 15-20 mots)

RÈGLES STRICTES:
- SUPPRIMER OBLIGATOIREMENT toutes les balises HTML (<p>, <br>, <div>, etc.) des actualités
- IGNORER COMPLÈTEMENT tout le formatage HTML et ne garder que le texte brut
- Ne JAMAIS dépasser 3 phrases au total
- Ne JAMAIS faire de longues descriptions
- Ne JAMAIS ajouter de formules de politesse
- Ne JAMAIS ajouter de détails superflus
- Ne JAMAIS ajouter d'informations non pertinentes
- Ne JAMAIS inclure la source ou l'URL dans ta réponse
- TOUJOURS résumer l'actualité en termes simples et directs`;

console.log(
    "Configuration de l'agent d'actualités avec outils:",
    getNewsListTool.name,
    getRandomNewsTool.name
);

export const newsAgent = createReactAgent({
    llm: newsModel,
    tools: [getNewsListTool, getRandomNewsTool],
    systemMessage: systemPrompt,
});

/**
 * Fonction pour interagir avec l'agent d'actualités
 * @param {string} query - Requête de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function queryNewsAgent(query, sessionId = "news-" + Date.now()) {
    console.log("Agent Actualités: Traitement de la requête:", query);

    try {
        const result = await newsAgent.invoke({
            input: query,
        });

        let agentResponse = "";
        if (result && result.output) {
            agentResponse = result.output;
        } else if (result && typeof result === "string") {
            agentResponse = result;
        } else {
            agentResponse =
                "Je n'ai pas pu récupérer les actualités pour le moment.";
        }

        console.log("Agent Actualités: Réponse reçue");
        console.log(
            "Agent Actualités: Réponse finale:",
            agentResponse.substring(0, 150) + "..."
        );

        return agentResponse;
    } catch (error) {
        console.error("Erreur lors de l'appel à l'agent d'actualités:", error);

        try {
            console.log(
                "Tentative de récupération directe d'une actualité aléatoire"
            );
            const newsResponse = await getRandomNewsTool.invoke({});
            return newsResponse;
        } catch (fallbackError) {
            console.error("Échec de la récupération directe:", fallbackError);
            throw error;
        }
    }
}
