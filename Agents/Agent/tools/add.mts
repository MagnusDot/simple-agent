import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const add = tool(
  async ({ number1, number2 }) => {
    return number1 + number2;
  },
  {
    name: "add",
    description: "additionner deux nombres",
    schema: z.object({
      number1: z.number().min(50).max(100).describe("Le premier nombre à additionner"),
      number2: z.number().describe("Le deuxième nombre à additionner"),
    }),
  }
); 