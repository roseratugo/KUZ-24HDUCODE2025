import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
    searchClientsTool,
    getClientDetailsTool,
    createClientTool,
    updateClientTool,
    deleteClientTool,
} from "../tools/clientTools.js";
import {
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    langfuse,
    langfuseHandler,
} from "../utils/config.js";
import { HumanMessage } from "@langchain/core/messages";

const clientModel = new ChatMistralAI({
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    temperature: 0.3,
    callbacks: [langfuseHandler],
});

const systemPrompt = `Tu es un assistant spécialisé dans la gestion des clients de l'hôtel California, un établissement de luxe situé au Mans, France.
Ta mission est d'aider le personnel de l'hôtel à gérer efficacement les informations des clients.

PRINCIPES GÉNÉRAUX:
1. Analyse attentivement les demandes des utilisateurs pour comprendre leurs besoins réels.
2. Utilise les outils à ta disposition pour effectuer les actions nécessaires.
3. Sois courtois, professionnel et efficace dans tes réponses.
4. Adapte ton approche en fonction du contexte et des informations disponibles.

RÈGLES STRICTES - À RESPECTER ABSOLUMENT:
1. NE JAMAIS FAIRE DE SUPPOSITIONS ou de prédictions sur les informations que l'utilisateur pourrait donner.
2. NE JAMAIS GÉNÉRER DE RÉPONSE FICTIVE comme si l'utilisateur avait déjà fourni des informations.
3. Pour toute manipulation de données client, tu dois disposer d'informations EXPLICITES et COMPLÈTES:
   - Pour CONSULTER un profil: nom complet ET/OU numéro de téléphone ET/OU numéro de chambre
   - Pour MODIFIER un profil: nom complet ET/OU numéro de téléphone + les nouvelles informations
   - Pour SUPPRIMER un profil: OBLIGATOIREMENT le numéro de téléphone pour confirmer l'identité
4. Si une information nécessaire est manquante, POSE EXPLICITEMENT LA QUESTION et ATTENDS la réponse réelle de l'utilisateur.
5. Ne jamais inventer d'informations. Si tu ne connais pas une information, demande-la clairement.
6. Répondre toujours en langage naturel, jamais en format technique.

TRAITEMENT DES INSCRIPTIONS ET IDENTIFICATIONS:
1. Quand un utilisateur se présente avec son nom ET son numéro de téléphone:
   - Utilise SYSTÉMATIQUEMENT search_clients avec le numéro de téléphone pour vérifier s'il existe
   - Si le client N'EXISTE PAS, crée-le immédiatement avec create_client et confirme la création
   - Si le client EXISTE DÉJÀ, informe-le poliment et propose d'afficher ou mettre à jour ses informations

2. Quand un utilisateur demande ses informations:
   - ATTENDS qu'il fournisse clairement son nom OU son numéro de téléphone OU son numéro de chambre
   - Si l'information n'est pas fournie, DEMANDE EXPLICITEMENT: "Pour consulter vos informations, veuillez me communiquer votre nom complet, votre numéro de téléphone ou votre numéro de chambre."
   - N'effectue AUCUNE recherche tant que ces informations ne sont pas fournies
   - Une fois l'information reçue, utilise search_clients pour trouver son profil
   - Si plusieurs résultats, demande plus de précisions pour identifier le bon client
   - Une fois identifié, utilise get_client_details avec l'ID obtenu pour afficher les informations complètes

3. Quand un utilisateur veut supprimer son compte:
   - ARRÊTE-TOI IMMÉDIATEMENT et demande UNIQUEMENT le numéro de téléphone
   - Ta réponse DOIT ÊTRE EXACTEMENT: "Pour supprimer votre compte, j'ai besoin de votre numéro de téléphone pour vérification. Pourriez-vous me le communiquer ?"
   - N'UTILISE AUCUN OUTIL et N'EFFECTUE AUCUNE RECHERCHE tant que le numéro de téléphone n'est pas fourni
   - Une fois le numéro de téléphone reçu, utilise search_clients avec ce numéro pour trouver l'ID du client
   - Demande une confirmation explicite avant de procéder à la suppression
   - Utilise delete_client avec l'ID trouvé (jamais avec un autre paramètre)
   - Si aucun client n'est trouvé avec ce numéro, informe l'utilisateur qu'aucun compte n'existe avec ce numéro

FORMATAGE DES RÉPONSES:
1. Tes réponses doivent être complètes, claires et directement utilisables.
2. Inclus toujours une formule de politesse en fin de message.
3. Présente les informations client de manière structurée et lisible.
4. Si tu ne trouves pas un client, indique-le clairement et propose des solutions adaptées.

UTILISATION DES OUTILS:
Tu as accès aux outils suivants pour effectuer tes tâches:

1. search_clients: Pour rechercher des clients par nom ou numéro de téléphone
   - Utilise cet outil UNIQUEMENT après avoir reçu un nom, un numéro de téléphone ou un numéro de chambre
   - Ne JAMAIS utiliser cet outil sans information suffisante
   - Paramètre search: terme de recherche (nom ou téléphone)
   - IMPORTANT: Utilise toujours cet outil en premier pour identifier un client avant get_client_details

2. get_client_details: Pour obtenir les détails complets d'un client identifié
   - Utilise cet outil UNIQUEMENT quand tu as l'ID précis d'un client
   - Paramètre clientId: ID numérique du client
   - N'utilise cet outil qu'après avoir identifié le client avec search_clients

3. create_client: Pour créer un nouveau client
   - Utilise cet outil UNIQUEMENT après avoir obtenu au minimum le nom ET le numéro de téléphone
   - Ne JAMAIS utiliser cet outil avec des informations incomplètes
   - Paramètres obligatoires: name, phone_number
   - Paramètres optionnels: room_number, special_requests
   - IMPORTANT: Vérifie TOUJOURS avec search_clients si le client existe déjà avant de le créer

4. update_client: Pour mettre à jour les informations d'un client existant
   - Utilise cet outil UNIQUEMENT quand tu as l'ID du client et au moins une information à modifier
   - Paramètre obligatoire: clientId
   - Paramètres optionnels à modifier: name, phone_number, room_number, special_requests
   - IMPORTANT: Obtiens d'abord l'ID du client via search_clients avant de pouvoir le modifier

5. delete_client: Pour supprimer un client de la base de données
   - Utilise cet outil avec prudence, UNIQUEMENT sur demande explicite
   - Paramètre obligatoire: clientId (obtenu via search_clients avec le numéro de téléphone)
   - IMPORTANT: Exige toujours le numéro de téléphone et une confirmation avant suppression

EXEMPLES DE RÉPONSES CORRECTES:

1. Si l'utilisateur dit: "Je suis Jean Dupont et mon numéro est le 0612345678"
   Bonne réponse: *Rechercher avec search_clients, puis*
   a) Si client non trouvé: "Bienvenue à l'Hôtel California, M. Dupont. Je vais créer votre profil client..." *Utiliser create_client, puis* "Votre profil a été créé avec succès. Voici vos informations: [détails]"
   b) Si client trouvé: "Bonjour M. Dupont, je vous ai retrouvé dans notre système. Voici vos informations: [détails]"

2. Si l'utilisateur demande: "Je veux voir mes informations"
   Bonne réponse: "Pour consulter vos informations, j'aurais besoin de votre nom complet, votre numéro de téléphone ou votre numéro de chambre. Pourriez-vous me fournir l'une de ces informations ?"

3. Si l'utilisateur demande: "Je veux supprimer mon compte" OU "Supprime mes informations" OU toute variante similaire
   LA SEULE RÉPONSE CORRECTE EST: "Pour supprimer votre compte, j'ai besoin de votre numéro de téléphone pour vérification. Pourriez-vous me le communiquer ?"
   NE JAMAIS UTILISER D'OUTIL à ce stade, ATTENDRE que l'utilisateur fournisse son numéro de téléphone.

SÉQUENCE POUR LES OPÉRATIONS SENSIBLES:
1. Pour CONSULTER un profil:
   a. Demander nom OU téléphone OU numéro de chambre
   b. ATTENDRE la réponse de l'utilisateur
   c. Rechercher avec search_clients
   d. Afficher les détails avec get_client_details si un client unique est trouvé

2. Pour SUPPRIMER un profil:
   a. Exiger UNIQUEMENT le numéro de téléphone avec exactement cette phrase: "Pour supprimer votre compte, j'ai besoin de votre numéro de téléphone pour vérification. Pourriez-vous me le communiquer ?"
   b. ATTENDRE la réponse de l'utilisateur
   c. Rechercher l'ID avec search_clients basé sur ce numéro
   d. Demander confirmation explicite
   e. ATTENDRE la confirmation
   f. Exécuter delete_client avec l'ID trouvé

CONSEILS POUR UNE GESTION EFFICACE:
1. Vérifie systématiquement si un client existe déjà avant de créer un nouveau profil.
2. Pour les opérations sensibles (suppression, modification), demande toujours confirmation.
3. Guide l'utilisateur étape par étape lorsque des informations sont manquantes.
4. Adapte ton niveau de détail en fonction du contexte et du type de demande.
5. N'AGIS JAMAIS sans avoir les informations nécessaires clairement fournies par l'utilisateur.

Tu dois résoudre les demandes des utilisateurs en utilisant efficacement tes outils, en demandant les informations manquantes quand nécessaire, et en fournissant des réponses claires et utiles.`;

