import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";

// ============================================================================
// ÉTAT PAR DÉFAUT : Écrasement (Overwrite)
// ============================================================================
// Par défaut, LangGraph écrase les valeurs d'état.
// Quand un nœud retourne une nouvelle valeur, elle remplace l'ancienne.

type DefaultState = {
  foo: number;
};

function node_1_default(state: DefaultState): Partial<DefaultState> {
  console.log("---Node 1---");
  return { foo: state.foo + 1 };
}

const builderDefault = new StateGraph<DefaultState>({
  channels: {
    foo: {
      default: () => 0,
      reducer: (current: number, update: number) => update, // Écrase la valeur
    },
  },
});

builderDefault.addNode("node_1", node_1_default);
builderDefault.addEdge(START as any, "node_1" as any);
builderDefault.addEdge("node_1" as any, END as any);

const graphDefault = builderDefault.compile();

console.log("=== Test 1: État par défaut (écrasement) ===");
const resultDefault = await graphDefault.invoke({ foo: 1 });
console.log("Résultat:", resultDefault);

// ============================================================================
// PROBLÈME : Branches parallèles
// ============================================================================
// Quand plusieurs nœuds s'exécutent en parallèle (branches), ils tentent tous
// d'écraser la même clé d'état. Cela génère une erreur InvalidUpdateError.

function node_1_branch(state: DefaultState): Partial<DefaultState> {
  console.log("---Node 1---");
  return { foo: state.foo + 1 };
}

function node_2_branch(state: DefaultState): Partial<DefaultState> {
  console.log("---Node 2---");
  return { foo: state.foo + 1 };
}

function node_3_branch(state: DefaultState): Partial<DefaultState> {
  console.log("---Node 3---");
  return { foo: state.foo + 1 };
}

const builderBranch = new StateGraph<DefaultState>({
  channels: {
    foo: {
      default: () => 0,
      reducer: (current: number, update: number) => update,
    },
  },
});

builderBranch.addNode("node_1", node_1_branch);
builderBranch.addNode("node_2", node_2_branch);
builderBranch.addNode("node_3", node_3_branch);
builderBranch.addEdge(START as any, "node_1" as any);
builderBranch.addEdge("node_1" as any, "node_2" as any);
builderBranch.addEdge("node_1" as any, "node_3" as any);
builderBranch.addEdge("node_2" as any, END as any);
builderBranch.addEdge("node_3" as any, END as any);

const graphBranch = builderBranch.compile();

console.log("\n=== Test 2: Problème avec branches parallèles ===");
try {
  await graphBranch.invoke({ foo: 1 });
} catch (error: any) {
  console.log("❌ Erreur:", error.message);
  console.log("Les nœuds 2 et 3 tentent tous deux d'écraser 'foo' en parallèle !");
}

// ============================================================================
// SOLUTION : Reducers avec listes (concaténation)
// ============================================================================
// Au lieu d'écraser, on peut utiliser un reducer qui concatène les valeurs
// dans une liste. Cela permet à plusieurs nœuds d'ajouter des valeurs
// sans conflit.

type ListState = {
  foo: number[];
};

// Reducer qui concatène les listes
function concatReducer(current: number[], update: number[] | number): number[] {
  const updateArray = Array.isArray(update) ? update : [update];
  return [...current, ...updateArray];
}

function node_1_list(state: ListState): Partial<ListState> {
  console.log("---Node 1---");
  // On retourne un tableau avec la nouvelle valeur
  return { foo: [state.foo[state.foo.length - 1] + 1] };
}

const builderList = new StateGraph<ListState>({
  channels: {
    foo: {
      default: () => [],
      reducer: concatReducer, // Concatène au lieu d'écraser
    },
  },
});

builderList.addNode("node_1", node_1_list);
builderList.addEdge(START as any, "node_1" as any);
builderList.addEdge("node_1" as any, END as any);

const graphList = builderList.compile();

