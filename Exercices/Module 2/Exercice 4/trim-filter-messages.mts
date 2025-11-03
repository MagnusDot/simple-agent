import { AIMessage, BaseMessage, HumanMessage, trimMessages } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const llm = new ChatOpenAI({ model: "gpt-4o" });

// ============================================================================
// MESSAGES COMME ÉTAT
// ============================================================================
// Les messages peuvent être utilisés comme état dans un graphe LangGraph.
// On utilise MessagesState avec le reducer add_messages.

type MessagesState = {
  messages: BaseMessage[];
};

function addMessages(
  current: BaseMessage[],
  update: BaseMessage | BaseMessage[]
): BaseMessage[] {
  const messagesToAdd = Array.isArray(update) ? update : [update];
  const result = [...current];
  
  for (const message of messagesToAdd) {
    // Si le message a un ID qui existe déjà, on remplace l'ancien message
    if (message.id) {
      const existingIndex = result.findIndex((m) => m.id === message.id);
      if (existingIndex !== -1) {
        result[existingIndex] = message;
        continue;
      }
    }
    // Sinon, on ajoute le nouveau message
    result.push(message);
  }
  
  return result;
}

// Exemple de messages
const initialMessages: BaseMessage[] = [
  new AIMessage({ content: "So you said you were researching ocean mammals?", name: "Bot" }),
  new HumanMessage({ content: "Yes, I know about whales. But what others should I learn about?", name: "Lance" }),
];

console.log("=== Messages initiaux ===");
initialMessages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`${type}: ${typeof m.content === "string" ? m.content.substring(0, 60) : ""}...`);
});

// Test d'invocation directe du modèle
console.log("\n=== Test: Invocation directe du modèle ===");
const directResult = await llm.invoke(initialMessages);
console.log("Type:", directResult.constructor.name);
console.log("Contenu:", typeof directResult.content === "string" ? directResult.content.substring(0, 100) : "");

// ============================================================================
// GRAPHE SIMPLE AVEC MESSAGES
// ============================================================================

async function chatModelNode(state: MessagesState): Promise<Partial<MessagesState>> {
  const result = await llm.invoke(state.messages);
  return { messages: [result] };
}

const builderSimple = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builderSimple.addNode("chat_model", chatModelNode);
builderSimple.addEdge(START as any, "chat_model" as any);
builderSimple.addEdge("chat_model" as any, END as any);

const graphSimple = builderSimple.compile();

console.log("\n=== Test: Graphe simple avec messages ===");
const resultSimple = await graphSimple.invoke({ messages: initialMessages });
resultSimple.messages.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  const content = typeof m.content === "string" ? m.content.substring(0, 60) : "";
  console.log(`${i + 1}. ${type}: ${content}...`);
});

// ============================================================================
// SUPPRESSION DE MESSAGES AVEC REDUCER
// ============================================================================
// Pour gérer les conversations longues, on peut supprimer des messages anciens
// en utilisant le reducer add_messages avec des messages à supprimer.
// Note: En TypeScript, on doit filtrer manuellement car RemoveMessage n'est
// pas toujours disponible de la même manière qu'en Python.

function filterMessages(state: MessagesState): Partial<MessagesState> {
  // Garder seulement les 2 messages les plus récents
  // On retourne un nouvel état avec seulement ces messages
  const recentMessages = state.messages.slice(-2);
  return { messages: recentMessages };
}

async function chatModelNodeFiltered(state: MessagesState): Promise<Partial<MessagesState>> {
  // Maintenant state.messages contient seulement les 2 messages récents
  const result = await llm.invoke(state.messages);
  return { messages: [result] };
}

const builderFilter = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builderFilter.addNode("filter", filterMessages);
builderFilter.addNode("chat_model", chatModelNodeFiltered);
builderFilter.addEdge(START as any, "filter" as any);
builderFilter.addEdge("filter" as any, "chat_model" as any);
builderFilter.addEdge("chat_model" as any, END as any);

const graphFilter = builderFilter.compile();

console.log("\n=== Test: Filtrage de messages (garder 2 derniers) ===");
const messagesWithHistory: BaseMessage[] = [
  new AIMessage({ content: "Hi.", name: "Bot", id: "1" }),
  new HumanMessage({ content: "Hi.", name: "Lance", id: "2" }),
  new AIMessage({ content: "So you said you were researching ocean mammals?", name: "Bot", id: "3" }),
  new HumanMessage({ content: "Yes, I know about whales. But what others should I learn about?", name: "Lance", id: "4" }),
];

const resultFilter = await graphFilter.invoke({ messages: messagesWithHistory });
console.log(`Nombre de messages dans le résultat: ${resultFilter.messages.length}`);
console.log("Note: Le nœud 'filter' a gardé seulement les 2 derniers messages avant l'appel au modèle");

