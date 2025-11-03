# Agent - Agent avec Boucle d'Outils

Ce cours présente comment construire un agent complet qui peut appeler des outils et ensuite utiliser leurs résultats pour générer une réponse finale.

## Architecture du Graphe

```
START → assistant → [condition] → tools → assistant → [condition] → END
                     ↓                              ↓
                   END                            END
```

## Concepts Clés

### 1. Agent vs Router

Contrairement au router qui s'arrête après l'exécution des outils, un **agent** :
- Appelle les outils si nécessaire
- **Revient à l'assistant** après l'exécution des outils
- Permet au LLM de générer une réponse finale basée sur les résultats des outils

### 2. Boucle Assistant → Tools → Assistant

Le pattern clé est la boucle :
1. **Assistant** : Le LLM génère une réponse ou des tool_calls
2. **Condition** : Si tool_calls → va vers tools, sinon → END
3. **Tools** : Exécute les outils et crée des ToolMessages
4. **Assistant** : Revient à l'assistant qui peut maintenant utiliser les résultats
5. **Condition** : Répète jusqu'à ce que l'assistant génère une réponse finale (sans tool_calls)

```typescript
builder.addEdge("tools", "assistant"); // Boucle de retour
```

### 3. Message Système

Un `SystemMessage` peut être utilisé pour donner des instructions au modèle :

```typescript
const sysMsg = new SystemMessage({
  content: "You are a helpful assistant tasked with performing arithmetic on a set of inputs.",
});
```

Le message système est inclus dans chaque appel au LLM :

```typescript
async function assistant(state: MessagesState) {
  const result = await llmWithTools.invoke([sysMsg, ...state.messages]);
  return { messages: [result] };
}
```

### 4. Multiple Outils

L'agent peut utiliser plusieurs outils :

```typescript
const addTool = tool(/* ... */);
const multiplyTool = tool(/* ... */);
const divideTool = tool(/* ... */);

const tools = [addTool, multiplyTool, divideTool];
```

Le LLM choisira automatiquement quel(s) outil(s) utiliser selon la tâche.

### 5. Construction du Graphe

Le graphe se construit avec :

1. **Nœud assistant** : Appelle le LLM avec les outils
2. **Nœud tools** : Exécute les outils (ToolNode)
3. **Arête START → assistant** : Démarre avec l'assistant
4. **Arête conditionnelle assistant** : Route vers tools ou END
5. **Arête tools → assistant** : **Boucle de retour** (crucial pour l'agent)

```typescript
builder.addNode("assistant", assistant);
builder.addNode("tools", new ToolNode(tools));
builder.addEdge(START, "assistant");
builder.addConditionalEdges("assistant", toolsCondition);
builder.addEdge("tools", "assistant"); // Boucle !
```

## Flux d'Exécution

### Scénario : Calcul multi-étapes

**Requête** : "What is 10 plus 5, then multiply that by 2, then divide by 3?"

1. **assistant** : Analyse la requête → génère `tool_call` pour `add(10, 5)`
2. **toolsCondition** : Détecte tool_call → route vers `tools`
3. **tools** : Exécute `add(10, 5)` → crée ToolMessage avec résultat `15`
4. **assistant** : Reçoit ToolMessage → génère `tool_call` pour `multiply(15, 2)`
5. **toolsCondition** : Détecte tool_call → route vers `tools`
6. **tools** : Exécute `multiply(15, 2)` → crée ToolMessage avec résultat `30`
7. **assistant** : Reçoit ToolMessage → génère `tool_call` pour `divide(30, 3)`
8. **toolsCondition** : Détecte tool_call → route vers `tools`
9. **tools** : Exécute `divide(30, 3)` → crée ToolMessage avec résultat `10`
10. **assistant** : Reçoit ToolMessage → génère réponse finale : "The result is 10"
11. **toolsCondition** : Pas de tool_call → route vers END

## Résumé

1. **Agent** : Pattern avec boucle assistant → tools → assistant
2. **SystemMessage** : Instructions données au modèle à chaque appel
3. **Multiple outils** : L'agent peut utiliser plusieurs outils en séquence
4. **Boucle** : L'arête `tools → assistant` permet de revenir à l'assistant
5. **Réponse finale** : L'agent génère une réponse après avoir utilisé les outils

## Points à Retenir

- **Différence clé avec router** : L'agent revient à l'assistant après les outils
- La boucle permet des calculs/actions multi-étapes
- Le message système guide le comportement du modèle
- L'agent continue jusqu'à une réponse finale (sans tool_calls)
- Les ToolMessages sont ajoutés automatiquement à l'état

## Avantages de l'Agent

- **Flexibilité** : Peut enchaîner plusieurs appels d'outils
- **Compréhension** : Le LLM peut utiliser les résultats pour générer une réponse naturelle
- **Robustesse** : Peut gérer des tâches complexes nécessitant plusieurs étapes
- **Extensibilité** : Facile d'ajouter de nouveaux outils

## Cas d'Usage

- **Calculs complexes** : Enchaîner plusieurs opérations
- **Recherche d'informations** : Appeler plusieurs APIs puis synthétiser
- **Tâches séquentielles** : Actions qui dépendent les unes des autres
- **Validation** : Vérifier avec un outil puis répondre