console.log("\n=== Test 3: Reducer avec liste (concaténation) ===");
const resultList = await graphList.invoke({ foo: [1] });
console.log("Résultat:", resultList);

// Test avec branches parallèles qui fonctionne maintenant
function node_2_list(state: ListState): Partial<ListState> {
  console.log("---Node 2---");
  const lastValue = state.foo[state.foo.length - 1];
  return { foo: [lastValue + 1] };
}

function node_3_list(state: ListState): Partial<ListState> {
  console.log("---Node 3---");
  const lastValue = state.foo[state.foo.length - 1];
  return { foo: [lastValue + 1] };
}

const builderBranchList = new StateGraph<ListState>({
  channels: {
    foo: {
      default: () => [],
      reducer: concatReducer,
    },
  },
});

builderBranchList.addNode("node_1", node_1_list);
builderBranchList.addNode("node_2", node_2_list);
builderBranchList.addNode("node_3", node_3_list);
builderBranchList.addEdge(START as any, "node_1" as any);
builderBranchList.addEdge("node_1" as any, "node_2" as any);
builderBranchList.addEdge("node_1" as any, "node_3" as any);
builderBranchList.addEdge("node_2" as any, END as any);
builderBranchList.addEdge("node_3" as any, END as any);

const graphBranchList = builderBranchList.compile();

console.log("\n=== Test 4: Branches parallèles avec reducer liste ===");
const resultBranchList = await graphBranchList.invoke({ foo: [1] });
console.log("Résultat:", resultBranchList);
console.log("✅ Les nœuds 2 et 3 s'exécutent en parallèle et ajoutent tous les deux des valeurs !");

// ============================================================================
// REDUCER PERSONNALISÉ : Gestion de None/undefined
// ============================================================================
// Le reducer par défaut (concaténation) échoue si l'entrée est None/undefined.
// On peut créer un reducer personnalisé qui gère ces cas.

type CustomListState = {
  foo: number[];
};

// Reducer personnalisé qui gère None/undefined
function reduceListSafe(
  current: number[] | undefined,
  update: number[] | number | undefined
): number[] {
  const currentArray = current || [];
  if (update === undefined || update === null) {
    return currentArray;
  }
  const updateArray = Array.isArray(update) ? update : [update];
  return [...currentArray, ...updateArray];
}

function node_1_custom(state: CustomListState): Partial<CustomListState> {
  console.log("---Node 1---");
  return { foo: [2] };
}

const builderCustom = new StateGraph<CustomListState>({
  channels: {
    foo: {
      default: () => [],
      reducer: reduceListSafe, // Reducer personnalisé qui gère undefined
    },
  },
});

builderCustom.addNode("node_1", node_1_custom);
builderCustom.addEdge(START as any, "node_1" as any);
builderCustom.addEdge("node_1" as any, END as any);

const graphCustom = builderCustom.compile();

console.log("\n=== Test 5: Reducer personnalisé avec None ===");
// Test avec undefined (équivalent de None en Python)
const resultCustom = await graphCustom.invoke({ foo: undefined as any });
console.log("Résultat:", resultCustom);
console.log("✅ Le reducer personnalisé gère undefined sans erreur !");

// ============================================================================
// REDUCER POUR MESSAGES : add_messages
// ============================================================================
// Pour les messages, LangGraph fournit un reducer spécial `add_messages`
// qui ajoute les messages à la liste existante au lieu de les écraser.
// Il gère aussi la réécriture et la suppression de messages.

type MessagesState = {
  messages: BaseMessage[];
};

// Reducer pour messages : ajoute les messages à la liste
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

console.log("\n=== Test 6: Reducer add_messages ===");

// Test d'ajout de messages
const initialMessages: BaseMessage[] = [
  new AIMessage({ content: "Hello! How can I assist you?", name: "Model" }),
  new HumanMessage({ content: "I'm looking for information on marine biology.", name: "Lance" }),
];

