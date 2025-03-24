import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { querySpaAgent } from "../agents/spaAgent.js";
import { queryWeatherAgent } from "../agents/weatherAgent.js";
import { queryClientAgent } from "../agents/clientAgent.js";
import { queryReservationAgent } from "../agents/reservationAgent.js";

export const spaTool = tool(
    async ({ query }) => {
        console.log("Outil spa_agent appelé avec la requête:", query);

        try {
            const response = await querySpaAgent(query);
            return "RÉPONSE SPA OFFICIELLE: " + response;
        } catch (error) {
            console.error("Erreur lors de l'appel à l'agent spa:", error);
            return "RÉPONSE SPA OFFICIELLE: Désolé, je n'ai pas pu obtenir les informations sur le spa. Veuillez réessayer.";
        }
    },
    {
        name: "spa_agent",
        description:
            "Utilise cet outil pour toute demande concernant les spas, massages, soins bien-être ou services de beauté de l'hôtel.",
        schema: z.object({
            query: z
                .string()
                .describe(
                    "La requête de l'utilisateur concernant les spas ou services bien-être"
                ),
        }),
    }
);

export const weatherTool = tool(
    async ({ query }) => {
        console.log("Outil weather_agent appelé avec la requête:", query);

        try {
            const response = await queryWeatherAgent(query);
            return "RÉPONSE MÉTÉO OFFICIELLE: " + response;
        } catch (error) {
            console.error("Erreur lors de l'appel à l'agent météo:", error);
            return "RÉPONSE MÉTÉO OFFICIELLE: Désolé, je n'ai pas pu obtenir les informations météorologiques. Veuillez réessayer.";
        }
    },
    {
        name: "weather_agent",
        description:
            "Utilise cet outil pour toute demande concernant la météo, les prévisions ou les conditions climatiques.",
        schema: z.object({
            query: z
                .string()
                .describe("La requête de l'utilisateur concernant la météo"),
        }),
    }
);

export const clientTool = tool(
    async ({ query }) => {
        console.log("Outil client_agent appelé avec la requête:", query);

        try {
            const response = await queryClientAgent(query);
            return "RÉPONSE CLIENT OFFICIELLE: " + response;
        } catch (error) {
            console.error("Erreur lors de l'appel à l'agent client:", error);
            return "RÉPONSE CLIENT OFFICIELLE: Désolé, je n'ai pas pu obtenir les informations client. Veuillez réessayer.";
        }
    },
    {
        name: "client_agent",
        description:
            "Utilise cet outil pour toute demande concernant la gestion des clients (recherche, création, consultation, mise à jour, suppression) ou pour vérifier si quelqu'un est client.",
        schema: z.object({
            query: z
                .string()
                .describe("La requête de l'utilisateur concernant les clients"),
        }),
    }
);

export const reservationTool = tool(
    async ({ query }) => {
        console.log("Outil reservation_agent appelé avec la requête:", query);

        try {
            const response = await queryReservationAgent(query);
            return "RÉPONSE RÉSERVATION OFFICIELLE: " + response;
        } catch (error) {
            console.error(
                "Erreur lors de l'appel à l'agent de réservation:",
                error
            );
            return "RÉPONSE RÉSERVATION OFFICIELLE: Désolé, je n'ai pas pu traiter votre demande de réservation. Veuillez réessayer.";
        }
    },
    {
        name: "reservation_agent",
        description:
            "Utilise cet outil pour toute demande concernant les réservations de table au restaurant de l'hôtel.",
        schema: z.object({
            query: z
                .string()
                .describe(
                    "La requête de l'utilisateur concernant les réservations de restaurant"
                ),
        }),
    }
);
