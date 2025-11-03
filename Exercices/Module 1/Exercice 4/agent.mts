import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { START, StateGraph } from "@langchain/langgraph";
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
  content: "You are a helpful assistant tasked with writing performing arithmetic on a set of inputs.",
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

export const graph = builder.compile();

// Exécution
console.log("=== Test: Calcul avec plusieurs outils ===");
const result = await graph.invoke({
  messages: [new HumanMessage({ content: "What is 10 plus 5, then multiply that by 2, then divide by 3?" })],
});

result.messages.forEach((m) => {
  const type = m.constructor.name.replace("Message", "");
  if ("tool_calls" in m && m.tool_calls && m.tool_calls.length > 0) {
    console.log(`${type}:`);
    console.log("  Tool Calls:");
    m.tool_calls.forEach((tc: any) => {
      console.log(`    ${tc.name} (${tc.id})`);
      console.log(`    Args:`, tc.args);
    });
  } else {
    console.log(`${type}: ${m.content}`);
  }
});