const newMessage = new AIMessage({
  content: "Sure, I can help with that. What specifically are you interested in?",
  name: "Model",
});

const resultMessages = addMessages(initialMessages, newMessage);
console.log("Messages après ajout:", resultMessages.length);
resultMessages.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`  ${i + 1}. ${type}: ${typeof m.content === "string" ? m.content.substring(0, 50) : ""}...`);
});

// Test de réécriture de message (même ID)
console.log("\n=== Test 7: Réécriture de message (même ID) ===");
const initialWithIds: BaseMessage[] = [
  new AIMessage({ content: "Hello! How can I assist you?", name: "Model", id: "1" }),
  new HumanMessage({ content: "I'm looking for information on marine biology.", name: "Lance", id: "2" }),
];

const updatedMessage = new HumanMessage({
  content: "I'm looking for information on whales, specifically",
  name: "Lance",
  id: "2", // Même ID que le message précédent
});

const resultUpdated = addMessages(initialWithIds, updatedMessage);
console.log("Messages après réécriture:", resultUpdated.length);
resultUpdated.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`  ${i + 1}. ${type}: ${typeof m.content === "string" ? m.content : ""}`);
});
console.log("✅ Le message avec id='2' a été remplacé au lieu d'être ajouté !");

// Test de suppression de messages
console.log("\n=== Test 8: Suppression de messages ===");
// Note: En TypeScript, on peut utiliser une classe RemoveMessage ou simplement
// filtrer manuellement. Pour simplifier, on montre le concept avec une fonction.
function removeMessages(
  current: BaseMessage[],
  idsToRemove: string[]
): BaseMessage[] {
  return current.filter((m) => !idsToRemove.includes(m.id || ""));
}

const messagesToDelete = [
  new AIMessage({ content: "Hi.", name: "Bot", id: "1" }),
  new HumanMessage({ content: "Hi.", name: "Lance", id: "2" }),
  new AIMessage({ content: "So you said you were researching ocean mammals?", name: "Bot", id: "3" }),
  new HumanMessage({ content: "Yes, I know about whales. But what others should I learn about?", name: "Lance", id: "4" }),
];

const idsToRemove = messagesToDelete.slice(0, 2).map((m) => m.id || "");
const resultDeleted = removeMessages(messagesToDelete, idsToRemove);
console.log("Messages après suppression:", resultDeleted.length);
resultDeleted.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`  ${i + 1}. ${type}: ${typeof m.content === "string" ? m.content.substring(0, 50) : ""}...`);
});
console.log("✅ Les messages avec id='1' et id='2' ont été supprimés !");

// ============================================================================
// EXEMPLE COMPLET : Graphe avec messages et reducer
// ============================================================================

async function assistant(state: MessagesState): Promise<Partial<MessagesState>> {
  // Simulation d'un assistant qui répond
  const lastMessage = state.messages[state.messages.length - 1];
  const content = typeof lastMessage.content === "string" ? lastMessage.content : "";
  
  if (content.toLowerCase().includes("whale")) {
    return {
      messages: [
        new AIMessage({ content: "Whales are fascinating marine mammals!", name: "Bot" }),
      ],
    };
  }
  return {
    messages: [new AIMessage({ content: "I can help you learn about marine biology!", name: "Bot" })],
  };
}

const builderMessages = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builderMessages.addNode("assistant", assistant);
builderMessages.addEdge(START as any, "assistant" as any);
builderMessages.addEdge("assistant" as any, END as any);

const graphMessages = builderMessages.compile();

console.log("\n=== Test 9: Graphe complet avec messages ===");
const resultGraph = await graphMessages.invoke({
  messages: [new HumanMessage({ content: "Tell me about whales", name: "Lance" })],
});

resultGraph.messages.forEach((m, i) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`  ${i + 1}. ${type}: ${typeof m.content === "string" ? m.content : ""}`);
});

export { graphBranch, graphDefault, graphList, graphMessages };

