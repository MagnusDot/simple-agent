import { BaseMessage, HumanMessage, RemoveMessage, SystemMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { mkdirSync } from "fs";
import { dirname } from "path";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

// ============================================================================
// SQLITE : BASE DE DONNÉES EXTERNE
// ============================================================================
// SqliteSaver permet de persister l'état dans une base de données SQLite.
// Contrairement à MemorySaver, les données survivent aux redémarrages.

const dbPath = "state_db/example.db";

// Créer le dossier state_db s'il n'existe pas
try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch (e) {
  // Le dossier existe déjà, c'est OK
}

// Importer SqliteSaver et better-sqlite3
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import Database from "better-sqlite3";

// Créer la connexion SQLite
const conn = new Database(dbPath);

// Créer le checkpointer SQLite
const memory = new SqliteSaver(conn);

// ============================================================================
// ÉTAT AVEC MESSAGES ET RÉSUMÉ
// ============================================================================

type State = {
  messages: BaseMessage[];
  summary: string;
};

// Reducer pour messages : ajoute les messages à la liste
function addMessages(
  current: BaseMessage[],
  update: BaseMessage | BaseMessage[]
): BaseMessage[] {
  const messagesToAdd = Array.isArray(update) ? update : [update];
  const result = [...current];
  
  // Gérer RemoveMessage pour supprimer des messages
  for (const msg of messagesToAdd) {
    if (msg instanceof RemoveMessage) {
      // Supprimer le message avec l'ID correspondant
      const index = result.findIndex((m) => m.id === msg.id);
      if (index !== -1) {
        result.splice(index, 1);
      }
    } else {
      // Si le message a un ID et qu'un message avec le même ID existe, le remplacer
      if (msg.id) {
        const existingIndex = result.findIndex((m) => m.id === msg.id);
        if (existingIndex !== -1) {
          result[existingIndex] = msg;
        } else {
          result.push(msg);
        }
      } else {
        // Ajouter le nouveau message
        result.push(msg);
      }
    }
  }
  
  return result;
}

// Reducer pour summary : écrase la valeur
function updateSummary(current: string, update: string): string {
  return update;
}

// ============================================================================
// NŒUD : APPELER LE MODÈLE
// ============================================================================

async function call_model(state: State): Promise<Partial<State>> {
  const summary = state.summary || "";

  let messages: BaseMessage[];

  if (summary) {
    const systemMessage = new SystemMessage({
      content: `Summary of conversation earlier: ${summary}`,
    });
    messages = [systemMessage, ...state.messages];
  } else {
    messages = state.messages;
  }

  const response = await model.invoke(messages);
  return { messages: [response] };
}

// ============================================================================
// NŒUD : RÉSUMER LA CONVERSATION
// ============================================================================

async function summarize_conversation(state: State): Promise<Partial<State>> {
  const existingSummary = state.summary || "";

  let summaryPrompt: string;
  if (existingSummary) {
    summaryPrompt = `This is summary of the conversation to date: ${existingSummary}\n\nExtend the summary by taking into account the new messages above:`;
  } else {
    summaryPrompt = "Create a summary of the conversation above:";
  }

  const messagesWithPrompt = [...state.messages, new HumanMessage({ content: summaryPrompt })];
  const response = await model.invoke(messagesWithPrompt);
  const newSummary = typeof response.content === "string" ? response.content : "";

  const messagesToRemove = state.messages.slice(0, -2);
  const removeMessages = messagesToRemove.map((m) => new RemoveMessage({ id: m.id || "" }));

  return {
    summary: newSummary,
    messages: removeMessages,
  };
}

// ============================================================================
// ARÊTE CONDITIONNELLE : DÉCIDER SI ON RÉSUME OU ON TERMINE
// ============================================================================

type NextNode = "summarize_conversation" | typeof END;

function should_continue(state: State): NextNode {
  const messages = state.messages;

  if (messages.length > 6) {
    return "summarize_conversation";
  }

  return END;
}

// ============================================================================
// CONSTRUCTION DU GRAPHE
// ============================================================================

const builder = new StateGraph<State>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
    summary: {
      default: () => "",
      reducer: updateSummary,
    },
  },
});

builder.addNode("conversation", call_model);
builder.addNode("summarize_conversation", summarize_conversation);

builder.addEdge(START as any, "conversation" as any);
builder.addConditionalEdges("conversation" as any, should_continue as any);
builder.addEdge("summarize_conversation" as any, END as any);

// Compiler le graphe avec SqliteSaver pour la persistance externe
export const graph = builder.compile({ checkpointer: memory as any });

// ============================================================================
// DÉMONSTRATION : CONVERSATION AVEC PERSISTANCE SQLITE
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes("chatbot-external-memory")) {
  (async () => {
    const config = { configurable: { thread_id: "1" } };

    console.log("=== Début de la conversation ===\n");
    console.log(`📁 Base de données SQLite: ${dbPath}\n`);

    // Premier message
    console.log("1. Utilisateur: hi! I'm Lance");
    let output = await graph.invoke(
      {
        messages: [new HumanMessage({ content: "hi! I'm Lance" })],
        summary: "",
      },
      config
    );
    const lastMessage = output.messages[output.messages.length - 1];
    console.log(`   Assistant: ${typeof lastMessage.content === "string" ? lastMessage.content : ""}\n`);

    // Deuxième message
    console.log("2. Utilisateur: what's my name?");
    output = await graph.invoke(
      {
        messages: [new HumanMessage({ content: "what's my name?" })],
      },
      config
    );
    const lastMessage2 = output.messages[output.messages.length - 1];
    console.log(`   Assistant: ${typeof lastMessage2.content === "string" ? lastMessage2.content : ""}\n`);

    // Troisième message
    console.log("3. Utilisateur: i like the 49ers!");
    output = await graph.invoke(
      {
        messages: [new HumanMessage({ content: "i like the 49ers!" })],
      },
      config
    );
    const lastMessage3 = output.messages[output.messages.length - 1];
    console.log(`   Assistant: ${typeof lastMessage3.content === "string" ? lastMessage3.content : ""}\n`);

    // Vérifier l'état sauvegardé dans SQLite
    console.log("=== Vérification de l'état sauvegardé ===\n");
    const state = await graph.getState(config);
    console.log("État sauvegardé dans SQLite:");
    console.log(`  - Nombre de messages: ${state.values.messages.length}`);
    console.log(`  - Résumé: "${state.values.summary || "(vide)"}"`);
    console.log(`  - Thread ID: ${config.configurable.thread_id}`);
    console.log("✅ L'état est persistant dans la base de données SQLite !\n");

    console.log("💡 Vous pouvez redémarrer le script et l'état sera toujours disponible !");
    console.log("💡 La base de données SQLite persiste même après la fermeture du processus.\n");
  })();
}

