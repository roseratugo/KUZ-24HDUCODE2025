import express from "express";
import cors from "cors";
import { processUserInput } from "./agents/mainAgent.js";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = process.env.PORT || 3067;

app.use(express.json());
app.use(cors());

const activeSessions = new Map();

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "API de l'assistant de réception d'hôtel opérationnelle",
    });
});

app.post("/api/sessions", (req, res) => {
    const sessionId = uuidv4();
    activeSessions.set(sessionId, { createdAt: new Date() });

    console.log(`Nouvelle session créée: ${sessionId}`);
    res.json({ sessionId });
});

app.post("/api/chat", async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!sessionId || !message) {
            return res
                .status(400)
                .json({ error: "sessionId et message sont requis" });
        }

        if (!activeSessions.has(sessionId)) {
            console.log(`Session inconnue: ${sessionId}`);
            return res
                .status(404)
                .json({ error: "Session inconnue ou expirée" });
        }

        console.log(`Message reçu de la session ${sessionId}: ${message}`);

        const response = await processUserInput(message, sessionId);

        activeSessions.set(sessionId, {
            ...activeSessions.get(sessionId),
            lastActivity: new Date(),
        });

        res.json({ response });
    } catch (error) {
        console.error("Erreur lors du traitement de la demande:", error);
        res.status(500).json({
            error: "Erreur lors du traitement de la demande",
        });
    }
});

app.get("/api/sessions/:sessionId", (req, res) => {
    const { sessionId } = req.params;

    if (!activeSessions.has(sessionId)) {
        return res.status(404).json({ error: "Session inconnue ou expirée" });
    }

    res.json(activeSessions.get(sessionId));
});

function cleanupSessions() {
    const now = new Date();
    const expirationTime = 3600000;

    activeSessions.forEach((session, id) => {
        const lastActivity = session.lastActivity || session.createdAt;
        if (now - lastActivity > expirationTime) {
            console.log(`Nettoyage de la session inactive: ${id}`);
            activeSessions.delete(id);
        }
    });
}

setInterval(cleanupSessions, 3600000);

export function startApiServer() {
    app.listen(PORT, () => {
        console.log(`Serveur API démarré sur le port ${PORT}`);
    });
}

export default app;
