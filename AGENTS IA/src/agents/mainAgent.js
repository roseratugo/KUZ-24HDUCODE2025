import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import {
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    langfuse,
    langfuseHandler,
} from "../utils/config.js";
import {
    spaTool,
    weatherTool,
    clientTool,
    reservationTool,
} from "../tools/agentTools.js";
import { querySpaAgent } from "../agents/spaAgent.js";
import { queryWeatherAgent } from "../agents/weatherAgent.js";
import { queryClientAgent } from "../agents/clientAgent.js";
import { queryGeneralAgent } from "../agents/generalAgent.js";
import { queryReservationAgent } from "../agents/reservationAgent.js";
import {
    getSessionState,
    updateSessionState,
    manageConversationLength,
    addHumanMessage,
    addAIMessage,
    addSystemMessage,
    ConversationState,
} from "../utils/memory.js";
import {
    HumanMessage,
    AIMessage,
    SystemMessage,
} from "@langchain/core/messages";
import { queryNewsAgent } from "./newsAgent.js";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const mainModel = new ChatMistralAI({
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    temperature: 0.5,
    callbacks: [langfuseHandler],
});

const summaryModel = new ChatMistralAI({
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    temperature: 0.3,
    callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant de réception d'hôtel virtuel pour l'hôtel California situé au Mans, France.
Tu es conçu pour aider les clients avec leurs diverses demandes pendant leur séjour.
Ta mission est de comprendre les besoins du client et de diriger sa demande vers le service approprié.

RÈGLES CRITIQUES À SUIVRE:
1. Pour toute demande concernant les spas, les massages, les soins bien-être ou les services de beauté, tu DOIS
ABSOLUMENT utiliser l'outil spa_agent. Cet outil est spécialement conçu pour gérer ces demandes.

2. Pour toute demande concernant la météo, les prévisions météorologiques, les conditions climatiques actuelles ou futures,
tu DOIS ABSOLUMENT utiliser l'outil weather_agent. Cet outil est spécialement conçu pour fournir des informations météorologiques
précises pour n'importe quelle ville.

3. Pour toute demande concernant la gestion des clients (recherche, création, consultation, mise à jour ou suppression),
tu DOIS ABSOLUMENT utiliser l'outil client_agent. Cet outil est spécialement conçu pour gérer les informations des clients.

4. Pour les questions sur le statut client comme "Suis-je client?", tu DOIS ABSOLUMENT utiliser l'outil client_agent.
Ne réponds JAMAIS directement à ces questions sans utiliser l'outil approprié.

5. Si on te demande de créer un profil client, tu DOIS ABSOLUMENT utiliser l'outil client_agent.
Ne réponds JAMAIS directement à ces demandes sans utiliser l'outil approprié.

6. Pour toute demande concernant les réservations de restaurant, de table, ou de repas, tu DOIS
ABSOLUMENT utiliser l'outil reservation_agent. Cet outil est spécialement conçu pour gérer les réservations
de table au restaurant de l'hôtel.

7. Pour les salutations, questions générales sur l'hôtel ou demandes qui ne correspondent à aucune catégorie spécifique,
traite-les directement de manière courtoise et professionnelle.

8. IMPORTANT: Lorsque tu utilises un outil spécialisé, tu dois TOUJOURS retourner sa réponse EXACTEMENT telle quelle, sans la modifier.

Voici des exemples de demandes pour lesquelles tu dois OBLIGATOIREMENT utiliser l'outil spa_agent :
- "Quels spas sont disponibles dans l'hôtel ?"
- "Où se trouve le spa ?"
- "Quels sont vos horaires d'ouverture pour le spa ?"
- "Comment puis-je réserver un massage ?"
- "Y a-t-il des soins du visage disponibles ?"

Voici des exemples de demandes pour lesquelles tu dois OBLIGATOIREMENT utiliser l'outil weather_agent :
- "Quel temps fait-il à Paris aujourd'hui ?"
- "Quelle est la météo prévue pour demain ?"
- "Va-t-il pleuvoir cette semaine à Lyon ?"
- "Quelles sont les températures attendues pour les prochains jours à Nice ?"
- "Fait-il chaud à Marseille en ce moment ?"

Voici des exemples de demandes pour lesquelles tu dois OBLIGATOIREMENT utiliser l'outil client_agent :
- "Rechercher un client nommé Dupont"
- "Créer un nouveau client"
- "Quelles sont les informations du client avec l'ID 123 ?"
- "Mettre à jour le numéro de téléphone du client Martin"
- "Supprimer le client avec l'ID 456"
- "Suis-je client de l'hôtel ?"
- "Je voudrais créer un profil client"
- "Vérifier si je suis dans votre base de données"

Voici des exemples de demandes pour lesquelles tu dois OBLIGATOIREMENT utiliser l'outil reservation_agent :
- "Je voudrais réserver une table pour dîner"
- "Est-ce que je peux réserver au restaurant pour demain midi ?"
- "Comment faire une réservation au restaurant ?"
- "J'aimerais réserver une table pour 4 personnes"
- "Quelles sont mes réservations actuelles au restaurant ?"
- "Je voudrais modifier ma réservation de restaurant"

Si on te demande la météo sans préciser de ville, considère par défaut qu'il s'agit du Mans, où se situe notre hôtel.

Sois toujours courtois, professionnel et serviable. Adresse-toi aux clients avec respect et assure-toi de bien comprendre
leurs besoins avant de les diriger vers un service spécifique.`;

const tools = [spaTool, weatherTool, clientTool, reservationTool];

const memorySaver = new MemorySaver();

console.log(
    "Outils disponibles:",
    tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
    }))
);

/**
 * Fonction pour générer un résumé de la conversation
 * @param {Array} messages - Liste des messages
 * @param {string} currentSummary - Résumé actuel
 * @returns {Promise<string>} - Nouveau résumé
 */
async function summarizeConversation(messages, currentSummary = "") {
    try {
        const recentMessages = manageConversationLength(messages, 8);

        let summaryPrompt;
        if (currentSummary) {
            summaryPrompt =
                `Voici un résumé de la conversation jusqu'à présent : ${currentSummary}\n\n` +
                `Étends ce résumé en tenant compte des nouveaux messages ci-dessus:`;
        } else {
            summaryPrompt =
                "Crée un résumé concis de la conversation ci-dessus:";
        }

        const messagesWithPrompt = [
            ...recentMessages,
            new HumanMessage(summaryPrompt),
        ];

        const response = await summaryModel.invoke(messagesWithPrompt);
        return response.content;
    } catch (error) {
        console.error("Erreur lors de la génération du résumé:", error);
        return currentSummary || "Pas de résumé disponible.";
    }
}

