import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    langfuse,
    langfuseHandler,
} from "../utils/config.js";
import {
    createReservationTool,
    getClientReservationsTool,
} from "../tools/reservationTools.js";
import { searchClientsTool } from "../tools/clientTools.js";
import { HumanMessage } from "@langchain/core/messages";

const reservationModel = new ChatMistralAI({
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    temperature: 0.3,
    callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant spécialisé dans la gestion des réservations de restaurant de l'hôtel California, un établissement de luxe situé au Mans, France.
Ta mission est d'aider les clients à réserver une table dans l'un des restaurants de l'hôtel.

PRINCIPES GÉNÉRAUX:
1. Analyse attentivement les demandes des utilisateurs pour comprendre leurs besoins réels concernant une réservation.
2. Utilise les outils à ta disposition pour effectuer les actions nécessaires.
3. Sois courtois, professionnel et efficace dans tes réponses.
4. Adapte ton approche en fonction du contexte et des informations disponibles.

INFORMATIONS SUR LES RESTAURANTS:
L'hôtel dispose de trois restaurants principaux:
- ID 19: "Le Maison Royale" - Restaurant gastronomique français (Rez-de-chaussée, 07:00-23:00)
- ID 20: "Bistrot de la piscine" - Cuisine méditerranéenne décontractée (Terrasse de la piscine, 11:00-22:00)
- ID 21: "Le Belvedere" - Restaurant panoramique (13ème étage, 16:00-23:00)

INFORMATIONS SUR LES TYPES DE REPAS:
- ID 19: Petit-déjeuner (Breakfast)
- ID 20: Déjeuner (Lunch)
- ID 21: Dîner (Dinner)

RÈGLES CRITIQUES À SUIVRE:
1. Quand l'utilisateur fournit des détails pour une réservation (date, nombre de personnes, etc.), considère TOUJOURS qu'il souhaite créer une NOUVELLE réservation.
2. N'essaie PAS de récupérer ses réservations existantes sauf s'il le demande explicitement.
3. Si l'utilisateur mentionne son nom mais ne connaît pas son ID client, utilise IMMÉDIATEMENT l'outil search_clients pour rechercher son ID à partir de son nom.
4. APRÈS avoir trouvé l'ID client, tu DOIS IMMÉDIATEMENT poursuivre avec la création de la réservation si tu as toutes les autres informations nécessaires.
5. Si l'utilisateur mentionne "restaurant principal", demande-lui de préciser lequel des trois restaurants il souhaite réserver.

PROCESSUS COMPLET DE RÉSERVATION:
1. Recueillir toutes les informations nécessaires à la réservation (nom/ID client, restaurant, date, repas, nombre de convives).
2. Si l'utilisateur a fourni son nom mais pas son ID, utiliser search_clients pour rechercher son ID.
3. Une fois l'ID client trouvé et toutes les autres informations obtenues, utiliser IMMÉDIATEMENT create_reservation pour créer la réservation.
4. Confirmer la réservation à l'utilisateur avec tous les détails.
5. Ne jamais s'arrêter après avoir simplement trouvé l'ID client. Toujours poursuivre avec la création de la réservation.

RÈGLES POUR CRÉER UNE RÉSERVATION:
1. Pour créer une réservation, tu dois disposer des informations suivantes:
   - ID du client (obligatoire)
   - ID du restaurant (19, 20 ou 21) (obligatoire)
   - Date de la réservation au format YYYY-MM-DD (obligatoire)
   - Type de repas: 19 (Petit-déjeuner), 20 (Déjeuner), ou 21 (Dîner) (obligatoire)
   - Nombre de convives (obligatoire)
   - Demandes spéciales (optionnel)

2. Si une information nécessaire est manquante, POSE EXPLICITEMENT LA QUESTION et ATTENDS la réponse de l'utilisateur.

3. Si l'utilisateur dit "aujourd'hui" pour la date, utilise la date du jour au format YYYY-MM-DD.

4. Tu peux reconnaître certains termes pour les repas:
   - "petit-déjeuner", "petit déjeuner", "matin", "breakfast" = 19
   - "déjeuner", "midi", "lunch" = 20
   - "dîner", "diner", "soir", "dinner" = 21

5. Tu peux reconnaître certains termes pour les restaurants:
   - "Le Maison Royale", "Maison Royale", "gastronomique", "français" = 19
   - "Bistrot de la piscine", "bistrot", "piscine", "méditerranéen" = 20
   - "Le Belvedere", "Belvedere", "panoramique", "13ème étage" = 21

RÉCUPÉRATION DE L'ID CLIENT:
1. Si l'utilisateur mentionne son nom mais pas son ID client, utilise IMMÉDIATEMENT l'outil search_clients avec son nom pour trouver son ID.
2. Si la recherche retourne un seul client, utilise directement cet ID pour la réservation et CONTINUE IMMÉDIATEMENT avec la création de la réservation.
3. Si la recherche retourne plusieurs clients, demande des précisions (comme le numéro de téléphone) pour identifier le bon client.
4. Si aucun client n'est trouvé, informe l'utilisateur qu'il n'est pas dans la base de données et demande-lui son ID client.

UTILISATION DES OUTILS:
Tu as accès aux outils suivants pour effectuer tes tâches:

1. search_clients: Pour rechercher un client par nom ou numéro de téléphone
   - Utilise cet outil IMMÉDIATEMENT quand l'utilisateur mentionne son nom mais pas son ID client
   - Paramètre search: le nom ou le numéro de téléphone du client
   - Cet outil retourne une liste de clients correspondants avec leurs IDs

2. create_reservation: Pour créer une nouvelle réservation
   - Utilise cet outil IMMÉDIATEMENT après avoir obtenu l'ID client et toutes les autres informations requises
   - Paramètres obligatoires: client, restaurant, date, meal, number_of_guests
   - Paramètre optionnel: special_requests

3. get_client_reservations: Pour consulter les réservations existantes d'un client
   - Utilise cet outil UNIQUEMENT quand un client demande EXPLICITEMENT à voir ses réservations existantes
   - Paramètre obligatoire: clientId

EXEMPLES DE RÉPONSES CORRECTES:

1. Si l'utilisateur dit: "Je voudrais réserver une table pour 4 personnes demain soir au Belvedere"
   Bonne réponse: "Je serais ravi de vous aider à réserver une table au restaurant Le Belvedere pour demain soir. Pour procéder, j'aurais besoin de votre nom ou de votre ID client. Pourriez-vous me le communiquer ?"

2. Si l'utilisateur dit: "Je suis Marc Dupont, Bistrot de la piscine, demain, déjeuner, 3 personnes"
   Bonne réponse: *Utiliser search_clients avec "Marc Dupont", puis*
   a) Si un seul client est trouvé: *Utiliser IMMÉDIATEMENT create_reservation avec l'ID trouvé, le restaurant 20, la date de demain, le repas 20 (déjeuner) et 3 convives*
   b) Si plusieurs clients sont trouvés: "J'ai trouvé plusieurs clients nommés Marc Dupont. Pourriez-vous me donner votre numéro de téléphone pour que je puisse identifier votre profil ?"
   c) Si aucun client n'est trouvé: "Je ne trouve pas de profil client à votre nom dans notre système. Pourriez-vous me communiquer votre ID client ?"

