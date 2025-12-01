import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import express from "express";
import { z } from "zod";

// ============================================================================
// CONFIGURATION DES OUTILS
// ============================================================================

const addTool = tool(
  async ({ a, b }) => {
    return a + b;
  },
  {
    name: "add",
    description: "Additionne deux nombres entiers",
    schema: z.object({
      a: z.number().describe("Premier nombre entier"),
      b: z.number().describe("Deuxième nombre entier"),
    }),
  }
);

const multiplyTool = tool(
  async ({ a, b }) => {
    return a * b;
  },
  {
    name: "multiply",
    description: "Multiplie deux nombres entiers",
    schema: z.object({
      a: z.number().describe("Premier nombre entier"),
      b: z.number().describe("Deuxième nombre entier"),
    }),
  }
);

const divideTool = tool(
  async ({ a, b }) => {
    return a / b;
  },
  {
    name: "divide",
    description: "Divise deux nombres entiers",
    schema: z.object({
      a: z.number().describe("Dividende"),
      b: z.number().describe("Diviseur"),
    }),
  }
);

const tools = [addTool, multiplyTool, divideTool];

// ============================================================================
// CONFIGURATION DU MODÈLE ET DE L'AGENT
// ============================================================================

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const llm = new ChatOpenAI({ model: "gpt-4o" });
const llmWithTools = llm.bindTools(tools);

const sysMsg = new SystemMessage({
  content: "You are a helpful assistant tasked with performing arithmetic on a set of inputs.",
});

// État avec messages
type MessagesState = {
  messages: BaseMessage[];
};

function addMessages(current: BaseMessage[], update: BaseMessage | BaseMessage[]): BaseMessage[] {
  const messagesToAdd = Array.isArray(update) ? update : [update];
  return [...current, ...messagesToAdd];
}

// Nœud assistant
async function assistant(state: MessagesState) {
  const result = await llmWithTools.invoke([sysMsg, ...state.messages]);
  return { messages: [result] };
}

// Construction du graphe avec mémoire
const builder = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builder.addNode("assistant", assistant);
builder.addNode("tools", new ToolNode(tools));
builder.addEdge(START as any, "assistant" as any);
builder.addConditionalEdges("assistant" as any, toolsCondition as any);
builder.addEdge("tools" as any, "assistant" as any);

// Compilation avec mémoire
const memory = new MemorySaver();
const reactGraphMemory = builder.compile({ checkpointer: memory });

// ============================================================================
// SERVEUR WEB EXPRESS
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());

// Endpoint pour discuter avec l'agent
app.post("/chat", async (req, res) => {
  try {
    const { message, thread_id } = req.body;

    // Validation de l'input
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Le champ 'message' est requis et doit être une chaîne de caractères",
      });
    }

    // Générer un thread_id si non fourni
    const threadId = thread_id || `thread_${Date.now()}`;
    const config = { configurable: { thread_id: threadId } };

    console.log(`[${new Date().toISOString()}] Thread: ${threadId}, Message: ${message}`);

    // Invoquer l'agent avec mémoire en utilisant stream pour charger l'état du thread
    for await (const event of await reactGraphMemory.stream(
      {
        messages: [new HumanMessage({ content: message })],
      },
      config
    )) {
      // Stream les événements (cela charge et sauvegarde l'état automatiquement)
    }

    // Récupérer l'état final complet du thread après l'exécution
    const state = await reactGraphMemory.getState(config);
    const allMessages = state.values.messages;
    
    // Extraire la réponse de l'assistant (dernier message)
    const lastMessage = allMessages[allMessages.length - 1];
    const response = typeof lastMessage.content === "string" 
      ? lastMessage.content 
      : JSON.stringify(lastMessage.content);

    // Retourner la réponse
    res.json({
      thread_id: threadId,
      response: response,
      message_count: allMessages.length,
    });
  } catch (error) {
    console.error("Erreur lors du traitement de la requête:", error);
    res.status(500).json({
      error: "Erreur interne du serveur",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});



// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         🤖 Agent Memory Server démarré avec succès         ║
╠════════════════════════════════════════════════════════════╣
║  URL:      http://localhost:${PORT}                           ║
║  Endpoint: POST http://localhost:${PORT}/chat                 ║
╚════════════════════════════════════════════════════════════╝

Exemple de requête:
  curl -X POST http://localhost:${PORT}/chat \\
    -H "Content-Type: application/json" \\
    -d '{"message": "Add 3 and 4", "thread_id": "test123"}'
  `);
});