/**
 * Initialise l'état de conversation pour une nouvelle session
 * @param {string} sessionId - Identifiant de session
 */
function initializeConversationState(sessionId) {
    const state = getSessionState(sessionId);

    if (state.messages.length === 0) {
        const updatedState = addSystemMessage(state, systemPrompt);
        updateSessionState(sessionId, updatedState);
        console.log(
            "État initialisé avec message système pour session:",
            sessionId
        );
    }
}

const newsTool = tool(
    async ({ query }) => {
        console.log("Outil news_agent appelé avec:", query);
        try {
            const response = await queryNewsAgent(query);
            return `RÉPONSE ACTUALITÉS OFFICIELLE: ${response}`;
        } catch (error) {
            console.error(
                "Erreur lors de l'appel à l'agent d'actualités:",
                error
            );
            return "Désolé, je n'ai pas pu obtenir les informations sur les actualités. Veuillez réessayer plus tard.";
        }
    },
    {
        name: "news_agent",
        description:
            "Utiliser cet outil pour obtenir des informations sur les actualités récentes de la ville du Mans",
        schema: z.object({
            query: z
                .string()
                .describe(
                    "La requête de l'utilisateur concernant les actualités"
                ),
        }),
    }
);

export const mainAgent = createReactAgent({
    llm: mainModel,
    tools: [spaTool, weatherTool, clientTool, newsTool, reservationTool],
    systemMessage: systemPrompt,
});

/**
 * Fonction pour déterminer l'agent approprié à l'aide de l'IA
 * @param {string} userInput - Message de l'utilisateur
 * @param {Array} conversationHistory - Historique de la conversation
 * @returns {Promise<string>} - Type d'agent à utiliser ('client', 'spa', 'météo', 'général')
 */
