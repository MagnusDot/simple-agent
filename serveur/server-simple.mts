#!/usr/bin/env node

// Windows compatibility: Force UTF-8 encoding for proper emoji display
if (process.platform === 'win32') {
  process.stdout.setEncoding('utf8');
  process.stderr.setEncoding('utf8');
}

import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
interface AgentConfig {
  id: string;
  name: string;
  description: string;
}

interface UserInput {
  message: string;
  thread_id?: string;
  conversation_id?: string;
  chat_id?: string;
  context?: any;
  details?: any;
}

interface AgentResponse {
  content: string;
  thread_id: string;
  run_id: string;
}

interface ChatMessage {
  type: 'human' | 'ai' | 'tool';
  content: string;
  timestamp: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface ConversationState {
  thread_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// Configuration
const API_VERSION = "1.0.0";
const API_TITLE = "Agent CLI Server";
const API_DESCRIPTION = "Serveur Express.js pour le CLI des agents IA";
const PORT = process.env.PORT || 8080;

// In-memory storage (replace with real database in production)
const conversations: Map<string, ConversationState> = new Map();
const activeGenerations: Map<string, boolean> = new Map();

// Registre des agents - À remplir avec vos vrais agents
const AVAILABLE_AGENTS: AgentConfig[] = [
  {
    id: 'myges',
    name: 'myges Agent',
    description: 'Agent spécialisé dans myges'
  },
  // Ajoutez vos autres agents ici...
];

// Load agents configuration
async function loadAgentsConfig(): Promise<AgentConfig[]> {
  try {
    console.log(`✅ ${AVAILABLE_AGENTS.length} agent(s) disponible(s):`, AVAILABLE_AGENTS.map(a => a.id).join(', '));
    return AVAILABLE_AGENTS;
  } catch (error) {
    console.warn('⚠️ Erreur lors du chargement des agents:', error);
    return [];
  }
}

// Middleware d'authentification
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token && process.env.REQUIRE_AUTH !== 'false') {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  // Store token in request for later use
  (req as any).token = token;
  next();
}

// Middleware de gestion des erreurs
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Erreur serveur:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: err.message,
    path: req.path
  });
}

// Utilitaires pour les conversations
function getOrCreateConversation(threadId: string): ConversationState {
  if (!conversations.has(threadId)) {
    const now = new Date().toISOString();
    conversations.set(threadId, {
      thread_id: threadId,
      messages: [],
      created_at: now,
      updated_at: now
    });
  }
  return conversations.get(threadId)!;
}

function addMessageToConversation(threadId: string, message: ChatMessage) {
  const conversation = getOrCreateConversation(threadId);
  conversation.messages.push(message);
  conversation.updated_at = new Date().toISOString();
}

// Interface pour les agents - À implémenter avec vos vrais agents
interface IAgent {
  id: string;
  invoke(message: string, threadId: string): Promise<string>;
  stream(message: string, threadId: string): AsyncGenerator<string, void, unknown>;
}

// MockAgent - À remplacer par vos vrais agents
class MockAgent implements IAgent {
  constructor(public id: string) {}

  async invoke(message: string, threadId: string): Promise<string> {
    const parts: string[] = [];
    for await (const part of this.stream(message, threadId)) {
      parts.push(part);
    }
    return parts.join('');
  }

  async *stream(message: string, threadId: string): AsyncGenerator<string, void, unknown> {
    // Simulation d'une réponse d'agent avec délais réalistes
    const responses = [
      `Bonjour ! Je suis l'agent ${this.id}. `,
      "Je traite votre demande... ",
      "Voici ma réponse : ",
      `L'agent ${this.id} a traité votre message "${message}". `,
      "Y a-t-il autre chose que je puisse faire pour vous ?"
    ];

    for (const response of responses) {
      // Vérifier si la génération a été arrêtée
      if (activeGenerations.get(threadId) === false) {
        yield "\n\n[Génération interrompue]";
        return;
      }

      yield response;
      // Délai réaliste entre les tokens
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    }
  }
}

