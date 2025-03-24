import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
    API_CLIENT_ENDPOINT,
    API_CLIENT_TOKEN,
    langfuse,
} from "../utils/config.js";

/**
 * Recherche des clients selon les critères fournis
 * @param {Object} options - Options de recherche
 * @returns {Promise<Array>} - Liste des clients correspondants
 */
async function searchClients(options = {}) {
    const span = langfuse.span({
        name: "client_api_search",
        input: options,
    });

    console.log("Recherche de clients avec options:", options);

    try {
        console.log("Appel de l'API:", API_CLIENT_ENDPOINT);

        const response = await axios.get(API_CLIENT_ENDPOINT, {
            headers: {
                Authorization: `Token ${API_CLIENT_TOKEN}`,
                Accept: "application/json",
            },
            params: options,
        });

        console.log("Réponse API reçue avec statut:", response.status);
        console.log("Nombre de clients retournés:", response.data.count);

        span.update({
            output: { count: response.data.count },
            status: "success",
        });
        span.end();

        return response.data;
    } catch (error) {
        console.error("Erreur lors de la recherche de clients:", error.message);
        console.error(
            "Détails de l'erreur:",
            error.response ? error.response.data : "Pas de détails disponibles"
        );

        span.update({
            status: "error",
            error: error.message,
        });
        span.end();

        throw error;
    }
}

/**
 * Récupère les détails d'un client spécifique
 * @param {number} clientId - ID du client
 * @returns {Promise<Object>} - Détails du client
 */
async function getClientDetails(clientId) {
    const span = langfuse.span({
        name: "client_api_get_details",
        input: { clientId },
    });

    console.log(`Récupération des détails du client ID: ${clientId}`);

    try {
        const response = await axios.get(`${API_CLIENT_ENDPOINT}${clientId}/`, {
            headers: {
                Authorization: `Token ${API_CLIENT_TOKEN}`,
                Accept: "application/json",
            },
        });

        console.log("Détails du client récupérés avec succès");

        span.update({
            output: { clientName: response.data.name },
            status: "success",
        });
        span.end();

        return response.data;
    } catch (error) {
        console.error(
            `Erreur lors de la récupération des détails du client ${clientId}:`,
            error.message
        );

        span.update({
            status: "error",
            error: error.message,
        });
        span.end();

        throw error;
    }
}

/**
 * Crée un nouveau client
 * @param {Object} clientData - Données du client à créer
 * @returns {Promise<Object>} - Client créé
 */
