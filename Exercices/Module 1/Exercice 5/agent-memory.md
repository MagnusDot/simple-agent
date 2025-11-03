# Agent Memory - Agent avec Mémoire

Ce cours présente comment ajouter de la mémoire à un agent pour permettre des conversations multi-tours avec contexte persistant.

## Problème sans Mémoire

### État Transitoire

Par défaut, l'état d'un graphe est **transitoire** à une seule exécution :
- Chaque appel à `invoke()` part d'un état vide
- Le graphe ne se souvient pas des conversations précédentes
- Impossible de faire référence à des éléments d'une conversation précédente

**Exemple problématique :**
1. Premier appel : "Add 3 and 4." → Résultat : 7
2. Deuxième appel : "Multiply that by 2." → Le modèle ne sait pas ce qu'est "that" !

## Solution : Checkpointer (Mémoire)

### Concept

Un **checkpointer** sauvegarde automatiquement l'état du graphe après chaque étape :
- Les états sont sauvegardés dans des **threads**
- Chaque thread a un `thread_id` unique
- L'état peut être restauré en utilisant le même `thread_id`

### MemorySaver

`MemorySaver` est un checkpointer en mémoire (key-value store) :
- Simple à utiliser
- Stocke l'état dans la mémoire RAM
- Idéal pour le développement et les tests
- **Attention** : Les données sont perdues au redémarrage

```typescript
import { MemorySaver } from "@langchain/langgraph";

const memory = new MemorySaver();
const graph = builder.compile({ checkpointer: memory });
```

### Thread ID

Le `thread_id` identifie une conversation unique :
- Chaque conversation a son propre `thread_id`
- L'état est sauvegardé sous ce `thread_id`
- Utiliser le même `thread_id` restaure le contexte précédent

```typescript
const config = { configurable: { thread_id: "1" } };
const result = await graph.invoke({ messages: [...] }, config);
```

## Architecture

```
START → assistant → [condition] → tools → assistant → [condition] → END
                     ↓                              ↓
                   END                            END
                     
+ Checkpointer sauvegarde l'état après chaque étape
+ État restauré au prochain appel avec le même thread_id
```

## Flux avec Mémoire

### Premier Appel

1. **Invoke** avec `thread_id: "1"` et message "Add 3 and 4."
2. **assistant** → génère `tool_call` pour `add(3, 4)`
3. **tools** → exécute et crée ToolMessage avec résultat `7`
4. **assistant** → génère réponse "The sum of 3 and 4 is 7."
5. **Checkpointer** → **sauvegarde l'état** avec tous les messages dans le thread "1"

### Deuxième Appel (même thread_id)

1. **Invoke** avec `thread_id: "1"` et message "Multiply that by 2."
2. **Checkpointer** → **restaure l'état précédent** (incluant les messages précédents)
3. Le nouveau message est **ajouté** aux messages existants
4. **assistant** → voit tous les messages précédents, comprend que "that" = 7
5. **assistant** → génère `tool_call` pour `multiply(7, 2)`
6. **tools** → exécute et crée ToolMessage avec résultat `14`
7. **assistant** → génère réponse "The result of multiplying 7 by 2 is 14."
8. **Checkpointer** → **sauvegarde le nouvel état** avec tous les messages

## Comparaison

### Sans Mémoire

```typescript
// Premier appel
await graph.invoke({ messages: [new HumanMessage("Add 3 and 4.")] });
// État : [HumanMessage("Add 3 and 4."), AIMessage, ToolMessage, AIMessage]

// Deuxième appel - État vide !
await graph.invoke({ messages: [new HumanMessage("Multiply that by 2.")] });
// État : [HumanMessage("Multiply that by 2."), ...]
// Le modèle ne sait pas ce qu'est "that"
```

### Avec Mémoire

```typescript
const config = { configurable: { thread_id: "1" } };

// Premier appel
await graph.invoke(
  { messages: [new HumanMessage("Add 3 and 4.")] },
  config
);
// État sauvegardé dans thread "1"

// Deuxième appel - État restauré !
await graph.invoke(
  { messages: [new HumanMessage("Multiply that by 2.")] },
  config
);
// État : [tous les messages précédents + nouveau message]
// Le modèle sait que "that" = 7
```

## Utilisation Pratique

### Création d'un Checkpointer

```typescript
const memory = new MemorySaver();
const graph = builder.compile({ checkpointer: memory });
```

### Invocation avec Thread ID

```typescript
const config = { configurable: { thread_id: "unique-conversation-id" } };

// Premier message
await graph.invoke(
  { messages: [new HumanMessage("Hello!")] },
  config
);

// Messages suivants - contexte préservé
await graph.invoke(
  { messages: [new HumanMessage("What did I just say?")] },
  config
);
```

## Points Clés

1. **État transitoire** : Par défaut, l'état est perdu entre les appels
2. **Checkpointer** : Sauvegarde automatiquement l'état après chaque étape
3. **Thread ID** : Identifie une conversation unique
4. **MemorySaver** : Checkpointer simple en mémoire
5. **Contexte persistant** : Les messages précédents sont disponibles

## Avantages de la Mémoire

- **Conversations multi-tours** : Référencer des éléments précédents
- **Contexte continu** : Le modèle comprend l'historique
- **Flexibilité** : Multiples threads pour différentes conversations
- **Automatique** : Pas besoin de gérer manuellement l'historique

## Limitations de MemorySaver

- **Mémoire RAM** : Les données sont perdues au redémarrage
- **Pas de persistance** : Ne survit pas aux redémarrages du serveur
- **Développement** : Idéal pour tests, pas pour production

## Alternatives pour Production

- **PostgresCheckpointer** : Stockage dans PostgreSQL
- **SqliteCheckpointer** : Stockage dans SQLite
- **RedisCheckpointer** : Stockage dans Redis
- Autres systèmes de persistance selon les besoins

## Résumé

1. **Problème** : L'état est transitoire sans checkpointer
2. **Solution** : Utiliser un checkpointer (MemorySaver)
3. **Thread ID** : Identifie chaque conversation
4. **Avantage** : Conversations multi-tours avec contexte
5. **Limitation** : MemorySaver perd les données au redémarrage

