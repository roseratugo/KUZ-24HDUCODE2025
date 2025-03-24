# KUZ AgentsIA - Assistant de Réception d'Hôtel 🏨

## Description

KUZ AgentsIA est un système multi-agents intelligent conçu pour automatiser et optimiser les tâches de réception d'hôtel. Le système utilise plusieurs agents spécialisés qui collaborent pour fournir une assistance complète aux clients et au personnel de l'hôtel.

## Fonctionnalités Principales

- 🤖 **Agent Principal** : Coordonne tous les autres agents et gère le flux de conversation
- 🛎️ **Agent de Réservation** : Gère les réservations et la disponibilité des chambres
- 👥 **Agent Client** : S'occupe des demandes et des informations clients
- 🌤️ **Agent Météo** : Fournit des informations météorologiques
- 📰 **Agent Actualités** : Partage les actualités locales et les événements
- 💆 **Agent Spa** : Gère les réservations et services du spa

## Prérequis

- Node.js >= 18
- npm ou yarn
- Clés API requises (voir Configuration)

## Installation

```bash
# Cloner le repository
git clone https://github.com/roseratugo/KUZ---24HDUCODE2025.git

# Installer les dépendances
cd AGENTS\ IA
npm install
```

## Configuration

1. Copier le fichier `.env.example` en `.env`:
```bash
cp .env.example .env
```

2. Configurer les variables d'environnement dans `.env`:
```env
# Clé API Mistral AI
MISTRAL_API_KEY=votre_cle_mistral

# Clés Langfuse pour le monitoring
LANGFUSE_PUBLIC_KEY=votre_cle_publique
LANGFUSE_SECRET_KEY=votre_cle_secrete

# Endpoints API
API_SPA_ENDPOINT=url_api_spa
API_SPA_TOKEN=token_spa
API_CLIENT_ENDPOINT=url_api_client
API_CLIENT_TOKEN=token_client

# Clé API OpenWeatherMap
OPENWEATHER_API_KEY=votre_cle_openweather
```

## Utilisation

Le système peut être démarré de trois façons différentes :

### 1. Mode Complet (API + CLI)
```bash
npm start
```

### 2. Mode API uniquement
```bash
npm run start:api
```

### 3. Mode CLI uniquement
```bash
npm run start:cli
```

### Mode Développement
```bash
npm run dev
```

## Architecture du Projet

```
src/
├── agents/              # Agents spécialisés
│   ├── mainAgent.js    # Agent principal de coordination
│   ├── clientAgent.js  # Gestion des clients
│   ├── newsAgent.js    # Actualités
│   ├── reservationAgent.js # Réservations
│   ├── spaAgent.js     # Services spa
│   └── weatherAgent.js # Météo
├── tools/              # Outils utilisés par les agents
├── utils/             # Utilitaires et configurations
├── api.js            # Serveur API Express
└── index.js          # Point d'entrée de l'application
```

## API Endpoints

- `GET /api/health` : Vérification de l'état de l'API
- `POST /api/sessions` : Création d'une nouvelle session
- `POST /api/chat` : Envoi d'un message à l'assistant
- `GET /api/sessions/:sessionId` : Récupération des informations d'une session

## Monitoring et Traçage

Le système utilise Langfuse pour le monitoring et le traçage des interactions. Les métriques et logs sont accessibles via le dashboard Langfuse.