// ============================================================================
// FILTRAGE DES MESSAGES PASSÉS AU MODÈLE
// ============================================================================
// Au lieu de modifier l'état, on peut simplement filtrer les messages
// qu'on passe au modèle. L'état complet est préservé, mais le modèle
// ne reçoit qu'un sous-ensemble.

async function chatModelNodeWithSlice(state: MessagesState): Promise<Partial<MessagesState>> {
  // Passer seulement le dernier message au modèle
  const lastMessage = state.messages.slice(-1);
  const result = await llm.invoke(lastMessage);
  return { messages: [result] };
}

const builderSlice = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builderSlice.addNode("chat_model", chatModelNodeWithSlice);
builderSlice.addEdge(START as any, "chat_model" as any);
builderSlice.addEdge("chat_model" as any, END as any);

const graphSlice = builderSlice.compile();

console.log("\n=== Test: Filtrage avec slice (passer seulement dernier message) ===");
const resultSlice = await graphSlice.invoke({ messages: messagesWithHistory });
console.log(`Nombre de messages dans l'état: ${resultSlice.messages.length}`);
console.log("Note: Tous les messages sont dans l'état, mais le modèle n'a reçu que le dernier");

// Ajout d'un suivi de conversation
const extendedMessages = [...resultSlice.messages];
extendedMessages.push(new HumanMessage({ content: "Tell me more about Narwhals!", name: "Lance" }));

console.log("\n=== Conversation étendue ===");
console.log(`Nombre total de messages: ${extendedMessages.length}`);
const resultExtended = await graphSlice.invoke({ messages: extendedMessages });
console.log(`Après réponse: ${resultExtended.messages.length} messages`);
console.log("Note: L'état contient toute l'historique, mais chaque appel modèle reçoit seulement le dernier message");

// ============================================================================
// TRIMMING DE MESSAGES (BASÉ SUR LES TOKENS)
// ============================================================================
// Le trimming permet de limiter les messages à un nombre maximum de tokens,
// en gardant les messages les plus récents qui rentrent dans la limite.

async function chatModelNodeWithTrim(state: MessagesState): Promise<Partial<MessagesState>> {
  // Utiliser trim_messages pour limiter à 100 tokens (exemple)
  // trim_messages garde les messages les plus récents qui rentrent dans la limite
  const trimmed = await trimMessages(state.messages, {
    maxTokens: 100,
    strategy: "last", // Garder les derniers messages
    tokenCounter: llm, // Utiliser le même modèle pour compter les tokens
    allowPartial: false, // Ne pas couper un message en deux
  });
  
  const result = await llm.invoke(trimmed);
  return { messages: [result] };
}

const builderTrim = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builderTrim.addNode("chat_model", chatModelNodeWithTrim);
builderTrim.addEdge(START as any, "chat_model" as any);
builderTrim.addEdge("chat_model" as any, END as any);

const graphTrim = builderTrim.compile();

console.log("\n=== Test: Trimming de messages (max 100 tokens) ===");
const longMessages: BaseMessage[] = [
  new AIMessage({ content: "Hi.", name: "Bot", id: "1" }),
  new HumanMessage({ content: "Hi.", name: "Lance", id: "2" }),
  new AIMessage({
    content: "So you said you were researching ocean mammals?",
    name: "Bot",
    id: "3",
  }),
  new HumanMessage({
    content: "Yes, I know about whales. But what others should I learn about?",
    name: "Lance",
    id: "4",
  }),
  new AIMessage({
    content:
      "That's great! There are many other fascinating ocean mammals. Dolphins, seals, manatees, walruses, narwhals, porpoises, sea otters, and polar bears are all worth learning about!",
    name: "Bot",
    id: "5",
  }),
  new HumanMessage({ content: "Tell me where Orcas live!", name: "Lance", id: "6" }),
];

const resultTrim = await graphTrim.invoke({ messages: longMessages });
console.log(`Nombre de messages dans l'état: ${resultTrim.messages.length}`);
console.log("Note: trim_messages a gardé seulement les messages récents qui rentrent dans 100 tokens");

// ============================================================================
// COMPARAISON DES APPROCHES
// ============================================================================

console.log("\n=== Comparaison des approches ===");
console.log("1. Filtrage avec reducer:");
console.log("   - Modifie l'état du graphe");
console.log("   - Les messages supprimés ne sont plus accessibles");
console.log("   - Utile pour nettoyer l'historique");

console.log("\n2. Filtrage avec slice:");
console.log("   - Ne modifie pas l'état");
console.log("   - Tous les messages restent dans l'état");
console.log("   - Le modèle reçoit seulement un sous-ensemble");
console.log("   - Utile quand on veut préserver l'historique");

console.log("\n3. Trimming avec tokens:");
console.log("   - Limite basée sur le nombre de tokens (pas le nombre de messages)");
console.log("   - Plus précis pour gérer les limites de contexte");
console.log("   - Garde automatiquement les messages les plus récents");
console.log("   - Utile pour respecter les limites de tokens du modèle");

export { graphFilter, graphSimple, graphSlice, graphTrim };