// Factory pour créer les agents - À modifier pour utiliser vos vrais agents
function createAgent(agentId: string): IAgent {
  // TODO: Remplacer par le chargement de vos vrais agents depuis le registre
  // Exemple:
  // if (agentId === 'myges') {
  //   return new mygesAgent(); // Votre vrai agent
  // }
  
  console.log(`⚠️  Utilisation du MockAgent pour ${agentId}. Pour utiliser les vrais agents, utilisez server.mts à la place.`);
  return new MockAgent(agentId);
}

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.text());

// Routes
app.get('/health', async (req: Request, res: Response) => {
  try {
    const agents = await loadAgentsConfig();
    res.json({
      status: 'ok',
      version: API_VERSION,
      title: API_TITLE,
      description: API_DESCRIPTION,
      timestamp: new Date().toISOString(),
      agents_count: agents.length,
      available_agents: agents.map(a => a.id),
      components: {
        api: 'healthy',
        agents: 'healthy',
        database: 'healthy' // Simulé
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la vérification de santé'
    });
  }
});

app.get('/agents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const agents = await loadAgentsConfig();
    res.json(agents);
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
    res.status(500).json({
      error: 'Erreur lors du chargement des agents',
      message: (error as Error).message
    });
  }
});

app.post('/:agentId/invoke', authenticateToken, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const userInput: UserInput = req.body;
  
  try {
    console.log(`🤖 Invocation de l'agent ${agentId} pour le thread ${userInput.thread_id || 'nouveau'}`);
    
    const threadId = userInput.thread_id || uuidv4();
    const runId = uuidv4();
    
    // Vérifier que l'agent existe
    const agents = await loadAgentsConfig();
    const agentConfig = agents.find(a => a.id === agentId);
    if (!agentConfig) {
      return res.status(404).json({
        error: 'Agent non trouvé',
        message: `L'agent '${agentId}' n'existe pas. Agents disponibles: ${agents.map(a => a.id).join(', ')}`
      });
    }

    // Créer l'agent
    const agent = createAgent(agentId);

    // Ajouter le message utilisateur à la conversation
    addMessageToConversation(threadId, {
      type: 'human',
      content: userInput.message,
      timestamp: new Date().toISOString()
    });

    // Invoquer l'agent
    const response = await agent.invoke(userInput.message, threadId);

    // Ajouter la réponse de l'agent à la conversation
    addMessageToConversation(threadId, {
      type: 'ai',
      content: response,
      timestamp: new Date().toISOString()
    });

    const agentResponse: AgentResponse = {
      content: response,
      thread_id: threadId,
      run_id: runId
    };

    res.json(agentResponse);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'invocation:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'invocation de l\'agent',
      message: (error as Error).message
    });
  }
});

