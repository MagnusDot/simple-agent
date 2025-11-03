# Router - Routage avec Outils

Ce cours présente comment construire un router qui utilise des outils de manière conditionnelle dans un graphe LangGraph.

## Architecture du Graphe

```
START → tool_calling_llm → [condition] → tools (si outil appelé) → END
                              ↓
                            END (si pas d'outil)
```

## Concepts Clés

### 1. Routage Conditionnel

Un router est un pattern où le modèle de chat route entre :
- Une réponse directe en langage naturel
- Un appel d'outil

C'est un exemple simple d'agent, où le LLM dirige le flux de contrôle soit en appelant un outil, soit en répondant directement.

### 2. Composants Pré-construits

LangGraph fournit des composants pré-construits pour faciliter la création de routers :

#### ToolNode

`ToolNode` est un nœud pré-construit qui exécute automatiquement les appels d'outils détectés dans les messages.

- Prend une liste d'outils en paramètre
- Détecte automatiquement les `tool_calls` dans les messages
- Exécute chaque outil avec les arguments appropriés
- Crée des `ToolMessage` avec les résultats

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

builder.addNode("tools", new ToolNode([multiplyTool]));
```

#### tools_condition

`toolsCondition` est une fonction conditionnelle pré-construite qui route automatiquement :
- Vers le nœud `tools` si le dernier message contient des `tool_calls`
- Vers `END` si le dernier message ne contient pas de `tool_calls`

```typescript
import { toolsCondition } from "@langchain/langgraph/prebuilt";

builder.addConditionalEdges(
  "tool_calling_llm",
  toolsCondition
);
```

### 3. Construction du Graphe

Le graphe router se construit en 4 étapes :

1. **Nœud LLM** : Appelle le modèle avec outils liés
2. **Nœud Tools** : Exécute les outils si nécessaire (via ToolNode)
3. **Arête conditionnelle** : Route depuis le LLM vers tools ou END (via toolsCondition)
4. **Arête finale** : Depuis tools vers END

```typescript
builder.addNode("tool_calling_llm", toolCallingLlm);
builder.addNode("tools", new ToolNode([multiplyTool]));
builder.addEdge(START, "tool_calling_llm");
builder.addConditionalEdges("tool_calling_llm", toolsCondition);
builder.addEdge("tools", END);
```

### 4. Flux d'Exécution

#### Scénario 1 : Message simple (sans outil)

1. Utilisateur : "Hello world."
2. `tool_calling_llm` : LLM répond directement
3. `toolsCondition` : Pas de tool_calls → route vers END
4. Fin avec réponse en langage naturel

#### Scénario 2 : Message nécessitant un outil

1. Utilisateur : "What is 2 multiplied by 2?"
2. `tool_calling_llm` : LLM génère un tool_call
3. `toolsCondition` : Détecte tool_calls → route vers `tools`
4. `tools` : Exécute multiply(2, 2) et crée ToolMessage
5. Fin avec ToolMessage contenant le résultat

## Résumé

1. **Router** : Pattern qui route entre réponse directe ou appel d'outil
2. **ToolNode** : Nœud pré-construit qui exécute automatiquement les outils
3. **toolsCondition** : Fonction conditionnelle qui route vers tools ou END
4. **Flux conditionnel** : Le graphe s'adapte automatiquement selon la sortie du LLM

## Points à Retenir

- Le LLM décide automatiquement quand appeler un outil
- ToolNode simplifie l'exécution des outils
- toolsCondition simplifie le routage conditionnel
- Le graphe peut gérer les deux cas (avec et sans outil) automatiquement
- Les ToolMessage sont créés automatiquement par ToolNode

## Avantages du Router

- **Flexibilité** : Gère à la fois les conversations normales et les appels d'outils
- **Simplicité** : Utilise des composants pré-construits
- **Extensibilité** : Facile d'ajouter plus d'outils
- **Automatique** : Le routage se fait sans code supplémentaire

