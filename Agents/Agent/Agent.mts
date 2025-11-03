import 'dotenv/config';

import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { loadAgentPrompt } from "./generate_prompt.mts";
import { weather } from "./tools/weather.mts";
import { add } from "./tools/add.mts";

const agentPrompt = loadAgentPrompt('Agent');

/*const agentModel = new ChatOpenAI({ 
  temperature: 0.5,
  model: "dolphin3.0-llama3.1-8b", // ou le nom de votre modèle
  configuration: {
    baseURL: "http://localhost:1234/v1",
    apiKey: "not-needed", // LMStudio ne nécessite pas de clé API réelle
  }
});*/

const agentModel = new ChatOpenAI({ temperature: 0.5, model: "gpt-4o-mini" });

const agentCheckpointer = new MemorySaver();
export const agent = createReactAgent({
  prompt: agentPrompt,
  llm: agentModel,
  tools: [weather, add],
  checkpointSaver: agentCheckpointer,
});