async function createClient(clientData) {
    const span = langfuse.span({
        name: "client_api_create",
        input: clientData,
    });

    console.log("Création d'un nouveau client:", clientData);

    try {
        console.log("En-têtes d'autorisation:", {
            Authorization: `Token ${API_CLIENT_TOKEN}`,
            "Content-Type": "application/json",
        });

        const response = await axios.post(API_CLIENT_ENDPOINT, clientData, {
            headers: {
                Authorization: `Token ${API_CLIENT_TOKEN}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });

        console.log("Client créé avec succès:", response.data);

        span.update({
            output: { clientName: response.data.name },
            status: "success",
        });
        span.end();

        return response.data;
    } catch (error) {
        console.error("Erreur lors de la création du client:", error.message);
        console.error(
            "Détails de l'erreur:",
            error.response ? error.response.data : "Pas de détails disponibles"
        );

        span.update({
            status: "error",
            error: error.message,
        });
        span.end();

        throw error;
    }
}

/**
 * Met à jour les informations d'un client
 * @param {number} clientId - ID du client
 * @param {Object} clientData - Nouvelles données du client
 * @returns {Promise<Object>} - Client mis à jour
 */
async function updateClient(clientId, clientData) {
    const span = langfuse.span({
        name: "client_api_update",
        input: { clientId, ...clientData },
    });

    console.log(`Mise à jour du client ID ${clientId}:`, clientData);

    try {
        const response = await axios.put(
            `${API_CLIENT_ENDPOINT}${clientId}/`,
            clientData,
            {
                headers: {
                    Authorization: `Token ${API_CLIENT_TOKEN}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            }
        );

        console.log("Client mis à jour avec succès:", response.data);

        span.update({
            output: { clientName: response.data.name },
            status: "success",
        });
        span.end();

        return response.data;
    } catch (error) {
        console.error(
            `Erreur lors de la mise à jour du client ${clientId}:`,
            error.message
        );

        span.update({
            status: "error",
            error: error.message,
        });
        span.end();

        throw error;
    }
}

/**
 * Supprime un client
 * @param {number} clientId - ID du client à supprimer
 * @returns {Promise<boolean>} - Succès de la suppression
 */
async function deleteClient(clientId) {
    const span = langfuse.span({
        name: "client_api_delete",
        input: { clientId },
    });

    console.log(`Suppression du client ID: ${clientId}`);

    try {
        const response = await axios.delete(
            `${API_CLIENT_ENDPOINT}${clientId}/`,
            {
                headers: {
                    Authorization: `Token ${API_CLIENT_TOKEN}`,
                    Accept: "application/json",
                },
            }
        );

        console.log(`Client ${clientId} supprimé avec succès`);

        span.update({
            status: "success",
        });
        span.end();

        return true;
    } catch (error) {
        console.error(
            `Erreur lors de la suppression du client ${clientId}:`,
            error.message
        );

        span.update({
            status: "error",
            error: error.message,
        });
        span.end();

        throw error;
    }
}

export const searchClientsTool = tool(
    async ({ search = "", page = 1 }) => {
        const span = langfuse.span({
            name: "client_search_tool",
            input: { search, page },
        });

        console.log("Outil search_clients appelé avec:", { search, page });

        try {
            const results = await searchClients({ search, page });

            if (results.count === 0) {
                const response = `Aucun client trouvé correspondant à "${search}".`;

                span.update({
                    output: { count: 0 },
                    status: "success",
                });
                span.end();

                return response;
            } else {
                let response = `J'ai trouvé ${results.count} client(s) correspondant à "${search}" :\n\n`;

                results.results.forEach((client, index) => {
                    response += `Client #${index + 1}:\n`;
                    response += `- ID: ${client.id}\n`;
                    response += `- Nom: ${client.name}\n`;
                    response += `- Téléphone: ${
                        client.phone_number || "Non renseigné"
                    }\n`;
                    response += `- Chambre: ${
                        client.room_number || "Non renseignée"
                    }\n`;
                    response += `- Demandes spéciales: ${
                        client.special_requests || "Aucune"
                    }\n\n`;
                });

                if (results.count > results.results.length) {
                    response += `Il y a ${
                        results.count - results.results.length
                    } autres résultats. Vous pouvez affiner votre recherche pour des résultats plus précis.`;
                }

                span.update({
                    output: { count: results.count },
                    status: "success",
                });
                span.end();

                return response;
            }
        } catch (error) {
            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            return `Erreur lors de la recherche de clients: ${error.message}`;
        }
    },
    {
        name: "search_clients",
        description: "Recherche des clients dans la base de données",
        schema: z.object({
            search: z
                .string()
                .optional()
                .describe("Terme de recherche (nom, téléphone, etc.)"),
            page: z
                .number()
                .optional()
                .describe("Numéro de page pour la pagination"),
        }),
    }
);

export const getClientDetailsTool = tool(
    async ({ clientId }) => {
        const span = langfuse.span({
            name: "client_details_tool",
            input: { clientId },
        });

        console.log("Outil get_client_details appelé avec ID:", clientId);

        try {
            const client = await getClientDetails(clientId);

            const response = `Détails du client (ID: ${client.id}):\n
                - Nom: ${client.name}
                - Téléphone: ${client.phone_number || "Non renseigné"}
                - Numéro de chambre: ${client.room_number || "Non renseigné"}
                - Demandes spéciales: ${client.special_requests || "Aucune"}
            `;

            span.update({
                output: { clientName: client.name },
                status: "success",
            });
            span.end();

            return response;
        } catch (error) {
            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            if (error.response && error.response.status === 404) {
                return `Aucun client trouvé avec l'ID ${clientId}.`;
            }

            return `Erreur lors de la récupération des détails du client: ${error.message}`;
        }
    },
    {
        name: "get_client_details",
        description:
            "Récupère les informations détaillées d'un client spécifique",
        schema: z.object({
            clientId: z
                .number()
                .describe("ID du client dont on souhaite obtenir les détails"),
        }),
    }
);

export const createClientTool = tool(
    async ({ name, phone_number, room_number = "", special_requests = "" }) => {
        const span = langfuse.span({
            name: "client_create_tool",
            input: { name, phone_number, room_number, special_requests },
        });

        console.log("Outil create_client appelé avec:", {
            name,
            phone_number,
            room_number,
            special_requests,
        });

        try {
            if (phone_number) {
                console.log(
                    "Vérification de l'existence d'un client avec le numéro de téléphone:",
                    phone_number
                );

                const searchResults = await searchClients({
                    search: phone_number,
                });

                const existingClient = searchResults.results.find(
                    (client) => client.phone_number === phone_number
                );

                if (existingClient) {
                    console.log(
                        "Client existant trouvé avec ce numéro de téléphone:",
                        existingClient
                    );

                    const response = `Un client avec ce numéro de téléphone existe déjà:\n
                        - ID: ${existingClient.id}
                        - Nom: ${existingClient.name}
                        - Téléphone: ${existingClient.phone_number}
                        - Numéro de chambre: ${existingClient.room_number || "Non renseigné"}
                        - Demandes spéciales: ${existingClient.special_requests || "Aucune"}

                        Souhaitez-vous mettre à jour les informations de ce client plutôt que d'en créer un nouveau ?
                    `;

                    span.update({
                        output: { existingClientId: existingClient.id },
                        status: "success",
                    });
                    span.end();

                    return response;
                }
            }

            let finalRoomNumber = room_number;
            if (!room_number || room_number === "") {
                finalRoomNumber = Math.floor(Math.random() * 200) + 1;
                console.log(
                    `Attribution automatique de la chambre ${finalRoomNumber}`
                );
            }

            const clientData = {
                name,
                phone_number,
                room_number: finalRoomNumber,
                special_requests,
            };

            const newClient = await createClient(clientData);

            const response = `Client créé avec succès:\n
                - ID: ${newClient.id}
                - Nom: ${newClient.name}
                - Téléphone: ${newClient.phone_number || "Non renseigné"}
                - Numéro de chambre: ${newClient.room_number || "Non renseigné"}
                - Demandes spéciales: ${newClient.special_requests || "Aucune"}
            `;

            span.update({
                output: { clientId: newClient.id, clientName: newClient.name },
                status: "success",
            });
            span.end();

            return response;
        } catch (error) {
            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            return `Erreur lors de la création du client: ${error.message}`;
        }
    },
    {
        name: "create_client",
        description: "Crée un nouveau client dans la base de données",
        schema: z.object({
            name: z.string().describe("Nom complet du client"),
            phone_number: z.string().describe("Numéro de téléphone du client"),
            room_number: z
                .string()
                .optional()
                .describe("Numéro de chambre du client (optionnel)"),
            special_requests: z
                .string()
                .optional()
                .describe("Demandes spéciales du client (optionnel)"),
        }),
    }
);

export const updateClientTool = tool(
    async ({ clientId, name, phone_number, room_number, special_requests }) => {
        const span = langfuse.span({
            name: "client_update_tool",
            input: {
                clientId,
                name,
                phone_number,
                room_number,
                special_requests,
            },
        });

        console.log("Outil update_client appelé avec:", {
            clientId,
            name,
            phone_number,
            room_number,
            special_requests,
        });

        try {
            const currentClient = await getClientDetails(clientId);

            const clientData = {
                name: name || currentClient.name,
                phone_number: phone_number || currentClient.phone_number,
                room_number:
                    room_number !== undefined
                        ? room_number
                        : currentClient.room_number,
                special_requests:
                    special_requests !== undefined
                        ? special_requests
                        : currentClient.special_requests,
            };

            const updatedClient = await updateClient(clientId, clientData);

            const response = `Client mis à jour avec succès:\n
                - ID: ${updatedClient.id}
                - Nom: ${updatedClient.name}
                - Téléphone: ${updatedClient.phone_number || "Non renseigné"}
                - Numéro de chambre: ${updatedClient.room_number || "Non renseigné"}
                - Demandes spéciales: ${updatedClient.special_requests || "Aucune"}
            `;

            span.update({
                output: { clientName: updatedClient.name },
                status: "success",
            });
            span.end();

            return response;
        } catch (error) {
            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            if (error.response && error.response.status === 404) {
                return `Aucun client trouvé avec l'ID ${clientId}.`;
            }

            return `Erreur lors de la mise à jour du client: ${error.message}`;
        }
    },
    {
        name: "update_client",
        description: "Met à jour les informations d'un client existant",
        schema: z.object({
            clientId: z.number().describe("ID du client à mettre à jour"),
            name: z
                .string()
                .optional()
                .describe("Nouveau nom du client (optionnel)"),
            phone_number: z
                .string()
                .optional()
                .describe("Nouveau numéro de téléphone du client (optionnel)"),
            room_number: z
                .string()
                .optional()
                .describe("Nouveau numéro de chambre du client (optionnel)"),
            special_requests: z
                .string()
                .optional()
                .describe("Nouvelles demandes spéciales du client (optionnel)"),
        }),
    }
);

export const deleteClientTool = tool(
    async ({ clientId }) => {
        const span = langfuse.span({
            name: "client_delete_tool",
            input: { clientId },
        });

        console.log("Outil delete_client appelé avec ID:", clientId);

        try {
            const client = await getClientDetails(clientId);
            const clientName = client.name;

            await deleteClient(clientId);

            const response = `Le client "${clientName}" (ID: ${clientId}) a été supprimé avec succès.`;

            span.update({
                output: { clientName },
                status: "success",
            });
            span.end();

            return response;
        } catch (error) {
            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            if (error.response && error.response.status === 404) {
                return `Aucun client trouvé avec l'ID ${clientId}.`;
            }

            return `Erreur lors de la suppression du client: ${error.message}`;
        }
    },
    {
        name: "delete_client",
        description: "Supprime un client de la base de données",
        schema: z.object({
            clientId: z.number().describe("ID du client à supprimer"),
        }),
    }
);
