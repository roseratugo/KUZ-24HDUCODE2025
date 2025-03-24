import readline from 'readline';
import { processUserInput } from './agents/mainAgent.js';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { startApiServer } from './api.js';

const logFile = path.join(process.cwd(), 'app-debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function logToFile(message) {
  const formatted = util.format(message);
  logStream.write(`${new Date().toISOString()} [LOG] ${formatted}\n`);
}

console.log = function(...args) {
  const formatted = util.format(...args);
  logStream.write(`${new Date().toISOString()} [LOG] ${formatted}\n`);
  
  if (!formatted.includes('Outil') && 
      !formatted.includes('Agent SPA') && 
      !formatted.includes('Traitement de la demande') && 
      !formatted.includes('Invocation de l\'agent') &&
      !formatted.includes('Réponse de l\'agent') &&
      !formatted.includes('Actions:') &&
      !formatted.includes('Logs:') &&
      !formatted.includes('Contenu du dernier message') &&
      !formatted.includes('Détection d\'une réponse') &&
      !formatted.includes('Recherche de spas') &&
      !formatted.includes('Appel') &&
      !formatted.includes('Response API')) {
    originalConsoleLog.apply(console, args);
  }
};

console.error = function(...args) {
  const formatted = util.format(...args);
  logStream.write(`${new Date().toISOString()} [ERROR] ${formatted}\n`);
  originalConsoleError.apply(console, args);
};

fs.writeFileSync(logFile, `${new Date().toISOString()} [INFO] === Démarrage de l'application ===\n`);

function startCli() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const sessionId = 'cli-session-1';

  console.log("=== Assistant Réception d'Hôtel ===");
  console.log("Bonjour ! Je suis votre assistant virtuel de réception d'hôtel.");
  console.log("Comment puis-je vous aider aujourd'hui ?");
  console.log("(tapez 'exit' pour quitter)\n");

  function askQuestion() {
    rl.question('> ', async (userInput) => {
      if (userInput.toLowerCase() === 'exit') {
        console.log("Merci d'avoir utilisé notre service. Au revoir !");
        rl.close();
        return;
      }
      
      try {
        originalConsoleLog("\nTraitement de votre demande...");
        const response = await processUserInput(userInput, sessionId);
        
        if (!response || response.trim().length < 10) {
          originalConsoleLog("\n❌ ERREUR: La réponse générée est vide ou trop courte. Réessai...");
          const enhancedInput = `Je souhaite des informations détaillées sur: ${userInput}`;
          const retryResponse = await processUserInput(enhancedInput, sessionId);
          
          if (retryResponse && retryResponse.trim().length > 10) {
            displayAssistantResponse(retryResponse);
          } else {
            originalConsoleLog("\n❌ ERREUR: Impossible de générer une réponse appropriée. Veuillez reformuler votre question.");
          }
        } else {
          displayAssistantResponse(response);
        }
      } catch (error) {
        console.error("Une erreur est survenue:", error);
        originalConsoleLog("\n❌ ERREUR: Désolé, une erreur technique est survenue. Veuillez réessayer.\n");
      }
      
      askQuestion();
    });
  }

  function displayAssistantResponse(response) {
    console.log("\n┌───────────────────────── RÉPONSE DE L'ASSISTANT ─────────────────────────┐");
    console.log("│                                                                           │");
    
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.length <= 75) {
        console.log(`│ ${line.padEnd(75)} │`);
      } else {
        for (let i = 0; i < line.length; i += 75) {
          const subLine = line.substring(i, i + 75);
          console.log(`│ ${subLine.padEnd(75)} │`);
        }
      }
    }
    
    console.log("│                                                                           │");
    console.log("└───────────────────────────────────────────────────────────────────────────┘");
  }

  askQuestion();
}

const args = process.argv.slice(2);
const startMode = args[0] || 'both';

if (startMode === 'api' || startMode === 'both') {
  startApiServer();
}

if (startMode === 'cli' || startMode === 'both') {
  startCli();
} else {
  console.log("Mode API uniquement. L'interface CLI n'est pas démarrée.");
  console.log("Pour démarrer l'interface CLI, utilisez: npm start cli");
}

process.on('SIGINT', () => {
  console.log("\nFermeture de l'application...");
  logStream.end();
  process.exit(0);
}); 