import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { spaSearchTool } from "../tools/spaTools.js";
import { MISTRAL_API_KEY, MISTRAL_MODEL, langfuse, langfuseHandler } from "../utils/config.js";
import { HumanMessage } from "@langchain/core/messages";

const spaModel = new ChatMistralAI({
  apiKey: MISTRAL_API_KEY,
  model: MISTRAL_MODEL,
  temperature: 0.3,
  callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant spécialisé dans les services de spa de l'hôtel California au Mans, France.

RÈGLES CRITIQUES:
1. Tu dois UNIQUEMENT mentionner les spas qui sont explicitement fournis dans les données de l'API.
2. NE JAMAIS inventer de spas, de services ou d'informations qui ne sont pas dans les données.
3. Si aucun spa n'est disponible ou si les données sont vides, dis simplement "Désolé, aucun spa n'est disponible actuellement dans notre hôtel."
4. Si les données contiennent des erreurs ou sont incomplètes, ne les complète pas avec des informations inventées.

FORMATAGE DES RÉPONSES:
1. Sois CONCIS et CONVERSATIONNEL - évite le style formel d'email ou de lettre.
2. PAS de titres en gras, PAS de formatage markdown complexe.
3. PAS de formules de politesse comme "Cordialement" ou signatures.
4. PAS de "Je serais ravi de vous aider" ou phrases d'introduction inutiles.
5. Présente les informations de façon claire et directe.

STRUCTURE IDÉALE:
- Commence directement par présenter les spas disponibles (UNIQUEMENT ceux fournis par l'API)
- Pour chaque spa: nom, brève description (1 phrase), emplacement, horaires
- Termine par une suggestion personnalisée si pertinent (1 phrase)

Pour réserver, contactez directement le spa de votre choix par téléphone.

Sois toujours courtois mais direct, comme si tu parlais à un client en personne.`;

console.log("Configuration de l'agent SPA avec outil:", spaSearchTool.name);

export const spaAgent = createReactAgent({
  llm: spaModel,
  tools: [spaSearchTool],
  systemMessage: systemPrompt
});

/**
 * Fonction pour interagir avec l'agent spa
 * @param {string} query - Requête de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function querySpaAgent(query, sessionId = "spa-" + Date.now()) {
  console.log("Agent Spa: Traitement de la requête:", query);
  
  try {
    const spaData = await spaSearchTool.invoke({ query });
    
    const noSpasAvailable = !spaData || 
                           spaData.includes("Aucun spa n'est disponible") || 
                           spaData.trim() === "";
    
    let enhancedQuery;
    if (noSpasAvailable) {
      enhancedQuery = `${query}. IMPORTANT: Aucun spa n'est disponible actuellement. Réponds simplement "Désolé, aucun spa n'est disponible actuellement dans notre hôtel."`;
    } else {
      enhancedQuery = `${query}. IMPORTANT: Voici les SEULS spas disponibles selon notre API: ${spaData}. 
      Réponds de façon conversationnelle et concise, sans formatage complexe ni formules de politesse. 
      Ne mentionne QUE les spas listés ci-dessus, n'invente AUCUN spa supplémentaire.`;
    }
    
    const response = await spaModel.invoke([
      new HumanMessage(systemPrompt),
      new HumanMessage(enhancedQuery)
    ]);
    
    const agentResponse = response.content;
    console.log("Agent Spa: Réponse reçue");
    console.log("Agent Spa: Réponse finale:", agentResponse.substring(0, 150) + "...");
    
    return agentResponse;
  } catch (error) {
    console.error("Erreur lors de l'appel à l'agent spa:", error);
    throw error;
  }
} 