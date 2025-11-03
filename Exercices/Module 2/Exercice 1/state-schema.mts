import { END, START, StateGraph } from "@langchain/langgraph";
import "dotenv/config";
import { z } from "zod";

// ============================================================================
// MÉTHODE 1 : Type TypeScript (équivalent de TypedDict)
// ============================================================================
// Les types TypeScript permettent de spécifier les clés et leurs types.
// Ce sont des hints de type : utilisés par TypeScript pour la vérification
// statique, mais pas forcément appliqués à l'exécution.

type TypedDictState = {
  foo: string;
  bar: string;
};

// Pour des contraintes plus spécifiques, on peut utiliser des types union
type TypedDictStateWithMood = {
  name: string;
  mood: "happy" | "sad"; // Literal type - seulement "happy" ou "sad"
};

// ============================================================================
// MÉTHODE 2 : Classe TypeScript (équivalent de dataclass)
// ============================================================================
// Les classes TypeScript offrent une syntaxe concise pour créer des structures
// principalement utilisées pour stocker des données.

class DataclassState {
  name: string;
  mood: "happy" | "sad";

  constructor(name: string, mood: "happy" | "sad") {
    this.name = name;
    this.mood = mood;
  }
}

// Pour accéder aux propriétés d'une classe, on utilise state.name
// plutôt que state["name"] pour un type/interface.

// ============================================================================
// MÉTHODE 3 : Zod Schema (équivalent de Pydantic)
// ============================================================================
// TypedDict et classes fournissent des hints de type mais ne valident pas
// à l'exécution. Cela signifie qu'on pourrait assigner des valeurs invalides
// sans lever d'erreur !
//
// Pour la validation à l'exécution, on utilise Zod.
// Zod peut valider si les données correspondent aux types et contraintes
// spécifiés à l'exécution.

const PydanticStateSchema = z.object({
  name: z.string(),
  mood: z.enum(["happy", "sad"]),
});

type PydanticState = z.infer<typeof PydanticStateSchema>;

// ============================================================================
// EXEMPLE 1 : Graphe avec TypedDict
// ============================================================================

function node_1_typed(state: TypedDictStateWithMood) {
  console.log("---Node 1---");
  return { name: state.name + " is ... " };
}

function node_2_typed(state: TypedDictStateWithMood) {
  console.log("---Node 2---");
  return { mood: "happy" as const };
}

function node_3_typed(state: TypedDictStateWithMood) {
  console.log("---Node 3---");
  return { mood: "sad" as const };
}

type NextNode = "node_2" | "node_3";

function decide_mood(state: TypedDictStateWithMood): NextNode {
  // Ici, on fait simplement un split 50/50 entre node_2 et node_3
  return Math.random() < 0.5 ? "node_2" : "node_3";
}

const builderTyped = new StateGraph<TypedDictStateWithMood>({
  channels: {
    name: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
    mood: {
      default: () => "happy" as "happy" | "sad",
      reducer: (current: "happy" | "sad", update: "happy" | "sad") => update,
    },
  },
});

builderTyped.addNode("node_1", node_1_typed);
builderTyped.addNode("node_2", node_2_typed);
builderTyped.addNode("node_3", node_3_typed);
builderTyped.addEdge(START as any, "node_1" as any);
builderTyped.addConditionalEdges("node_1" as any, decide_mood as any);
builderTyped.addEdge("node_2" as any, END as any);
builderTyped.addEdge("node_3" as any, END as any);

const graphTyped = builderTyped.compile();

console.log("=== Test avec TypedDict ===");
const resultTyped = graphTyped.invoke({ name: "Lance", mood: "happy" });
console.log("Résultat:", resultTyped);

// ============================================================================
// EXEMPLE 2 : Graphe avec Classe
// ============================================================================

function node_1_class(state: DataclassState) {
  console.log("---Node 1---");
  // Avec une classe, on accède aux propriétés avec state.name
  // plutôt que state["name"] pour TypedDict
  return { name: state.name + " is ... " };
}

function node_2_class(state: DataclassState) {
  console.log("---Node 2---");
  return { mood: "happy" as const };
}

function node_3_class(state: DataclassState) {
  console.log("---Node 3---");
  return { mood: "sad" as const };
}

function decide_mood_class(state: DataclassState): NextNode {
  return Math.random() < 0.5 ? "node_2" : "node_3";
}

const builderClass = new StateGraph<DataclassState>({
  channels: {
    name: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
    mood: {
      default: () => "happy" as "happy" | "sad",
      reducer: (current: "happy" | "sad", update: "happy" | "sad") => update,
    },
  },
});

builderClass.addNode("node_1", node_1_class);
builderClass.addNode("node_2", node_2_class);
builderClass.addNode("node_3", node_3_class);
builderClass.addEdge(START as any, "node_1" as any);
builderClass.addConditionalEdges("node_1" as any, decide_mood_class as any);
builderClass.addEdge("node_2" as any, END as any);
builderClass.addEdge("node_3" as any, END as any);

const graphClass = builderClass.compile();

console.log("\n=== Test avec Classe ===");
const resultClass = graphClass.invoke(new DataclassState("Lance", "sad"));
console.log("Résultat:", resultClass);

// ============================================================================
// EXEMPLE 3 : Validation avec Zod
// ============================================================================

// Test de validation : essayer avec une valeur invalide
console.log("\n=== Test de validation Zod ===");

try {
  // Ceci devrait échouer car "mad" n'est pas dans ["happy", "sad"]
  const invalidState = PydanticStateSchema.parse({ name: "Lance", mood: "mad" });
  console.log("État invalide accepté (ne devrait pas arriver):", invalidState);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log("✅ Validation réussie : erreur détectée");
    console.log("Erreur:", error.errors[0].message);
  }
}

// Test avec une valeur valide
try {
  const validState = PydanticStateSchema.parse({ name: "Lance", mood: "sad" });
  console.log("✅ État valide accepté:", validState);
} catch (error) {
  console.log("Erreur (ne devrait pas arriver):", error);
}

// Utilisation dans un graphe
function node_1_zod(state: PydanticState) {
  console.log("---Node 1---");
  return { name: state.name + " is ... " };
}

function node_2_zod(state: PydanticState) {
  console.log("---Node 2---");
  return { mood: "happy" as const };
}

function node_3_zod(state: PydanticState) {
  console.log("---Node 3---");
  return { mood: "sad" as const };
}

function decide_mood_zod(state: PydanticState): NextNode {
  return Math.random() < 0.5 ? "node_2" : "node_3";
}

const builderZod = new StateGraph<PydanticState>({
  channels: {
    name: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
    mood: {
      default: () => "happy" as "happy" | "sad",
      reducer: (current: "happy" | "sad", update: "happy" | "sad") => update,
    },
  },
});

builderZod.addNode("node_1", node_1_zod);
builderZod.addNode("node_2", node_2_zod);
builderZod.addNode("node_3", node_3_zod);
builderZod.addEdge(START as any, "node_1" as any);
builderZod.addConditionalEdges("node_1" as any, decide_mood_zod as any);
builderZod.addEdge("node_2" as any, END as any);
builderZod.addEdge("node_3" as any, END as any);

const graphZod = builderZod.compile();

console.log("\n=== Test avec Zod (après validation) ===");
// Valider d'abord avec Zod
const validatedInput = PydanticStateSchema.parse({ name: "Lance", mood: "sad" });
const resultZod = graphZod.invoke(validatedInput);
console.log("Résultat:", resultZod);

