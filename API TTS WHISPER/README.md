# API TTS et Whisper

Cette API fournit des services de conversion texte-parole (TTS) et de transcription audio en utilisant les modèles Kokoro et Whisper.

## Fonctionnalités

- **TTS (Text-to-Speech)** : Conversion de texte en audio
- **Whisper** : Transcription d'audio en texte

## Prérequis

- Python 3.x
- FastAPI
- soundfile
- kokoro
- faster-whisper

## Installation

1. Clonez le dépôt
2. Installez les dépendances :
```bash
pip install -r requirements.txt
```

## Utilisation

### Démarrage du serveur

```bash
uvicorn server:app --reload
```

Le serveur sera accessible à l'adresse : `http://localhost:8000`

### Endpoints

#### 1. TTS (Text-to-Speech)

- **URL** : `/tts`
- **Méthode** : GET
- **Paramètres** : 
  - `text` : Le texte à convertir en audio
- **Retour** : Fichier audio WAV

Exemple de requête :
```
GET http://localhost:8000/tts?text=Bonjour le monde
```

#### 2. Whisper (Transcription)

- **URL** : `/whisper`
- **Méthode** : POST
- **Paramètres** : 
  - `file` : Fichier audio à transcrire (format WAV)
- **Retour** : Transcription en texte

Exemple de requête avec curl :
```bash
curl -X POST -F "file=@audio.wav" http://localhost:8000/whisper
```

## Configuration

- Le modèle TTS utilise la voix 'am_michael'
- Le modèle Whisper utilisé est 'large-v2'
- Le taux d'échantillonnage audio est de 24000 Hz