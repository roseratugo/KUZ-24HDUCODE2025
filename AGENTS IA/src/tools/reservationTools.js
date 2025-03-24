import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
    API_RESERVATION_ENDPOINT,
    API_RESERVATION_TOKEN,
    langfuse,
} from "../utils/config.js";

/**
 * Crée une nouvelle réservation de restaurant
 * @param {Object} reservationData - Données de la réservation à créer
 * @returns {Promise<Object>} - Réservation créée
 */
async function createReservation(reservationData) {
    const span = langfuse.span({
        name: "reservation_api_create",
        input: reservationData,
    });

    console.log("Création d'une nouvelle réservation:", reservationData);

    try {
        const response = await axios.post(
            API_RESERVATION_ENDPOINT,
            reservationData,
            {
                headers: {
                    Authorization: `Token ${API_RESERVATION_TOKEN}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            }
        );

        console.log("Réservation créée avec succès:", response.data);

        span.update({
            output: {
                reservationId: response.data.id,
                clientId: response.data.client,
                restaurantId: response.data.restaurant,
                date: response.data.date,
            },
            status: "success",
        });
        span.end();

        return response.data;
    } catch (error) {
        console.error(
            "Erreur lors de la création de la réservation:",
            error.message
        );
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
 * Convertit une date en langage naturel en format YYYY-MM-DD
 * @param {string} dateString - Date en langage naturel (aujourd'hui, demain, etc.)
 * @returns {string} - Date au format YYYY-MM-DD
 */
function parseDate(dateString) {
    const today = new Date();
    let resultDate = today;

    const normalizedDate = dateString
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (normalizedDate === "aujourd'hui" || normalizedDate === "aujourdhui") {
        resultDate = today;
    } else if (normalizedDate === "demain") {
        resultDate = new Date(today);
        resultDate.setDate(today.getDate() + 1);
    } else if (
        normalizedDate === "apres-demain" ||
        normalizedDate === "apres demain" ||
        normalizedDate === "après-demain" ||
        normalizedDate === "après demain"
    ) {
        resultDate = new Date(today);
        resultDate.setDate(today.getDate() + 2);
    } else if (normalizedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
    } else {
        try {
            const parsedDate = new Date(dateString);
            if (!isNaN(parsedDate.getTime())) {
                resultDate = parsedDate;
            }
        } catch (error) {
            console.error("Erreur lors du parsing de la date:", error);
            return dateString;
        }
    }

    return resultDate.toISOString().split("T")[0];
}

export const createReservationTool = tool(
    async ({
        client,
        restaurant,
        date,
        meal,
        number_of_guests,
        special_requests = "",
    }) => {
        const span = langfuse.span({
            name: "reservation_create_tool",
            input: {
                client,
                restaurant,
                date,
                meal,
                number_of_guests,
                special_requests,
            },
        });

        console.log("Outil create_reservation appelé avec:", {
            client,
            restaurant,
            date,
            meal,
            number_of_guests,
            special_requests,
        });

        try {
            const formattedDate = parseDate(date);

            const reservationData = {
                client,
                restaurant,
                date: formattedDate,
                meal,
                number_of_guests,
                special_requests,
            };

            const newReservation = await createReservation(reservationData);

            const response = `Réservation créée avec succès:\n
                - ID: ${newReservation.id}
                - Client: ${newReservation.client}
                - Restaurant: ${getRestaurantName(newReservation.restaurant)}
                - Date: ${newReservation.date}
                - Repas: ${getMealName(newReservation.meal)}
                - Nombre de convives: ${newReservation.number_of_guests}
                - Demandes spéciales: ${newReservation.special_requests || "Aucune"}
            `;

            span.update({
                output: { reservationId: newReservation.id },
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

            return `Erreur lors de la création de la réservation: ${error.message}`;
        }
    },
    {
        name: "create_reservation",
        description:
            "Crée une nouvelle réservation de restaurant. Toutes les informations requises doivent être fournies.",
        schema: z.object({
            client: z
                .number()
                .describe(
                    "ID du client effectuant la réservation (obligatoire)"
                ),
            restaurant: z
                .number()
                .describe("ID du restaurant (19, 20 ou 21) (obligatoire)"),
            date: z
                .string()
                .describe(
                    "Date de la réservation. Peut être spécifiée en langage naturel (aujourd'hui, demain, etc.) ou au format YYYY-MM-DD (obligatoire)"
                ),
            meal: z
                .number()
                .describe(
                    "Type de repas: 19 (Petit-déjeuner), 20 (Déjeuner), ou 21 (Dîner) (obligatoire)"
                ),
            number_of_guests: z
                .number()
                .describe("Nombre de convives (obligatoire)"),
            special_requests: z
                .string()
                .optional()
                .describe(
                    "Demandes spéciales pour la réservation (allergies, préférences, etc.) (optionnel)"
                ),
        }),
    }
);

/**
 * Obtient le nom du repas en fonction de son ID
 * @param {number} mealId - ID du repas
 * @returns {string} - Nom du repas
 */
const getMealName = (mealId) => {
    switch (parseInt(mealId)) {
        case 19:
            return "Petit-déjeuner (Breakfast)";
        case 20:
            return "Déjeuner (Lunch)";
        case 21:
            return "Dîner (Dinner)";
        default:
            return "Repas inconnu";
    }
};

/**
 * Obtient le nom du restaurant en fonction de son ID
 * @param {number} restaurantId - ID du restaurant
 * @returns {string} - Nom du restaurant
 */
const getRestaurantName = (restaurantId) => {
    switch (parseInt(restaurantId)) {
        case 19:
            return "Le Maison Royale (Restaurant gastronomique français)";
        case 20:
            return "Bistrot de la piscine (Cuisine méditerranéenne)";
        case 21:
            return "Le Belvedere (Restaurant panoramique)";
        default:
            return "Restaurant inconnu";
    }
};

/**
 * Récupère les réservations d'un client
 * @param {number} clientId - ID du client
 * @returns {Promise<Array>} - Liste des réservations du client
 */
async function getClientReservations(clientId) {
    const span = langfuse.span({
        name: "reservation_api_get_client",
        input: { clientId },
    });

    console.log(`Récupération des réservations du client ID: ${clientId}`);

    try {
        const response = await axios.get(API_RESERVATION_ENDPOINT, {
            headers: {
                Authorization: `Token ${API_RESERVATION_TOKEN}`,
                Accept: "application/json",
            },
            params: { client: clientId },
        });

        console.log("Réservations du client récupérées avec succès");

        span.update({
            output: { count: response.data.count },
            status: "success",
        });
        span.end();

        return response.data;
    } catch (error) {
        console.error(
            `Erreur lors de la récupération des réservations du client ${clientId}:`,
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

export const getClientReservationsTool = tool(
    async ({ clientId }) => {
        const span = langfuse.span({
            name: "client_reservations_tool",
            input: { clientId },
        });

        console.log("Outil get_client_reservations appelé avec ID:", clientId);

        try {
            const results = await getClientReservations(clientId);

            if (results.count === 0) {
                const response = `Aucune réservation trouvée pour le client avec l'ID ${clientId}.`;

                span.update({
                    output: { count: 0 },
                    status: "success",
                });
                span.end();

                return response;
            } else {
                let response = `J'ai trouvé ${results.count} réservation(s) pour le client avec l'ID ${clientId}:\n\n`;

                results.results.forEach((reservation, index) => {
                    response += `Réservation #${index + 1}:\n`;
                    response += `- ID: ${reservation.id}\n`;
                    response += `- Restaurant: ${getRestaurantName(
                        reservation.restaurant
                    )}\n`;
                    response += `- Date: ${reservation.date}\n`;
                    response += `- Repas: ${getMealName(reservation.meal)}\n`;
                    response += `- Nombre de convives: ${reservation.number_of_guests}\n`;
                    response += `- Demandes spéciales: ${
                        reservation.special_requests || "Aucune"
                    }\n\n`;
                });

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

            return `Erreur lors de la récupération des réservations: ${error.message}`;
        }
    },
    {
        name: "get_client_reservations",
        description: "Récupère les réservations d'un client spécifique",
        schema: z.object({
            clientId: z
                .number()
                .describe(
                    "ID du client dont on souhaite obtenir les réservations"
                ),
        }),
    }
);

export const reservationTools = [
    createReservationTool,
    getClientReservationsTool,
];
