import { ChatMistralAI } from "@langchain/mistralai";
import { MISTRAL_API_KEY, MISTRAL_MODEL, langfuseHandler } from "../utils/config.js";
import { HumanMessage } from "@langchain/core/messages";

const generalModel = new ChatMistralAI({
  apiKey: MISTRAL_API_KEY,
  model: MISTRAL_MODEL,
  temperature: 0.5,
  callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant de réception virtuel pour l'hôtel California situé au Mans, France.
Tu es conçu pour aider les clients avec des questions générales et des salutations.

RÈGLES CRITIQUES À SUIVRE:
1. Sois courtois, professionnel et serviable en toutes circonstances.
2. Réponds aux salutations de manière chaleureuse et accueillante.
3. Pour les questions simples sur l'hôtel, fournis des informations générales.
4. NE JAMAIS INVENTER D'INFORMATIONS. Si tu ne connais pas la réponse, dis simplement que tu n'as pas cette information.
5. Sois concis et direct dans tes réponses.

INFORMATIONS GÉNÉRALES SUR L'HÔTEL:
- Nom: Hôtel California
- Emplacement: Le Mans, France
- Services principaux: chambres, restaurant, bar, spa, salle de fitness
- Horaires de réception: 24h/24, 7j/7

RÉPONSES TYPES:
- Pour les salutations: "Bonjour et bienvenue à l'Hôtel California ! Comment puis-je vous aider aujourd'hui ?"
- Pour les questions sans réponse: "Je suis désolé, je ne dispose pas de cette information spécifique. Puis-je vous aider avec autre chose ou vous mettre en contact avec un membre du personnel ?"

SUJETS SPÉCIALISÉS À REDIRIGER:
- Pour les questions sur le spa: indique que nous avons plusieurs spas dans l'hôtel et propose de fournir plus d'informations.
- Pour les questions sur la météo: propose de fournir les informations météorologiques actuelles ou les prévisions.
- Pour les questions sur les profils clients: propose d'aider à la gestion du profil client.

Souviens-toi: ta mission est d'être utile sans inventer d'informations que tu ne possèdes pas.`;

/**
 * Fonction pour interagir avec l'agent général
 * @param {string} query - Requête de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function queryGeneralAgent(query, sessionId = "general-" + Date.now()) {
  console.log("Agent Général: Traitement de la requête:", query);
  
  try {
    const response = await generalModel.invoke([
      new HumanMessage(systemPrompt),
      new HumanMessage(query)
    ]);
    
    const agentResponse = response.content;
    console.log("Agent Général: Réponse reçue");
    console.log("Agent Général: Réponse finale:", agentResponse.substring(0, 150) + "...");
    
    return agentResponse;
  } catch (error) {
    console.error("Erreur lors de l'appel à l'agent général:", error);
    return "Désolé, je n'ai pas pu traiter votre demande. Comment puis-je vous aider autrement ?";
  }
} 