async function determineAgentWithAI(userInput, conversationHistory) {
    try {
        const historyText = conversationHistory
            .slice(-4)
            .map((msg) => {
                if (msg._getType() === "human") {
                    return `Utilisateur: ${msg.content}`;
                } else if (msg._getType() === "ai") {
                    return `Assistant: ${msg.content}`;
                } else {
                    return `Système: ${msg.content}`;
                }
            })
            .join("\n");

        const prompt = `
            Historique de conversation récente:
            ${historyText}

            Requête actuelle de l'utilisateur: "${userInput}"

            Détermine à quelle catégorie appartient cette requête. Réponds uniquement par l'un des mots-clés suivants:
            - "client" - si la requête concerne des informations sur le client, réservations, profil client ou historique
            - "spa" - si la requête concerne les spas, massages, soins bien-être ou services de beauté
            - "météo" - si la requête concerne la météo, les prévisions ou les conditions climatiques
            - "actualités" - si la requête concerne les actualités, les nouvelles ou les événements récents de la ville du Mans
            - "réservation" - si la requête concerne les réservations de table au restaurant
            - "général" - si la requête est une salutation, une question générale sur l'hôtel, ou ne correspond à aucune des catégories ci-dessus

            IMPORTANT: Tiens compte du contexte de la conversation. Si l'utilisateur répond à une question précédente sur son identité ou son profil client, réponds "client" même si la requête seule ne le suggère pas.
        `;

        const response = await mainModel.invoke([new HumanMessage(prompt)]);

        const agentType = response.content.trim().toLowerCase();

        if (
            [
                "client",
                "spa",
                "météo",
                "actualités",
                "réservation",
                "général",
            ].includes(agentType)
        ) {
            return agentType;
        } else {
            console.log(
                `Réponse non valide du modèle: "${agentType}", utilisation de "général" par défaut`
            );
            return "général";
        }
    } catch (error) {
        console.error(
            "Erreur lors de la détermination de l'agent par IA:",
            error
        );
        return "général";
    }
}

/**
 * Fonction pour déterminer la langue de l'entrée utilisateur
 * @param {string} userInput - Message de l'utilisateur
 * @returns {Promise<string>} - Code de langue détecté ('fr', 'es', 'de', 'en')
 */
async function detectLanguage(userInput) {
    try {
        const prompt = `
Détecte la langue du texte suivant et réponds UNIQUEMENT avec le code de langue correspondant:
"${userInput}"

Réponds uniquement avec l'un de ces codes:
- "fr" pour le français
- "es" pour l'espagnol
- "de" pour l'allemand
- "en" pour l'anglais

Si tu n'es pas sûr ou si la langue n'est pas dans cette liste, réponds "fr" par défaut.
`;

        const response = await mainModel.invoke([new HumanMessage(prompt)]);

        const languageCode = response.content.trim().toLowerCase();

        if (["fr", "es", "de", "en"].includes(languageCode)) {
            console.log(`Langue détectée: ${languageCode}`);
            return languageCode;
        } else {
            console.log(
                `Code de langue non valide détecté: "${languageCode}", utilisation du français par défaut`
            );
            return "fr";
        }
    } catch (error) {
        console.error("Erreur lors de la détection de la langue:", error);
        return "fr";
    }
}

/**
 * Fonction pour traduire la réponse dans la langue détectée
 * @param {string} response - Réponse à traduire
 * @param {string} targetLanguage - Code de langue cible
 * @returns {Promise<string>} - Réponse traduite
 */
async function translateResponse(response, targetLanguage) {
    if (targetLanguage === "fr") {
        return response;
    }

    try {
        const languageNames = {
            fr: "français",
            es: "espagnol",
            de: "allemand",
            en: "anglais",
        };

        const prompt = `
Traduis le texte suivant en ${languageNames[targetLanguage]} :

"${response}"

Assure-toi de conserver le même ton, le même style et toutes les informations importantes.
`;

        const translationResponse = await mainModel.invoke([
            new HumanMessage(prompt),
        ]);

        return translationResponse.content;
    } catch (error) {
        console.error("Erreur lors de la traduction de la réponse:", error);
        return response;
    }
}