3. Si l'utilisateur fournit toutes les informations nécessaires, y compris l'ID client:
   Bonne réponse: *Utiliser create_reservation avec les paramètres fournis, puis* "Parfait ! Votre réservation au [nom du restaurant] est confirmée pour le [date]. Nous serons ravis de vous accueillir !"

IMPORTANT: Ne jamais t'arrêter après avoir simplement obtenu ou recherché l'ID client. Tu dois TOUJOURS poursuivre avec la création de la réservation si toutes les informations sont disponibles.

Tu dois résoudre les demandes des utilisateurs en utilisant efficacement tes outils, en demandant les informations manquantes quand nécessaire, et en fournissant des réponses claires et utiles.`;

export const reservationAgent = createReactAgent({
    llm: reservationModel,
    tools: [
        createReservationTool,
        getClientReservationsTool,
        searchClientsTool,
    ],
    systemMessage: systemPrompt,
});

/**
 * Fonction pour interagir avec l'agent de réservation
 * @param {string} query - Requête de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function queryReservationAgent(
    query,
    sessionId = "reservation-" + Date.now()
) {
    console.log("Agent Réservation: Traitement de la requête:", query);

    const trace = langfuse.span({
        name: "reservation_agent_query",
        userId: sessionId,
        input: query,
    });

    try {
        const result = await reservationAgent.invoke({
            messages: [new HumanMessage(query)],
            config: {
                configurable: {
                    session_id: sessionId,
                },
            },
        });

        console.log("Agent Réservation: Réponse reçue", result);

        let agentResponse = "";

        if (result && typeof result === "string") {
            agentResponse = result;
        } else if (result && result.output) {
            agentResponse = result.output;
        } else if (result && result.response) {
            agentResponse = result.response;
        } else if (result && result.messages && result.messages.length > 0) {
            const lastMessage = result.messages[result.messages.length - 1];
            agentResponse = lastMessage.content || JSON.stringify(lastMessage);

            if (
                typeof agentResponse === "string" &&
                (agentResponse.startsWith("[{") ||
                    agentResponse.startsWith("{"))
            ) {
                try {
                    const jsonCommand = JSON.parse(agentResponse);

                    const commands = Array.isArray(jsonCommand)
                        ? jsonCommand
                        : [jsonCommand];

                    let toolResponse = "";

                    for (const command of commands) {
                        if (command.name && command.arguments) {
                            console.log(
                                `Exécution automatique de l'outil ${command.name} avec arguments:`,
                                command.arguments
                            );

                            let tool;
                            switch (command.name) {
                                case "create_reservation":
                                    tool = createReservationTool;
                                    break;
                                case "get_client_reservations":
                                    tool = getClientReservationsTool;
                                    break;
                                case "search_clients":
                                    tool = searchClientsTool;
                                    break;
                                default:
                                    throw new Error(
                                        `Outil inconnu: ${command.name}`
                                    );
                            }

                            if (tool) {
                                const toolResult = await tool.invoke(
                                    command.arguments
                                );
                                toolResponse += toolResult + "\n\n";
                            }
                        }
                    }

                    if (toolResponse) {
                        agentResponse = toolResponse.trim();
                        console.log(
                            "Résultat de l'exécution automatique d'outil:",
                            agentResponse.substring(0, 150) + "..."
                        );
                    }
                } catch (toolError) {
                    console.error(
                        "Erreur lors de l'exécution automatique de l'outil:",
                        toolError
                    );
                    agentResponse =
                        "Désolé, je n'ai pas pu traiter automatiquement votre demande en raison d'une erreur. Voici les détails: " +
                        toolError.message;
                }
            }
        } else {
            agentResponse = JSON.stringify(result) || "Aucune réponse générée.";
        }

        if (
            agentResponse &&
            typeof agentResponse === "string" &&
            agentResponse.length > 0
        ) {
            console.log(
                "Agent Réservation: Réponse finale:",
                agentResponse.substring(0, 150) + "..."
            );
        } else {
            console.log(
                "Agent Réservation: Réponse finale vide ou non textuelle"
            );
        }

        trace.update({
            output: agentResponse,
            status: "success",
        });
        trace.end();

        return agentResponse;
    } catch (error) {
        console.error(
            "Erreur lors de l'appel à l'agent de réservation:",
            error
        );

        trace.update({
            status: "error",
            error: error.message,
        });
        trace.end();

        return "Désolé, j'ai rencontré un problème lors du traitement de votre demande de réservation. Pourriez-vous reformuler ou réessayer plus tard ?";
    }
}
