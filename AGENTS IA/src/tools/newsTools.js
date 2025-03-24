import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { langfuse } from "../utils/config.js";

/**
 * Récupère les actualités depuis le flux RSS de la ville du Mans
 * @returns {Promise<Array>} - Liste des actualités
 */
async function fetchNews() {
    const span = langfuse.span({
        name: "fetch_news_rss",
        input: { url: "https://www.lemans.fr/?type=9818" },
    });

    try {
        console.log(
            "Récupération des actualités depuis le flux RSS de la ville du Mans"
        );

        const response = await axios.get("https://www.lemans.fr/?type=9818");
        const xmlData = response.data;

        const result = await parseStringPromise(xmlData, {
            explicitArray: false,
        });

        let newsItems = [];

        if (result.rss && result.rss.channel && result.rss.channel.item) {
            const items = Array.isArray(result.rss.channel.item)
                ? result.rss.channel.item
                : [result.rss.channel.item];

            newsItems = items.map((item) => ({
                title: item.title || "Titre non disponible",
                link: item.link || "",
                description: item.description || "Description non disponible",
                pubDate: item.pubDate || "Date non disponible",
                category: item.category || "Catégorie non disponible",
            }));
        }

        span.update({
            output: { count: newsItems.length },
            status: "success",
        });
        span.end();

        return newsItems;
    } catch (error) {
        console.error("Erreur lors de la récupération des actualités:", error);

        span.update({
            status: "error",
            error: error.message,
        });
        span.end();

        return [];
    }
}

/**
 * Nettoie le HTML d'une chaîne de texte
 * @param {string} html - Texte HTML à nettoyer
 * @returns {string} - Texte nettoyé
 */
function stripHtml(html) {
    if (!html) return "";
    let text = html.replace(/<[^>]*>/g, " ");
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, " ").trim();
    return text;
}

export const getNewsListTool = tool(
    async () => {
        const span = langfuse.span({
            name: "news_list_tool",
        });

        try {
            const newsItems = await fetchNews();

            if (newsItems.length === 0) {
                span.update({
                    status: "error",
                    error: "Aucune actualité trouvée",
                });
                span.end();

                return "Désolé, je n'ai pas pu récupérer les actualités récentes de la ville du Mans.";
            }

            let response =
                "Voici les actualités récentes de la ville du Mans:\n\n";

            newsItems.slice(0, 10).forEach((item, index) => {
                let pubDate = item.pubDate;
                try {
                    const date = new Date(item.pubDate);
                    pubDate = date.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    });
                } catch (e) {
                    
                }

                response += `${index + 1}. ${item.title} (${pubDate})\n`;
            });

            span.update({
                output: { newsCount: newsItems.length },
                status: "success",
            });
            span.end();

            return response;
        } catch (error) {
            console.error(
                "Erreur lors de l'utilisation de l'outil d'actualités:",
                error
            );

            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            return "Désolé, une erreur est survenue lors de la récupération des actualités de la ville du Mans.";
        }
    },
    {
        name: "get_news_list",
        description:
            "Obtient la liste des actualités récentes de la ville du Mans",
        schema: z.object({}),
    }
);

export const getRandomNewsTool = tool(
    async () => {
        const span = langfuse.span({
            name: "random_news_tool",
        });

        try {
            const newsItems = await fetchNews();

            if (newsItems.length === 0) {
                span.update({
                    status: "error",
                    error: "Aucune actualité trouvée",
                });
                span.end();

                return "Désolé, je n'ai pas pu récupérer d'actualité de la ville du Mans.";
            }

            const randomIndex = Math.floor(
                Math.random() * Math.min(newsItems.length, 10)
            );
            const randomNews = newsItems[randomIndex];

            let pubDate = randomNews.pubDate;
            try {
                const date = new Date(randomNews.pubDate);
                pubDate = date.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                });
            } catch (e) {
                
            }

            const cleanDescription = stripHtml(randomNews.description);

            const response = `Actualité du ${pubDate}: "${randomNews.title}"\n\n${cleanDescription}`;

            span.update({
                output: { newsTitle: randomNews.title },
                status: "success",
            });
            span.end();

            return response;
        } catch (error) {
            console.error(
                "Erreur lors de l'utilisation de l'outil d'actualité aléatoire:",
                error
            );

            span.update({
                status: "error",
                error: error.message,
            });
            span.end();

            return "Désolé, une erreur est survenue lors de la récupération d'une actualité aléatoire de la ville du Mans.";
        }
    },
    {
        name: "get_random_news",
        description: "Obtient une actualité aléatoire de la ville du Mans",
        schema: z.object({}),
    }
);
