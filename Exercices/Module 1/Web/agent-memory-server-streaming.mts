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

const llm = new ChatOpenAI({ model: "gpt-4o", streaming: true });
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

// Nœud assistant (sans streaming - utilisé par le graphe)
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
const PORT = process.env.PORT || 3001;

// Middleware pour parser le JSON
app.use(express.json());

// Endpoint pour discuter avec l'agent (streaming SSE)
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

    // Configurer les headers pour Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Envoyer le thread_id au début
    res.write(`data: ${JSON.stringify({ type: "thread_id", thread_id: threadId })}\n\n`);

    // Récupérer l'état actuel du thread pour avoir le contexte
    let existingMessages: BaseMessage[] = [];
    try {
      const currentState = await reactGraphMemory.getState(config);
      if (currentState?.values?.messages && Array.isArray(currentState.values.messages)) {
        existingMessages = currentState.values.messages;
      }
    } catch (error) {
      // Nouveau thread, pas de messages existants
      console.log("Nouveau thread, aucun état existant");
    }

    // Préparer les messages avec le contexte complet du thread
    const allMessages = [...existingMessages, new HumanMessage({ content: message })];

    // VRAI STREAMING TOKEN PAR TOKEN directement depuis le LLM
    let aiMessage: any = null;
    
    const stream = await llmWithTools.stream([sysMsg, ...allMessages]);
    
    for await (const chunk of stream) {
      // Accumuler le message complet
      if (!aiMessage) {
        aiMessage = chunk;
      } else {
        aiMessage = aiMessage.concat(chunk);
      }
      
      // Stream des tokens de contenu en temps réel
      if (chunk.content && typeof chunk.content === "string" && chunk.content.length > 0) {
        res.write(`data: ${JSON.stringify({ 
          type: "token", 
          content: chunk.content
        })}\n\n`);
      }
    }

    // Vérifier si le message a des tool_calls
    const hasToolCalls = aiMessage && "tool_calls" in aiMessage && aiMessage.tool_calls && aiMessage.tool_calls.length > 0;

    if (hasToolCalls) {
      // Envoyer les tool_calls détectés
      res.write(`data: ${JSON.stringify({ 
        type: "tool_call", 
        tools: aiMessage.tool_calls.map((tc: any) => ({
          name: tc.name,
          args: tc.args
        }))
      })}\n\n`);

      // Exécuter le graphe complet pour gérer les outils
      for await (const event of await reactGraphMemory.stream(
        {
          messages: [new HumanMessage({ content: message })],
        },
        {
          ...config,
          streamMode: "updates" as const,
        }
      )) {
        const eventData = event as any;
        
        // Envoyer les résultats des outils
        if (eventData.tools) {
          const toolMsgs = eventData.tools.messages;
          for (const toolMsg of toolMsgs) {
            if (toolMsg._getType() === "tool") {
              res.write(`data: ${JSON.stringify({ 
                type: "tool_result", 
                content: toolMsg.content
              })}\n\n`);
            }
          }
        }
        
        // Stream la réponse finale token par token
        if (eventData.assistant) {
          const finalMessages = eventData.assistant.messages;
          const lastAiMsg = finalMessages[finalMessages.length - 1];
          
          if (lastAiMsg._getType() === "ai" && lastAiMsg.content) {
            // Récupérer l'état complet avant de streamer la réponse finale
            const updatedState = await reactGraphMemory.getState(config);
            const finalStream = await llm.stream([sysMsg, ...updatedState.values.messages]);
            
            for await (const chunk of finalStream) {
              if (chunk.content && typeof chunk.content === "string" && chunk.content.length > 0) {
                res.write(`data: ${JSON.stringify({ 
                  type: "token", 
                  content: chunk.content
                })}\n\n`);
              }
            }
          }
        }
      }
    } else {
      // Pas de tool calls, sauvegarder la réponse dans le graphe
      await reactGraphMemory.invoke(
        {
          messages: [new HumanMessage({ content: message })],
        },
        config
      );
    }

    // Récupérer l'état final pour envoyer le nombre total de messages
    const state = await reactGraphMemory.getState(config);
    
    // Envoyer un événement de fin
    res.write(`data: ${JSON.stringify({ 
      type: "done", 
      message_count: state.values.messages.length 
    })}\n\n`);
    
    res.end();
  } catch (error) {
    console.error("Erreur lors du traitement de la requête:", error);
    res.write(`data: ${JSON.stringify({ 
      type: "error", 
      error: error instanceof Error ? error.message : String(error) 
    })}\n\n`);
    res.end();
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║    🤖 Agent Memory Server (STREAMING) démarré avec succès  ║
╠════════════════════════════════════════════════════════════╣
║  URL:        http://localhost:${PORT}                         ║
║  Streaming:  POST http://localhost:${PORT}/chat               ║
╚════════════════════════════════════════════════════════════╝

✨ Streaming SSE activé pour des réponses en temps réel !
  `);
});
