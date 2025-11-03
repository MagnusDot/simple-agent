import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const weather = tool(
  async ({ ville }) => {
    try {
      const url = `https://wttr.in/${encodeURIComponent(ville)}?format=j1&lang=fr`;      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'curl/7.68.0' 
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return `❌ Ville "${ville}" non trouvée. Vérifiez l'orthographe.`;
        }
        throw new Error(`Erreur API: ${response.status}`);
      }
      return await response.json();
      
    } catch (error) {
      console.error('Erreur météo:', error);
      return `❌ Impossible de récupérer la météo pour "${ville}". Vérifiez le nom de la ville.`;
    }
  },
  {
    name: "weather",
    description: "Obtient les informations météo en temps réel pour une ville donnée (service gratuit sans clé API)",
    schema: z.object({
      ville: z.string().describe("Le nom de la ville pour laquelle obtenir la météo (ex: Paris, London, Tokyo)"),
    }),
  }
); 