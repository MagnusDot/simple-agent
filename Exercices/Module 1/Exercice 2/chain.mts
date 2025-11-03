import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { z } from "zod";

// Messages
const messages = [
  new AIMessage({ content: "So you said you were researching ocean mammals?", name: "Model" }),
  new HumanMessage({ content: "Yes, that's right.", name: "Lance" }),
  new AIMessage({ content: "Great, what would you like to learn about.", name: "Model" }),
  new HumanMessage({ content: "I want to learn about the best place to see Orcas in the US.", name: "Lance" }),
];

console.log("=== Messages ===");
messages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`${type}: ${m.content}`);
});

// Modèle de chat
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const llm = new ChatOpenAI({ model: "gpt-4o" });
const result = await llm.invoke(messages);
console.log("\n=== Résultat du modèle ===");
console.log("Type:", result.constructor.name);
console.log("Contenu:", result.content);

// Outils
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

const llmWithTools = llm.bindTools([multiplyTool]);
const toolCallResult = await llmWithTools.invoke([
  new HumanMessage({ content: "What is 2 multiplied by 3", name: "Lance" }),
]);

console.log("\n=== Appels d'outils ===");
console.log("Tool calls:", toolCallResult.tool_calls);

// État avec messages
type MessagesState = {
  messages: BaseMessage[];
};

function addMessages(current: BaseMessage[], update: BaseMessage | BaseMessage[]): BaseMessage[] {
  const messagesToAdd = Array.isArray(update) ? update : [update];
  return [...current, ...messagesToAdd];
}

// Graphe
async function toolCallingLlm(state: MessagesState) {
  const result = await llmWithTools.invoke(state.messages);
  return { messages: [result] };
}

const builder = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builder.addNode("tool_calling_llm", toolCallingLlm);
builder.addEdge(START as any, "tool_calling_llm" as any);
builder.addEdge("tool_calling_llm" as any, END as any);

export const graph = builder.compile();

// Exécution
console.log("\n=== Test 1: Message simple ===");
const result1 = await graph.invoke({
  messages: [new HumanMessage({ content: "Hello!" })],
});
result1.messages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`${type}: ${m.content}`);
});

console.log("\n=== Test 2: Avec appel d'outil ===");
const result2 = await graph.invoke({
  messages: [new HumanMessage({ content: "Multiply 2 and 3!" })],
});
result2.messages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`${type}:`);
  if ("tool_calls" in m && m.tool_calls && m.tool_calls.length > 0) {
    console.log("  Tool Calls:");
    m.tool_calls.forEach((tc: any) => {
      console.log(`    ${tc.name} (${tc.id})`);
      console.log(`    Args: a=${tc.args.a}, b=${tc.args.b}`);
    });
  } else {
    console.log(`  ${m.content}`);
  }
});

