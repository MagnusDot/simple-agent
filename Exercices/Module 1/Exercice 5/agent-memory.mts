import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { z } from "zod";

// Outils
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

// Modèle avec outils
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const llm = new ChatOpenAI({ model: "gpt-4o" });
const llmWithTools = llm.bindTools(tools);

// Message système
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

// Construction du graphe
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
builder.addConditionalEdges(
  "assistant" as any,
  toolsCondition as any
);
builder.addEdge("tools" as any, "assistant" as any);

// Agent sans mémoire
export const reactGraph = builder.compile();

// Agent avec mémoire
const memory = new MemorySaver();
export const reactGraphMemory = builder.compile({ checkpointer: memory });

// ============================================================================
// DÉMONSTRATION : Différence entre Agent SANS et AVEC mémoire
// ============================================================================

// ----------------------------------------------------------------------------
// TEST 1 : Agent SANS mémoire (état transitoire)
// ----------------------------------------------------------------------------
// Sans checkpointer, chaque appel à invoke() part d'un état vide.
// L'agent ne se souvient pas des conversations précédentes.

console.log("=== Test 1: Agent SANS mémoire ===\n");

// Premier appel : Calcul simple
console.log("Premier appel : Add 3 and 4");
// Cet appel part d'un état vide (pas de messages précédents)
const result1 = await reactGraph.invoke({
  messages: [new HumanMessage({ content: "Add 3 and 4." })],
});
// L'agent va :
// 1. Appeler l'outil add(3, 4)
// 2. Obtenir le résultat 7
// 3. Répondre "The sum of 3 and 4 is 7."
console.log("Dernier message:", result1.messages[result1.messages.length - 1].content);

// Deuxième appel : Référence à une valeur précédente
console.log("\nDeuxième appel : Multiply that by 2");
// PROBLÈME : Cet appel part également d'un état vide !
// Le message précédent avec le résultat "7" n'existe plus.
const result2 = await reactGraph.invoke({
  messages: [new HumanMessage({ content: "Multiply that by 2." })],
});
// L'agent ne sait pas ce qu'est "that" car il n'a pas accès au contexte précédent.
// Il va probablement générer une réponse incorrecte ou demander une clarification.
console.log("Le modèle ne sait pas ce que 'that' représente !");
console.log("Dernier message:", result2.messages[result2.messages.length - 1].content);

// ============================================================================
// TEST 2 : Agent AVEC mémoire (état persistant)
// ============================================================================
// Avec MemorySaver, l'état est sauvegardé après chaque étape.
// En utilisant le même thread_id, on peut restaurer le contexte précédent.

console.log("\n\n=== Test 2: Agent AVEC mémoire ===\n");

// Définir un thread_id unique pour cette conversation
// Le thread_id identifie une conversation unique.
// Tous les appels avec le même thread_id partagent le même contexte.
const threadId = "1";
const config = { configurable: { thread_id: threadId } };

// Premier appel dans ce thread
console.log("Premier appel : Add 3 and 4");
// Cet appel initialise le thread "1" avec un état vide.
// Le checkpointer sauvegardera l'état après chaque étape.
const result3 = await reactGraphMemory.invoke(
  {
    messages: [new HumanMessage({ content: "Add 3 and 4." })],
  },
  config // Important : passer le config avec thread_id
);
// Après cet appel, le checkpointer a sauvegardé :
// - Le HumanMessage initial
// - L'AIMessage avec tool_call
// - Le ToolMessage avec résultat 7
// - L'AIMessage final avec la réponse
console.log("Messages dans le thread:");
result3.messages.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  if ("tool_calls" in m && m.tool_calls && m.tool_calls.length > 0) {
    console.log(`  ${i + 1}. ${type} (avec tool_calls)`);
  } else {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    console.log(`  ${i + 1}. ${type}: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`);
  }
});

// Deuxième appel avec le MÊME thread_id
console.log("\nDeuxième appel avec le MÊME thread_id : Multiply that by 2");
// MAGIE : En utilisant le même thread_id, le checkpointer restaure automatiquement
// tous les messages précédents du thread "1".
// L'agent voit maintenant :
// - Le premier HumanMessage "Add 3 and 4."
// - L'AIMessage avec tool_call add(3, 4)
// - Le ToolMessage avec résultat 7
// - L'AIMessage "The sum of 3 and 4 is 7."
// - Le nouveau HumanMessage "Multiply that by 2."
const result4 = await reactGraphMemory.invoke(
  {
    messages: [new HumanMessage({ content: "Multiply that by 2." })],
  },
  config // Même thread_id = même contexte !
);
// Maintenant l'agent comprend que "that" fait référence à 7 (du message précédent).
// Il va appeler multiply(7, 2) et obtenir 14.
console.log("Le modèle sait maintenant que 'that' = 7 !");
console.log("\nTous les messages dans le thread (y compris les précédents):");
result4.messages.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  if ("tool_calls" in m && m.tool_calls && m.tool_calls.length > 0) {
    console.log(`  ${i + 1}. ${type} (avec tool_calls)`);
  } else {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    console.log(`  ${i + 1}. ${type}: ${content.substring(0, 60)}${content.length > 60 ? "..." : ""}`);
  }
});

// ============================================================================
// RÉSUMÉ
// ============================================================================
// - Sans mémoire : Chaque appel est isolé, pas de contexte entre les appels
// - Avec mémoire : Le thread_id permet de maintenir le contexte
// - Le checkpointer sauvegarde/restaure automatiquement l'état
// - Utile pour les conversations multi-tours où on référence des éléments précédents

