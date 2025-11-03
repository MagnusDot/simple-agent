import { BaseMessage, HumanMessage, RemoveMessage, SystemMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

// ============================================================================
// ÉTAT AVEC MESSAGES ET RÉSUMÉ
// ============================================================================
// On étend MessagesState avec un champ supplémentaire `summary` pour stocker
// le résumé de la conversation.

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
// Ce nœud appelle le LLM en incorporant le résumé (s'il existe) dans
// le message système pour fournir le contexte de la conversation précédente.

async function call_model(state: State): Promise<Partial<State>> {
  // Récupérer le résumé s'il existe
  const summary = state.summary || "";

  let messages: BaseMessage[];

  // Si un résumé existe, l'ajouter comme message système
  if (summary) {
    const systemMessage = new SystemMessage({
      content: `Summary of conversation earlier: ${summary}`,
    });
    messages = [systemMessage, ...state.messages];
  } else {
    messages = state.messages;
  }

  // Appeler le modèle avec les messages (incluant le résumé si présent)
  const response = await model.invoke(messages);
  return { messages: [response] };
}

// ============================================================================
// NŒUD : RÉSUMER LA CONVERSATION
// ============================================================================
// Ce nœud utilise le LLM pour créer un résumé de la conversation.
// Après avoir créé le résumé, il supprime tous les messages sauf les 2 plus récents
// en utilisant RemoveMessage.

async function summarize_conversation(state: State): Promise<Partial<State>> {
  // Récupérer le résumé existant s'il y en a un
  const existingSummary = state.summary || "";

  // Créer le prompt de résumé
  let summaryPrompt: string;
  if (existingSummary) {
    // Un résumé existe déjà, l'étendre avec les nouveaux messages
    summaryPrompt = `This is summary of the conversation to date: ${existingSummary}\n\nExtend the summary by taking into account the new messages above:`;
  } else {
    // Créer un nouveau résumé
    summaryPrompt = "Create a summary of the conversation above:";
  }

  // Ajouter le prompt de résumé à l'historique des messages
  const messagesWithPrompt = [...state.messages, new HumanMessage({ content: summaryPrompt })];

  // Appeler le modèle pour générer le résumé
  const response = await model.invoke(messagesWithPrompt);
  const newSummary = typeof response.content === "string" ? response.content : "";

  // Supprimer tous les messages sauf les 2 plus récents
  // On utilise RemoveMessage pour marquer les messages à supprimer
  const messagesToRemove = state.messages.slice(0, -2); // Tous sauf les 2 derniers

  // Créer des RemoveMessage pour chaque message à supprimer
  const removeMessages = messagesToRemove.map((m) => new RemoveMessage({ id: m.id || "" }));

  return {
    summary: newSummary,
    messages: removeMessages,
  };
}

// ============================================================================
// ARÊTE CONDITIONNELLE : DÉCIDER SI ON RÉSUME OU ON TERMINE
// ============================================================================
// Cette fonction détermine si on doit résumer la conversation (> 6 messages)
// ou simplement terminer.

type NextNode = "summarize_conversation" | typeof END;

function should_continue(state: State): NextNode {
  const messages = state.messages;

  // Si il y a plus de 6 messages, résumer la conversation
  if (messages.length > 6) {
    return "summarize_conversation";
  }

  // Sinon, terminer
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

// Point d'entrée : conversation
builder.addEdge(START as any, "conversation" as any);

// Arête conditionnelle : après conversation, décider si on résume ou termine
builder.addConditionalEdges("conversation" as any, should_continue as any);

// Après résumé, terminer
builder.addEdge("summarize_conversation" as any, END as any);

// Compiler le graphe avec MemorySaver pour la persistance
const memory = new MemorySaver();
export const graph = builder.compile({ checkpointer: memory });

// ============================================================================
// DÉMONSTRATION : CONVERSATION AVEC RÉSUMÉ
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes("chatbot-summarization")) {
  (async () => {
    // Créer un thread avec un ID unique
    // Le thread_id permet de regrouper les checkpoints d'une même conversation
    const config = { configurable: { thread_id: "1" } };

    console.log("=== Début de la conversation ===\n");

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

    // Vérifier le résumé (devrait être vide car <= 6 messages)
    const state = await graph.getState(config);
    const currentSummary = state.values.summary || "";
    console.log(`Résumé actuel (devrait être vide): "${currentSummary}"\n`);

    // Quatrième message (devrait déclencher le résumé)
    console.log("4. Utilisateur: i like Nick Bosa, isn't he the highest paid defensive player?");
    output = await graph.invoke(
      {
        messages: [new HumanMessage({ content: "i like Nick Bosa, isn't he the highest paid defensive player?" })],
      },
      config
    );
    const lastMessage4 = output.messages[output.messages.length - 1];
    console.log(`   Assistant: ${typeof lastMessage4.content === "string" ? lastMessage4.content : ""}\n`);

    // Vérifier le résumé (devrait maintenant contenir un résumé)
    const stateAfterSummary = await graph.getState(config);
    const summaryAfter = stateAfterSummary.values.summary || "";
    console.log(`Résumé après résumé (devrait contenir un résumé):`);
    console.log(`"${summaryAfter}"\n`);

    console.log("=== Conversation terminée ===");
  })();
}

