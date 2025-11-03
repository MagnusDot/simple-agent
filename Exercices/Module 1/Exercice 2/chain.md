# Chain - Chaîne avec Messages et Outils

Ce cours présente comment construire une chaîne simple qui combine 4 concepts importants en utilisant LangGraph avec TypeScript :

1. Utiliser les **messages** comme état du graphe
2. Utiliser des **modèles de chat** dans les nœuds du graphe
3. **Lier des outils** à notre modèle de chat
4. **Exécuter des appels d'outils** dans les nœuds du graphe

## Architecture du Graphe

```
START → tool_calling_llm → END
```

## Concepts Clés

### 1. Messages

Les modèles de chat utilisent des **messages** qui capturent différents rôles dans une conversation.

**Types de messages supportés par LangChain :**
- `HumanMessage` : Message de l'utilisateur
- `AIMessage` : Message du modèle de chat
- `SystemMessage` : Instructions pour le modèle (comportement)
- `ToolMessage` : Message provenant d'un appel d'outil

**Propriétés d'un message :**
- `content` : Contenu du message (obligatoire)
- `name` : Auteur du message (optionnel)
- `response_metadata` : Métadonnées (souvent rempli par le fournisseur du modèle pour les `AIMessage`)

```typescript
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const messages = [
  new AIMessage({ content: "Hello!", name: "Model" }),
  new HumanMessage({ content: "Hi there!", name: "User" }),
];
```

### 2. Modèles de Chat

Les modèles de chat utilisent une séquence de messages en entrée et supportent les types de messages discutés ci-dessus.

Il existe de nombreux modèles disponibles. Ici, nous utilisons **OpenAI**.

**Configuration :**
- Vérifier que `OPENAI_API_KEY` est défini dans l'environnement
- Créer une instance de `ChatOpenAI`
- Invoker le modèle avec une liste de messages

```typescript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4o" });
const result = await llm.invoke(messages);
// Le résultat est un AIMessage avec response_metadata
```

**Point important** : Le résultat est un `AIMessage` avec des métadonnées spécifiques (utilisation de tokens, modèle utilisé, etc.).

### 3. Outils (Tools)

Les outils sont utiles quand on veut qu'un modèle interagisse avec des systèmes externes.

**Pourquoi utiliser des outils ?**
- Les systèmes externes (ex: APIs) nécessitent souvent un schéma d'entrée ou un payload spécifique, plutôt que du langage naturel
- Quand on lie une API comme outil, on donne au modèle la connaissance du schéma d'entrée requis
- Le modèle choisira d'appeler un outil basé sur l'entrée en langage naturel de l'utilisateur
- Il retournera une sortie qui adhère au schéma de l'outil

**Interface simple :**
- Passer n'importe quelle fonction TypeScript dans `tool()`
- Utiliser `llm.bindTools([tool])` pour lier l'outil au modèle

```typescript
import { tool } from "@langchain/core/tools";

function multiply(a: number, b: number): number {
  return a * b;
}

const multiplyTool = tool(multiply, {
  name: "multiply",
  description: "Multiplie deux nombres entiers",
  schema: { /* schéma JSON pour validation */ }
});

const llmWithTools = llm.bindTools([multiplyTool]);
```

**Appel d'outil :**
Quand on passe une entrée comme `"What is 2 multiplied by 3"`, le modèle retourne un appel d'outil avec :
- `name` : Nom de la fonction à appeler
- `args` : Arguments qui correspondent au schéma d'entrée de notre fonction
- `id` : Identifiant unique de l'appel

```typescript
const result = await llmWithTools.invoke([
  new HumanMessage({ content: "What is 2 multiplied by 3" })
]);
// result.tool_calls contient : [{ name: 'multiply', args: { a: 2, b: 3 }, id: '...' }]
```

### 4. Utiliser les Messages comme État

Avec ces fondations en place, on peut maintenant utiliser les messages dans l'état de notre graphe.

**Définir l'état :**
En TypeScript, LangGraph fournit `MessagesState` qui est un état pré-construit avec :
- Une clé `messages` qui est une liste de messages
- Utilise le reducer `add_messages` pour ajouter des messages au lieu de les écraser

**Pourquoi un reducer ?**
- Par défaut, chaque nœud retourne une nouvelle valeur qui **écrase** la valeur précédente de l'état
- Pour les messages, on veut **ajouter** des messages à la liste existante
- Le reducer `add_messages` spécifie comment les mises à jour sont effectuées

```typescript
import { MessagesState, addMessagesReducer } from "@langchain/langgraph";

const builder = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessagesReducer, // Ajoute les messages au lieu de les écraser
    },
  },
});
```

### 5. Construction du Graphe

On construit un graphe simple avec un nœud qui appelle le LLM avec les outils liés.

**Nœud `tool_calling_llm` :**
- Reçoit l'état avec les messages
- Invoke le modèle avec les outils liés
- Retourne un nouveau message (AIMessage qui peut contenir des tool_calls)

```typescript
async function toolCallingLlm(state: MessagesState) {
  const result = await llmWithTools.invoke(state.messages);
  return { messages: [result] };
}
```

**Construction du graphe :**
- Ajouter le nœud
- Ajouter les arêtes : START → tool_calling_llm → END
- Compiler le graphe

```typescript
builder.addNode("tool_calling_llm", toolCallingLlm);
builder.addEdge(START, "tool_calling_llm");
builder.addEdge("tool_calling_llm", END);
const graph = builder.compile();
```

### 6. Exécution du Graphe

Le graphe peut être invoqué avec différents types de messages.

**Sans appel d'outil :**
Si on passe `"Hello!"`, le LLM répond sans appel d'outil.

```typescript
const result = await graph.invoke({
  messages: [new HumanMessage({ content: "Hello!" })]
});
// result.messages contient : [HumanMessage, AIMessage]
```

**Avec appel d'outil :**
Si on passe `"Multiply 2 and 3!"`, le LLM choisit d'utiliser l'outil.

Le LLM choisit d'utiliser un outil quand il détermine que l'entrée ou la tâche nécessite la fonctionnalité fournie par cet outil.

```typescript
const result = await graph.invoke({
  messages: [new HumanMessage({ content: "Multiply 2 and 3!" })]
});
// result.messages contient : [HumanMessage, AIMessage avec tool_calls]
```

## Résumé

1. **Messages** : Représentent différents rôles dans une conversation (Human, AI, System, Tool)
2. **Modèles de Chat** : Utilisent une séquence de messages en entrée et retournent des AIMessage
3. **Outils** : Permettent au modèle d'interagir avec des systèmes externes via des appels structurés
4. **MessagesState** : État pré-construit avec un reducer qui ajoute les messages au lieu de les écraser
5. **Graphe** : Exécute le modèle avec outils liés, permettant des appels d'outils conditionnels

## Points à Retenir

- Les messages sont ajoutés à l'état, pas écrasés (grâce au reducer `add_messages`)
- Le modèle décide automatiquement quand appeler un outil basé sur l'entrée
- Les appels d'outils sont contenus dans les `tool_calls` de l'`AIMessage`
- Le schéma de l'outil guide le modèle pour générer les arguments corrects
- Ce graphe simple ne fait qu'appeler le modèle avec outils, mais ne les exécute pas encore

## Prochaine Étape

Pour exécuter réellement les outils et retourner les résultats au modèle, il faudrait ajouter un nœud supplémentaire qui :
1. Détecte les `tool_calls` dans l'AIMessage
2. Exécute chaque outil avec ses arguments
3. Crée des `ToolMessage` avec les résultats
4. Retourne ces messages au modèle pour génération de la réponse finale

