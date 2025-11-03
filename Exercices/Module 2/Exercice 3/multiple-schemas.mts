import { END, START, StateGraph } from "@langchain/langgraph";

// ============================================================================
// PRIVATE STATE : État privé entre nœuds
// ============================================================================
// Parfois, on veut que certains nœuds communiquent avec des données qui ne sont
// pas nécessaires dans l'input ou l'output du graphe.
//
// On peut définir un "état privé" (PrivateState) qui est utilisé entre les
// nœuds mais qui n'est pas inclus dans le schéma global du graphe.

type OverallState = {
  foo: number;
};

type PrivateState = {
  baz: number;
};

// node_1 lit depuis OverallState et écrit dans PrivateState
function node_1(state: OverallState): PrivateState {
  console.log("---Node 1---");
  // On retourne un PrivateState avec baz calculé depuis foo
  return { baz: state.foo + 1 };
}

// node_2 lit depuis PrivateState et écrit dans OverallState
function node_2(state: PrivateState): Partial<OverallState> {
  console.log("---Node 2---");
  // On retourne un OverallState avec foo calculé depuis baz
  return { foo: state.baz + 1 };
}

// Construction du graphe avec OverallState comme schéma principal
// Note: En TypeScript, LangGraph utilise le schéma principal pour les channels.
// Les nœuds peuvent retourner des types différents, mais ils doivent être compatibles.
const builderPrivate = new StateGraph<OverallState>({
  channels: {
    foo: {
      default: () => 0,
      reducer: (current: number, update: number) => update,
    },
  },
});

builderPrivate.addNode("node_1", node_1 as any);
builderPrivate.addNode("node_2", node_2 as any);
builderPrivate.addEdge(START as any, "node_1" as any);
builderPrivate.addEdge("node_1" as any, "node_2" as any);
builderPrivate.addEdge("node_2" as any, END as any);

const graphPrivate = builderPrivate.compile();

console.log("=== Test 1: État privé (Private State) ===");
console.log("node_1 utilise OverallState et écrit PrivateState");
console.log("node_2 utilise PrivateState et écrit OverallState");
const resultPrivate = await graphPrivate.invoke({ foo: 1 });
console.log("Résultat:", resultPrivate);
console.log("Note: 'baz' n'est pas dans le résultat car il n'est pas dans OverallState");

// ============================================================================
// INPUT / OUTPUT SCHEMA : Schémas d'entrée et de sortie spécifiques
// ============================================================================
// Par défaut, StateGraph utilise un seul schéma pour l'entrée, l'état interne,
// et la sortie. Mais on peut vouloir :
// - Limiter les clés acceptées en entrée
// - Filtrer les clés retournées en sortie
//
// En TypeScript, on peut utiliser des types distincts pour l'input et l'output,
// même si le graphe interne utilise un schéma plus large.

// Schéma pour l'entrée : seulement 'question'
type InputState = {
  question: string;
};

// Schéma pour la sortie : seulement 'answer'
type OutputState = {
  answer: string;
};

// Schéma interne : contient toutes les clés nécessaires au fonctionnement du graphe
type OverallStateFull = {
  question: string;
  answer: string;
  notes: string; // Clé interne utilisée pour le traitement mais pas dans l'output
};

// Nœud qui utilise InputState (ou OverallStateFull) et écrit dans OverallStateFull
function thinking_node(state: OverallStateFull): Partial<OverallStateFull> {
  console.log("---Thinking Node---");
  return {
    answer: "bye",
    notes: "... his name is Lance",
  };
}

// Nœud qui lit OverallStateFull et retourne OutputState
function answer_node(state: OverallStateFull): Partial<OutputState> {
  console.log("---Answer Node---");
  return { answer: "bye Lance" };
}

// ============================================================================
// EXEMPLE 1 : Graphe avec un seul schéma (comportement par défaut)
// ============================================================================

const builderSingle = new StateGraph<OverallStateFull>({
  channels: {
    question: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
    answer: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
    notes: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
  },
});

builderSingle.addNode("thinking_node", thinking_node);
builderSingle.addNode("answer_node", answer_node);
builderSingle.addEdge(START as any, "thinking_node" as any);
builderSingle.addEdge("thinking_node" as any, "answer_node" as any);
builderSingle.addEdge("answer_node" as any, END as any);

const graphSingle = builderSingle.compile();

console.log("\n=== Test 2: Graphe avec schéma unique ===");
console.log("L'output contient toutes les clés de OverallStateFull");
const resultSingle = (await graphSingle.invoke({ question: "hi" })) as OverallStateFull;
console.log("Résultat:", resultSingle);
console.log("Contient: question, answer, notes");

// ============================================================================
// EXEMPLE 2 : Filtrage manuel de l'output
// ============================================================================
// En TypeScript, LangGraph ne supporte pas directement les paramètres
// input_schema et output_schema comme en Python, mais on peut filtrer
// manuellement l'output ou créer des fonctions wrapper.

// Fonction helper pour filtrer l'output selon OutputState
function filterOutput(result: OverallStateFull): OutputState {
  return {
    answer: result.answer,
  };
}

console.log("\n=== Test 3: Filtrage manuel de l'output ===");
const resultFiltered = (await graphSingle.invoke({ question: "hi" })) as OverallStateFull;
const filtered = filterOutput(resultFiltered);
console.log("Résultat filtré:", filtered);
console.log("Contient seulement: answer");

// ============================================================================
// EXEMPLE 3 : Wrapper pour gérer Input/Output spécifiques
// ============================================================================
// On peut créer une fonction wrapper qui gère la conversion entre les schémas.

async function invokeWithSchemas(input: InputState): Promise<OutputState> {
  // Convertir InputState vers OverallStateFull (avec valeurs par défaut)
  const internalInput: OverallStateFull = {
    question: input.question,
    answer: "",
    notes: "",
  };

  // Invoquer le graphe avec le schéma interne
  const result = (await graphSingle.invoke(internalInput)) as OverallStateFull;

  // Filtrer pour ne retourner que OutputState
  return filterOutput(result);
}

console.log("\n=== Test 4: Wrapper avec schémas Input/Output spécifiques ===");
const input: InputState = { question: "hi" };
const output = await invokeWithSchemas(input);
console.log("Input:", input);
console.log("Output:", output);
console.log("✅ Seulement 'answer' est retourné, pas 'question' ni 'notes'");

// ============================================================================
// EXEMPLE 4 : Utilisation pratique avec validation
// ============================================================================
// On peut combiner les schémas avec validation Zod pour s'assurer que
// les entrées et sorties respectent les contraintes.

import { z } from "zod";

const InputSchema = z.object({
  question: z.string().min(1),
});

const OutputSchema = z.object({
  answer: z.string(),
});

function validateAndInvoke(input: unknown): Promise<OutputState> {
  // Valider l'input
  const validatedInput = InputSchema.parse(input);
  
  // Invoquer le graphe
  return invokeWithSchemas(validatedInput).then((output) => {
    // Valider l'output
    return OutputSchema.parse(output);
  });
}

console.log("\n=== Test 5: Avec validation Zod ===");
try {
  const validatedOutput = await validateAndInvoke({ question: "hi" });
  console.log("✅ Input/Output validés:", validatedOutput);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log("❌ Erreur de validation:", error.errors);
  }
}

// Test avec input invalide
try {
  await validateAndInvoke({ question: "" }); // Question vide - invalide
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log("✅ Validation échoue comme prévu pour question vide");
  }
}

export { graphPrivate, graphSingle, invokeWithSchemas, validateAndInvoke };