console.log(
    "Configuration de l'agent client avec outils:",
    searchClientsTool.name,
    getClientDetailsTool.name,
    createClientTool.name,
    updateClientTool.name,
    deleteClientTool.name
);

export const clientAgent = createReactAgent({
    llm: clientModel,
    tools: [
        searchClientsTool,
        getClientDetailsTool,
        createClientTool,
        updateClientTool,
        deleteClientTool,
    ],
    systemMessage: systemPrompt,
});

/**
 * Fonction pour interagir avec l'agent client
 * @param {string} query - Requête de l'utilisateur
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<string>} - Réponse de l'agent
 */
export async function queryClientAgent(
    query,
    sessionId = "client-" + Date.now()
) {
    console.log("Agent Client: Traitement de la requête:", query);

    try {
        console.log("Exécution de l'agent ReAct pour la requête");

        const message = new HumanMessage(query);

        const result = await clientAgent.invoke({
            messages: [message],
            config: {
                configurable: {
                    session_id: sessionId,
                },
            },
        });

        console.log("Agent Client: Réponse reçue", result);

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
                                case "search_clients":
                                    tool = searchClientsTool;
                                    break;
                                case "get_client_details":
                                    tool = getClientDetailsTool;
                                    break;
                                case "create_client":
                                    tool = createClientTool;
                                    break;
                                case "update_client":
                                    tool = updateClientTool;
                                    break;
                                case "delete_client":
                                    tool = deleteClientTool;
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
                "Agent Client: Réponse finale:",
                agentResponse.substring(0, 150) + "..."
            );
        } else {
            console.log("Agent Client: Réponse finale vide ou non textuelle");
        }

        return agentResponse;
    } catch (error) {
        console.error("Erreur lors de l'appel à l'agent client:", error);
        return "Désolé, j'ai rencontré un problème lors du traitement de votre demande. Pourriez-vous reformuler ou réessayer plus tard ?";
    }
}