app.post('/:agentId/stream', authenticateToken, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const userInput: UserInput = req.body;
  
  try {
    console.log(`🌊 Streaming avec l'agent ${agentId} pour le thread ${userInput.thread_id || 'nouveau'}`);
    
    const threadId = userInput.thread_id || uuidv4();
    const runId = uuidv4();
    
    // Vérifier que l'agent existe
    const agents = await loadAgentsConfig();
    const agentConfig = agents.find(a => a.id === agentId);
    if (!agentConfig) {
      return res.status(404).json({
        error: 'Agent non trouvé',
        message: `L'agent '${agentId}' n'existe pas. Agents disponibles: ${agents.map(a => a.id).join(', ')}`
      });
    }

    // Créer l'agent
    const agent = createAgent(agentId);

    // Configuration SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Marquer la génération comme active
    activeGenerations.set(threadId, true);

    // Fonction pour envoyer des événements SSE
    const sendSSE = (event: string, data?: any) => {
      res.write(`event: ${event}\n`);
      if (data !== undefined) {
        res.write(`data: ${JSON.stringify(data)}\n`);
      }
      res.write('\n');
    };

    // Ajouter le message utilisateur à la conversation
    addMessageToConversation(threadId, {
      type: 'human',
      content: userInput.message,
      timestamp: new Date().toISOString()
    });

    // Commencer le streaming
    sendSSE('stream_start');

    try {
      let fullResponse = '';

      // Stream l'agent
      for await (const token of agent.stream(userInput.message, threadId)) {
        if (!activeGenerations.get(threadId)) {
          break; // Génération arrêtée
        }
        
        fullResponse += token;
        sendSSE('stream_token', { token });
      }

      // Ajouter la réponse complète à la conversation
      if (fullResponse) {
        addMessageToConversation(threadId, {
          type: 'ai',
          content: fullResponse,
          timestamp: new Date().toISOString()
        });
      }

      // Terminer le streaming
      sendSSE('stream_end', { thread_id: threadId });
      
    } catch (error) {
      console.error('❌ Erreur pendant le streaming:', error);
      sendSSE('error', (error as Error).message);
    } finally {
      // Nettoyer
      activeGenerations.delete(threadId);
      res.end();
    }

    // Gérer la déconnexion du client
    req.on('close', () => {
      console.log(`🔌 Client déconnecté pour le thread ${threadId}`);
      activeGenerations.set(threadId, false);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du streaming:', error);
    res.status(500).json({
      error: 'Erreur lors du streaming avec l\'agent',
      message: (error as Error).message
    });
  }
});

app.post('/:agentId/stop', authenticateToken, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { thread_id } = req.body;
  
  try {
    console.log(`🛑 Arrêt de la génération pour l'agent ${agentId}, thread ${thread_id}`);
    
    if (thread_id && activeGenerations.has(thread_id)) {
      activeGenerations.set(thread_id, false);
      setTimeout(() => activeGenerations.delete(thread_id), 1000);
      
      res.json({
        status: 'success',
        message: 'Génération arrêtée avec succès'
      });
    } else {
      res.json({
        status: 'success',
        message: 'Aucune génération active à arrêter'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'arrêt de la génération',
      message: (error as Error).message
    });
  }
});

// Route pour obtenir l'historique d'une conversation
app.get('/conversations/:threadId', authenticateToken, async (req: Request, res: Response) => {
  const { threadId } = req.params;
  
  try {
    const conversation = conversations.get(threadId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation non trouvée',
        message: `Aucune conversation trouvée pour le thread ${threadId}`
      });
    }
    
    res.json(conversation);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la conversation:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de la conversation',
      message: (error as Error).message
    });
  }
});

// Route pour lister toutes les conversations
app.get('/conversations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conversationList = Array.from(conversations.values()).map(conv => ({
      thread_id: conv.thread_id,
      message_count: conv.messages.length,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message: conv.messages[conv.messages.length - 1]?.content.slice(0, 100) || 'Aucun message'
    }));
    
    res.json(conversationList);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des conversations:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des conversations',
      message: (error as Error).message
    });
  }
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Gérer les routes non trouvées
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.path} n'existe pas`,
    available_endpoints: [
      'GET /health',
      'GET /agents',
      'POST /:agentId/invoke',
      'POST /:agentId/stream',
      'POST /:agentId/stop',
      'GET /conversations',
      'GET /conversations/:threadId'
    ]
  });
});

// Démarrer le serveur
async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log('🚀 Serveur Agent CLI démarré !');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 Agents: http://localhost:${PORT}/agents`);
      console.log('');
      console.log('💡 Pour tester avec le CLI:');
      console.log('  npm run cli check');
      console.log('  npm run cli chat');
      
      // Charger et afficher les agents disponibles
      loadAgentsConfig().then(agents => {
        console.log('');
        console.log('🤖 Agents disponibles:');
        agents.forEach(agent => {
          console.log(`  - ${agent.id}: ${agent.name}`);
          console.log(`    ${agent.description}`);
        });
        console.log('');
        console.log('📝 Pour ajouter vos vrais agents:');
        console.log('  1. Modifiez AVAILABLE_AGENTS dans server-simple.mts');
        console.log('  2. Implémentez createAgent() pour vos agents');
        console.log('  3. Redémarrez le serveur');
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gérer l'arrêt propre du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

// Démarrer le serveur si ce fichier est exécuté directement - Fixed for cross-platform compatibility
const isMainModule = () => {
  try {
    const currentPath = fileURLToPath(import.meta.url);
    const mainPath = process.argv[1];
    return currentPath === mainPath || currentPath.endsWith(path.basename(mainPath));
  } catch {
    return true; // Fallback to always start on error
  }
};

if (isMainModule()) {
  startServer();
}

export default app; 