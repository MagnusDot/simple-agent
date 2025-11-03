# Chatbot with Summarization - Chatbot avec Résumé de Conversation

Ce cours explique comment créer un chatbot qui utilise un **résumé de conversation** pour gérer des conversations longues tout en conservant le contexte sans accumuler trop de tokens.

## Vue d'ensemble

Au lieu de simplement **trier** ou **filtrer** les messages (comme dans l'exercice précédent), on utilise un LLM pour produire un **résumé en cours d'exécution** de la conversation. Cela permet de :

1. **Retenir une représentation compressée** de la conversation complète
2. **Réduire l'utilisation de tokens** en supprimant les anciens messages
3. **Maintenir le contexte** grâce au résumé
4. **Supporter des conversations longues** sans latence élevée

## État avec Messages et Résumé

Le graphe utilise un état qui étend `MessagesState` avec un champ supplémentaire `summary` :

```typescript
type State = {
  messages: BaseMessage[];
  summary: string;
};
```

### Reducers

- **Messages** : Utilise `addMessages` qui gère l'ajout, la réécriture et la suppression de messages
- **Summary** : Utilise un reducer simple qui écrase la valeur

## Architecture du Graphe

Le graphe a la structure suivante :

```
START → conversation → [should_continue] → summarize_conversation → END
                                ↓
                               END
```

### Nœuds

1. **`conversation`** : Appelle le modèle LLM avec les messages et le résumé (si présent)
2. **`summarize_conversation`** : Génère un résumé de la conversation et supprime les anciens messages

### Arête conditionnelle

**`should_continue`** : Détermine si on doit résumer (> 6 messages) ou terminer

## Nœud : Appeler le Modèle

Le nœud `call_model` incorpore le résumé (s'il existe) dans un message système :

```typescript
async function call_model(state: State): Promise<Partial<State>> {
  const summary = state.summary || "";
  
  let messages: BaseMessage[];
  
  if (summary) {
    // Ajouter le résumé comme message système
    const systemMessage = new SystemMessage({
      content: `Summary of conversation earlier: ${summary}`,
    });
    messages = [systemMessage, ...state.messages];
  } else {
    messages = state.messages;
  }
  
  const response = await model.invoke(messages);
  return { messages: [response] };
}
```

**Avantages :**
- Le modèle a accès au contexte de la conversation précédente
- Pas besoin de garder tous les anciens messages
- Réduction significative de l'utilisation de tokens

## Nœud : Résumer la Conversation

Le nœud `summarize_conversation` :

1. **Génère un résumé** en utilisant le LLM
2. **Supprime les anciens messages** (sauf les 2 plus récents) avec `RemoveMessage`

```typescript
async function summarize_conversation(state: State): Promise<Partial<State>> {
  const existingSummary = state.summary || "";
  
  // Créer le prompt de résumé
  let summaryPrompt: string;
  if (existingSummary) {
    // Étendre le résumé existant
    summaryPrompt = `This is summary of the conversation to date: ${existingSummary}\n\nExtend the summary by taking into account the new messages above:`;
  } else {
    // Créer un nouveau résumé
    summaryPrompt = "Create a summary of the conversation above:";
  }
  
  // Appeler le modèle pour générer le résumé
  const messagesWithPrompt = [...state.messages, new HumanMessage({ content: summaryPrompt })];
  const response = await model.invoke(messagesWithPrompt);
  const newSummary = typeof response.content === "string" ? response.content : "";
  
  // Supprimer les anciens messages (sauf les 2 plus récents)
  const messagesToKeep = state.messages.slice(-2);
  const messagesToRemove = state.messages.slice(0, -2);
  
  const removeMessages = messagesToRemove.map((m) => new RemoveMessage({ id: m.id || "" }));
  
  return {
    summary: newSummary,
    messages: removeMessages,
  };
}
```

**Fonctionnement :**
1. Si un résumé existe déjà, on l'étend avec les nouveaux messages
2. Sinon, on crée un nouveau résumé
3. On garde seulement les 2 messages les plus récents
4. On supprime les autres avec `RemoveMessage`

## Arête Conditionnelle : Décider de Résumer

La fonction `should_continue` détermine si on doit résumer la conversation :

```typescript
function should_continue(state: State): NextNode {
  const messages = state.messages;
  
  // Si plus de 6 messages, résumer
  if (messages.length > 6) {
    return "summarize_conversation";
  }
  
  // Sinon, terminer
  return END;
}
```

**Seuil de résumé :**
- **> 6 messages** : Déclenche le résumé
- **≤ 6 messages** : Termine normalement

Ce seuil peut être ajusté selon les besoins (par exemple, basé sur le nombre de tokens plutôt que de messages).

## Mémoire avec MemorySaver

Pour supporter des **conversations multi-tours avec interruptions**, on utilise `MemorySaver` :

```typescript
const memory = new MemorySaver();
export const graph = builder.compile({ checkpointer: memory });
```

### Threads

Les checkpoints sont groupés dans un **thread** de conversation. C'est comme un canal Slack : différents threads capturent différentes conversations.

Pour utiliser un thread :

```typescript
const config = { configurable: { thread_id: "1" } };

// Premier message
await graph.invoke(
  { messages: [new HumanMessage({ content: "hi! I'm Lance" })], summary: "" },
  config
);

// Deuxième message (dans le même thread)
await graph.invoke(
  { messages: [new HumanMessage({ content: "what's my name?" })], },
  config
);
```

**Avantages :**
- Le contexte est préservé entre les appels
- Le résumé est maintenu dans le thread
- On peut reprendre la conversation à n'importe quel moment

## Flux d'Exécution

### Conversation courte (≤ 6 messages)

1. `conversation` → Appelle le modèle avec les messages
2. `should_continue` → Retourne `END` (≤ 6 messages)
3. **Fin**

### Conversation longue (> 6 messages)

1. `conversation` → Appelle le modèle avec les messages
2. `should_continue` → Retourne `"summarize_conversation"` (> 6 messages)
3. `summarize_conversation` → Génère un résumé et supprime les anciens messages
4. **Fin**

### Conversation suivante (avec thread)

1. `conversation` → Appelle le modèle avec :
   - Le résumé précédent (comme message système)
   - Les messages récents (seulement les 2 gardés)
   - Le nouveau message de l'utilisateur
2. Le modèle a accès au contexte complet via le résumé

## Avantages du Résumé vs Tri/Filter

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| **Tri/Filter** | Simple, rapide | Perte d'information |
| **Résumé** | Conserve le contexte, représentation compressée | Coût additionnel (appel LLM pour résumer) |

Le résumé est particulièrement utile pour :
- **Conversations longues** où on veut garder le contexte complet
- **Références à des éléments antérieurs** dans la conversation
- **Réduction de tokens** sans perte d'information importante

## Cas d'Usage

1. **Chatbots de support client** : Résumer l'historique des problèmes
2. **Assistants conversationnels** : Maintenir le contexte sur plusieurs tours
3. **Agents de recherche** : Conserver les découvertes précédentes
4. **Tuteurs intelligents** : Se souvenir des concepts déjà expliqués

## Résumé

- **État étendu** : `MessagesState` + champ `summary`
- **Nœud de résumé** : Génère un résumé avec le LLM et supprime les anciens messages
- **Arête conditionnelle** : Détermine quand résumer (> 6 messages)
- **Mémoire** : Utilise `MemorySaver` avec `thread_id` pour la persistance
- **Avantages** : Contexte préservé, réduction de tokens, conversations longues supportées

