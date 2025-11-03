import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { z } from "zod";

// Outil
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

// Modèle avec outils
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement");
}

const llm = new ChatOpenAI({ model: "gpt-4o" });
const llmWithTools = llm.bindTools([multiplyTool]);

// État avec messages
type MessagesState = {
  messages: BaseMessage[];
};

function addMessages(current: BaseMessage[], update: BaseMessage | BaseMessage[]): BaseMessage[] {
  const messagesToAdd = Array.isArray(update) ? update : [update];
  return [...current, ...messagesToAdd];
}

// Nœud LLM
async function toolCallingLlm(state: MessagesState) {
  const result = await llmWithTools.invoke(state.messages);
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

builder.addNode("tool_calling_llm", toolCallingLlm);
builder.addNode("tools", new ToolNode([multiplyTool]));
builder.addEdge(START as any, "tool_calling_llm" as any);
builder.addConditionalEdges(
  "tool_calling_llm" as any,
  toolsCondition as any
);
builder.addEdge("tools" as any, END as any);

export const graph = builder.compile();

// Exécution
console.log("=== Test 1: Message simple ===");
const result1 = await graph.invoke({
  messages: [new HumanMessage({ content: "Hello world." })],
});
result1.messages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  console.log(`${type}: ${m.content}`);
});

console.log("\n=== Test 2: Avec appel d'outil ===");
const result2 = await graph.invoke({
  messages: [new HumanMessage({ content: "Hello, what is 2 multiplied by 2?" })],
});
result2.messages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  if ("tool_calls" in m && m.tool_calls && m.tool_calls.length > 0) {
    console.log(`${type}:`);
    console.log("  Tool Calls:");
    m.tool_calls.forEach((tc: any) => {
      console.log(`    ${tc.name} (${tc.id})`);
      console.log(`    Args: a=${tc.args.a}, b=${tc.args.b}`);
    });
  } else {
    console.log(`${type}: ${m.content}`);
  }
});

