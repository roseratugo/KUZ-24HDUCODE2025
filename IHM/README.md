# KUZ IHM - Interface Homme-Machine 🏨

## Description

KUZ IHM est l'interface utilisateur de notre système d'assistant hôtelier "Spookie California". Cette interface 3D immersive permet aux utilisateurs d'interagir avec un réceptionniste virtuel dans un environnement hôtelier.

## Fonctionnalités Principales

- 🎮 **Environnement 3D** : Modélisation complète de l'hôtel et du réceptionniste
- 🎭 **Animations** : Animations fluides du personnage (marche, conversation, repos)
- 🗣️ **Interaction Vocale** : Support audio pour une expérience immersive
- 🌙 **Ambiance** : Design inspiré du thème "Spookie California"
- 🔄 **Temps Réel** : Communication en direct avec le système d'agents

## Prérequis

- Node.js >= 18
- npm ou yarn
- Navigateur moderne avec support WebGL

## Installation

```bash
# Cloner le repository
git clone https://github.com/roseratugo/KUZ---24HDUCODE2025.git

# Installer les dépendances
cd IHM
npm install

# Lancer le serveur de développement
npm run dev
```

## Structure du Projet

```
IHM/
├── src/                    # Code source
│   ├── components/        # Composants Vue.js
│   ├── assets/           # Ressources statiques
│   ├── App.vue           # Composant principal
│   ├── main.js          # Point d'entrée
│   └── style.css        # Styles globaux
├── public/               # Fichiers publics
│   ├── models/          # Modèles 3D
│   │   ├── Hotel.fbx    # Modèle de l'hôtel
│   │   ├── Receptionnist.fbx # Modèle du réceptionniste
│   │   ├── Walking.fbx  # Animation de marche
│   │   ├── Talking.fbx  # Animation de conversation
│   │   └── Idle.fbx     # Animation d'attente
│   ├── voix/            # Fichiers audio
│   │   └── intro.wav    # Message d'introduction
│   └── vite.svg         # Logo Vite
└── package.json         # Dépendances et scripts
```

## Technologies Utilisées

- **Vue.js 3** : Framework frontend
- **Three.js** : Moteur de rendu 3D
- **Vite** : Outil de build

## Configuration

Le fichier `.env` permet de configurer :
```env
VITE_API_URL=http://localhost:3057/api    # URL de l'API des agents
VITE_SESSION_ID=session_123               # ID de session
```

## Lancement du projet

- `npm run dev` : Lance le serveur de développement