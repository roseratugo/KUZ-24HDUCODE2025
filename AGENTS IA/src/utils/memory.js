import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export class ConversationState {
  constructor() {
    this.messages = [];
    this.summary = "";
  }
}

/**
 * Ajoute un message système à l'état
 * @param {ConversationState} state - État de la conversation
 * @param {string} content - Contenu du message système
 * @returns {ConversationState} - État mis à jour
 */
export function addSystemMessage(state, content) {
  return {
    ...state,
    messages: [...state.messages, new SystemMessage(content)]
  };
}

/**
 * Ajoute un message humain à l'état
 * @param {ConversationState} state - État de la conversation
 * @param {string} content - Contenu du message humain
 * @returns {ConversationState} - État mis à jour
 */
export function addHumanMessage(state, content) {
  return {
    ...state,
    messages: [...state.messages, new HumanMessage(content)]
  };
}

/**
 * Ajoute un message IA à l'état
 * @param {ConversationState} state - État de la conversation
 * @param {string} content - Contenu du message IA
 * @returns {ConversationState} - État mis à jour
 */
export function addAIMessage(state, content) {
  return {
    ...state,
    messages: [...state.messages, new AIMessage(content)]
  };
}

/**
 * Fonction pour gérer les messages longs
 * @param {Array} messages - Liste des messages
 * @param {number} maxMessages - Nombre maximum de messages à conserver
 * @returns {Array} - Liste de messages tronquée
 */
export function manageConversationLength(messages, maxMessages = 10) {
  if (messages.length <= maxMessages) {
    return messages;
  }
  
  return [
    messages[0],
    ...messages.slice(-(maxMessages - 1))
  ];
}

const sessionStates = new Map();

/**
 * Récupère ou crée un état de conversation pour une session donnée
 * @param {string} sessionId - Identifiant de session client
 * @returns {ConversationState} - État de conversation
 */
export function getSessionState(sessionId = "default") {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, new ConversationState());
  }
  return sessionStates.get(sessionId);
}

/**
 * Met à jour l'état d'une session
 * @param {string} sessionId - Identifiant de session client
 * @param {ConversationState} state - Nouvel état
 */
export function updateSessionState(sessionId, state) {
  sessionStates.set(sessionId, state);
} 