/**
 * Fonction pour interagir avec l'agent principal
 * @param {string} userInput - Message de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function processUserInput(userInput, sessionId = "default") {
    console.log("Traitement de la demande utilisateur:", userInput);

    const trace = langfuse.span({
        name: "main_agent_conversation",
        userId: sessionId,
        input: userInput,
    });

    try {
        const detectedLanguage = await detectLanguage(userInput);

        initializeConversationState(sessionId);

        let state = getSessionState(sessionId);

        state = addHumanMessage(state, userInput);
        updateSessionState(sessionId, state);

        let finalResponse;
        let responseSource = "main";

        const agentType = await determineAgentWithAI(userInput, state.messages);
        console.log(
            `L'IA a déterminé que cette requête devrait être traitée par l'agent: ${agentType}`
        );

        if (agentType === "client") {
            console.log(
                "Demande identifiée comme liée à un client par l'IA, appel direct à l'agent client"
            );
            try {
                finalResponse = await queryClientAgent(
                    userInput,
                    `client-${sessionId}`
                );
                responseSource = "client";
            } catch (error) {
                console.error(
                    "Erreur lors de l'appel direct à l'agent client:",
                    error
                );
                finalResponse =
                    "Désolé, je n'ai pas pu traiter votre demande concernant les clients. Pourriez-vous reformuler?";
                responseSource = "client-fallback";
            }
        } else if (agentType === "spa") {
            console.log(
                "Demande identifiée comme liée au spa par l'IA, appel direct à l'agent spa"
            );
            try {
                finalResponse = await querySpaAgent(
                    userInput,
                    `spa-${sessionId}`
                );
                responseSource = "spa";
            } catch (error) {
                console.error(
                    "Erreur lors de l'appel direct à l'agent spa:",
                    error
                );
                finalResponse =
                    "Désolé, je n'ai pas pu traiter votre demande concernant le spa. Pourriez-vous reformuler?";
                responseSource = "spa-fallback";
            }
        } else if (agentType === "météo") {
            console.log(
                "Demande identifiée comme liée à la météo par l'IA, appel direct à l'agent météo"
            );
            try {
                finalResponse = await queryWeatherAgent(
                    userInput,
                    `weather-${sessionId}`
                );
                responseSource = "météo";
            } catch (error) {
                console.error(
                    "Erreur lors de l'appel direct à l'agent météo:",
                    error
                );
                finalResponse =
                    "Désolé, je n'ai pas pu obtenir les informations météorologiques. Pourriez-vous reformuler?";
                responseSource = "météo-fallback";
            }
        } else if (agentType === "actualités") {
            console.log(
                "Demande identifiée comme liée aux actualités par l'IA, appel direct à l'agent d'actualités"
            );
            try {
                finalResponse = await queryNewsAgent(
                    userInput,
                    `news-${sessionId}`
                );
                responseSource = "actualités";
            } catch (error) {
                console.error(
                    "Erreur lors de l'appel direct à l'agent d'actualités:",
                    error
                );
                finalResponse =
                    "Désolé, je n'ai pas pu obtenir les informations sur les actualités. Pourriez-vous reformuler?";
                responseSource = "actualités-fallback";
            }
        } else if (agentType === "réservation") {
            console.log(
                "Demande identifiée comme liée à la réservation de restaurant par l'IA, appel direct à l'agent de réservation"
            );
            try {
                finalResponse = await queryReservationAgent(
                    userInput,
                    `reservation-${sessionId}`
                );
                responseSource = "réservation";
            } catch (error) {
                console.error(
                    "Erreur lors de l'appel direct à l'agent de réservation:",
                    error
                );
                finalResponse =
                    "Désolé, je n'ai pas pu traiter votre demande de réservation. Pourriez-vous reformuler?";
                responseSource = "réservation-fallback";
            }
        }
        else if (agentType === "général") {
            console.log(
                "Demande identifiée comme générale par l'IA, appel direct à l'agent général"
            );
            try {
                finalResponse = await queryGeneralAgent(
                    userInput,
                    `general-${sessionId}`
                );
                responseSource = "général";
            } catch (error) {
                console.error(
                    "Erreur lors de l'appel direct à l'agent général:",
                    error
                );
                finalResponse =
                    "Bonjour, comment puis-je vous aider aujourd'hui ?";
                responseSource = "général-fallback";
            }
        }
        else {
            console.log(
                "Aucun agent spécialisé identifié par l'IA, utilisation de l'agent principal comme routeur"
            );

            const agentState = await mainAgent.invoke({
                messages: state.messages,
                configurable: { thread_id: sessionId },
            });

            const response =
                agentState.messages[agentState.messages.length - 1].content;

            if (response.includes("RÉPONSE MÉTÉO OFFICIELLE:")) {
                finalResponse = response.replace(
                    "RÉPONSE MÉTÉO OFFICIELLE: ",
                    ""
                );
                responseSource = "météo";
                console.log(
                    "Réponse de l'agent météo utilisée via l'agent principal"
                );
            } else if (response.includes("RÉPONSE SPA OFFICIELLE:")) {
                finalResponse = response.replace(
                    "RÉPONSE SPA OFFICIELLE: ",
                    ""
                );
                responseSource = "spa";
                console.log(
                    "Réponse de l'agent spa utilisée via l'agent principal"
                );
            } else if (response.includes("RÉPONSE CLIENT OFFICIELLE:")) {
                finalResponse = response.replace(
                    "RÉPONSE CLIENT OFFICIELLE: ",
                    ""
                );
                responseSource = "client";
                console.log(
                    "Réponse de l'agent client utilisée via l'agent principal"
                );
            } else if (response.includes("RÉPONSE ACTUALITÉS OFFICIELLE:")) {
                finalResponse = response.replace(
                    "RÉPONSE ACTUALITÉS OFFICIELLE: ",
                    ""
                );
                responseSource = "actualités";
                console.log(
                    "Réponse de l'agent d'actualités utilisée via l'agent principal"
                );
            } else if (response.includes("RÉPONSE RÉSERVATION OFFICIELLE:")) {
                finalResponse = response.replace(
                    "RÉPONSE RÉSERVATION OFFICIELLE: ",
                    ""
                );
                responseSource = "réservation";
                console.log(
                    "Réponse de l'agent de réservation utilisée via l'agent principal"
                );
            }
            else if (
                typeof response === "string" &&
                (response.startsWith("[{") || response.startsWith('{"')) &&
                (response.includes('"name":') || response.includes('"tool":'))
            ) {
                console.log("Détection d'une réponse au format JSON d'action");

                try {
                    const actionData = JSON.parse(response);

                    if (
                        Array.isArray(actionData) &&
                        actionData.length > 0 &&
                        (actionData[0].name === "client_agent" ||
                            actionData[0].name === "create_client" ||
                            actionData[0].name === "search_clients" ||
                            actionData[0].name === "get_client_details")
                    ) {
                        console.log(
                            "Action client détectée, appel direct à l'agent client"
                        );

                        try {
                            finalResponse = await queryClientAgent(
                                userInput,
                                `client-${sessionId}`
                            );
                            responseSource = "client";
                        } catch (clientError) {
                            console.error(
                                "Erreur lors de l'appel direct à l'agent client:",
                                clientError
                            );
                            finalResponse =
                                "Pour vous aider concernant votre profil client, j'aurais besoin de plus d'informations. Pourriez-vous me préciser votre nom complet et votre numéro de téléphone ?";
                            responseSource = "client-fallback";
                        }
                    }
                    else if (
                        Array.isArray(actionData) &&
                        actionData.length > 0 &&
                        actionData[0].name === "weather_agent"
                    ) {
                        console.log(
                            "Action weather_agent détectée, appel direct à l'agent météo"
                        );

                        try {
                            finalResponse = await queryWeatherAgent(
                                userInput,
                                `weather-${sessionId}`
                            );
                            responseSource = "météo";
                        } catch (weatherError) {
                            console.error(
                                "Erreur lors de l'appel direct à l'agent météo:",
                                weatherError
                            );
                            finalResponse =
                                "Désolé, je n'ai pas pu obtenir les informations météorologiques. Pourriez-vous reformuler votre demande ?";
                            responseSource = "météo-fallback";
                        }
                    }
                    else if (
                        Array.isArray(actionData) &&
                        actionData.length > 0 &&
                        actionData[0].name === "spa_agent"
                    ) {
                        console.log(
                            "Action spa_agent détectée, appel direct à l'agent spa"
                        );

                        try {
                            finalResponse = await querySpaAgent(
                                userInput,
                                `spa-${sessionId}`
                            );
                            responseSource = "spa";
                        } catch (spaError) {
                            console.error(
                                "Erreur lors de l'appel direct à l'agent spa:",
                                spaError
                            );
                            finalResponse =
                                "Désolé, je n'ai pas pu obtenir les informations sur le spa. Pourriez-vous reformuler votre demande ?";
                            responseSource = "spa-fallback";
                        }
                    }
                    else if (
                        Array.isArray(actionData) &&
                        actionData.length > 0 &&
                        actionData[0].name === "news_agent"
                    ) {
                        console.log(
                            "Action news_agent détectée, appel direct à l'agent d'actualités"
                        );

                        try {
                            finalResponse = await queryNewsAgent(
                                userInput,
                                `news-${sessionId}`
                            );
                            responseSource = "actualités";
                        } catch (newsError) {
                            console.error(
                                "Erreur lors de l'appel direct à l'agent d'actualités:",
                                newsError
                            );
                            finalResponse =
                                "Désolé, je n'ai pas pu obtenir les informations sur les actualités. Pourriez-vous reformuler votre demande ?";
                            responseSource = "actualités-fallback";
                        }
                    }
                    else if (
                        Array.isArray(actionData) &&
                        actionData.length > 0 &&
                        actionData[0].name === "reservation_agent"
                    ) {
                        console.log(
                            "Action reservation_agent détectée, appel direct à l'agent de réservation"
                        );

                        try {
                            finalResponse = await queryReservationAgent(
                                userInput,
                                `reservation-${sessionId}`
                            );
                            responseSource = "réservation";
                        } catch (reservationError) {
                            console.error(
                                "Erreur lors de l'appel direct à l'agent de réservation:",
                                reservationError
                            );
                            finalResponse =
                                "Désolé, je n'ai pas pu traiter votre demande de réservation. Pourriez-vous reformuler votre demande ?";
                            responseSource = "réservation-fallback";
                        }
                    }
                    else {
                        try {
                            finalResponse = await queryGeneralAgent(
                                userInput,
                                `general-${sessionId}`
                            );
                            responseSource = "général";
                        } catch (error) {
                            console.error(
                                "Erreur lors de l'appel à l'agent général:",
                                error
                            );
                            finalResponse =
                                "Je ne suis pas encore capable de traiter ce type de demande. Puis-je vous aider avec des informations sur nos spas, la météo, ou votre profil client ?";
                            responseSource = "général-fallback";
                        }
                    }
                } catch (jsonError) {
                    console.log(
                        "La réponse n'est pas un JSON valide, utilisation de l'agent général"
                    );
                    try {
                        finalResponse = await queryGeneralAgent(
                            userInput,
                            `general-${sessionId}`
                        );
                        responseSource = "général";
                    } catch (error) {
                        console.error(
                            "Erreur lors de l'appel à l'agent général:",
                            error
                        );
                        finalResponse =
                            "Je ne suis pas encore capable de traiter ce type de demande. Puis-je vous aider avec des informations sur nos spas, la météo, ou votre profil client ?";
                        responseSource = "général-fallback";
                    }
                }
            }
            else {
                try {
                    finalResponse = await queryGeneralAgent(
                        userInput,
                        `general-${sessionId}`
                    );
                    responseSource = "général";
                } catch (error) {
                    console.error(
                        "Erreur lors de l'appel à l'agent général:",
                        error
                    );
                    finalResponse =
                        "Je ne suis pas encore capable de traiter ce type de demande. Puis-je vous aider avec des informations sur nos spas, la météo, ou votre profil client ?";
                    responseSource = "général-fallback";
                }
            }
        }

        const translatedResponse = await translateResponse(
            finalResponse,
            detectedLanguage
        );

        state = addAIMessage(state, translatedResponse);

        state.messages = manageConversationLength(state.messages, 20);

        updateSessionState(sessionId, state);

        trace.update({
            output: translatedResponse,
            status: "success",
            metadata: {
                responseSource: responseSource,
                agentType: agentType,
                detectedLanguage: detectedLanguage,
            },
        });

        return translatedResponse;
    } catch (error) {
        trace.update({
            status: "error",
            error: error.message,
        });

        console.error(
            "Erreur complète lors du traitement de la demande:",
            error
        );
        return "Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer.";
    }
}
