# Trim and Filter Messages - Trier et Filtrer les Messages

Ce cours explique comment gérer efficacement les messages dans un graphe LangGraph, notamment pour gérer les conversations longues et limiter l'utilisation de tokens.

## Vue d'ensemble

Quand on travaille avec des conversations longues, plusieurs défis apparaissent :

1. **Croissance de l'historique** : Plus la conversation est longue, plus la liste de messages grandit
2. **Utilisation de tokens** : Chaque message augmente le nombre de tokens envoyés au modèle
3. **Latence** : Plus il y a de tokens, plus l'appel au modèle est lent et coûteux
4. **Limites de contexte** : Les modèles ont une limite de tokens (ex: 128k pour GPT-4)

## Messages comme État

Dans LangGraph, les messages peuvent être utilisés directement comme état du graphe avec le reducer `add_messages`.

```typescript
type MessagesState = {
  messages: BaseMessage[];
};

function addMessages(
  current: BaseMessage[],
  update: BaseMessage | BaseMessage[]
): BaseMessage[] {
  // Logique pour ajouter ou remplacer des messages
}
```

**Avantages :**
- Simple à utiliser
- Historique complet préservé
- Compatible avec tous les modèles de chat

**Inconvénients :**
- L'historique peut devenir très long
- Utilisation excessive de tokens

## 1. Suppression de Messages avec Reducer

### Concept

On peut supprimer des messages anciens de l'état du graphe en utilisant un nœud de filtrage qui ne garde que les messages récents.

```typescript
function filterMessages(state: MessagesState): Partial<MessagesState> {
  // Garder seulement les 2 messages les plus récents
  const recentMessages = state.messages.slice(-2);
  return { messages: recentMessages };
}
```

**Architecture du graphe :**
```
START → filter → chat_model → END
```

**Fonctionnement :**
1. Le nœud `filter` réduit l'état à seulement les N derniers messages
2. Le nœud `chat_model` reçoit ces messages filtrés
3. L'état du graphe est mis à jour avec seulement les messages récents

**Avantages :**
- Réduit efficacement l'utilisation de tokens
- Simple à implémenter
- Contrôle précis du nombre de messages

**Inconvénients :**
- **Perte d'information** : Les messages anciens sont supprimés de l'état
- Les messages supprimés ne sont plus accessibles pour d'autres nœuds

### Exemple d'utilisation

```typescript
const builder = new StateGraph<MessagesState>({
  channels: {
    messages: {
      default: () => [],
      reducer: addMessages,
    },
  },
});

builder.addNode("filter", filterMessages);
builder.addNode("chat_model", chatModelNode);
builder.addEdge(START, "filter");
builder.addEdge("filter", "chat_model");
builder.addEdge("chat_model", END);
```

## 2. Filtrage des Messages Passés au Modèle

### Concept

Au lieu de modifier l'état du graphe, on peut simplement **filtrer les messages** qu'on passe au modèle. L'état complet est préservé, mais le modèle ne reçoit qu'un sous-ensemble.

```typescript
async function chatModelNodeWithSlice(state: MessagesState) {
  // Passer seulement le dernier message au modèle
  const lastMessage = state.messages.slice(-1);
  const result = await llm.invoke(lastMessage);
  return { messages: [result] };
}
```

**Avantages :**
- ✅ **Préserve l'historique complet** : Tous les messages restent dans l'état
- ✅ **Pas de perte d'information** : D'autres nœuds peuvent accéder à tous les messages
- ✅ **Flexible** : On peut changer facilement la stratégie de filtrage

**Inconvénients :**
- L'état peut devenir très grand (mais c'est acceptable si on veut préserver l'historique)

### Cas d'usage

**Utile quand :**
- On veut préserver l'historique complet pour d'autres nœuds
- On veut permettre à d'autres systèmes d'accéder à tout l'historique
- On utilise une stratégie de "sliding window" où on veut garder le contexte complet

## 3. Trimming de Messages (Basé sur les Tokens)

### Concept

Le **trimming** permet de limiter les messages à un **nombre maximum de tokens**, en gardant automatiquement les messages les plus récents qui rentrent dans la limite.

```typescript
import { trimMessages } from "@langchain/core/messages";

async function chatModelNodeWithTrim(state: MessagesState) {
  const trimmed = await trimMessages(state.messages, {
    maxTokens: 100,
    strategy: "last", // Garder les derniers messages
    tokenCounter: llm, // Utiliser le même modèle pour compter les tokens
    allowPartial: false, // Ne pas couper un message en deux
  });
  
  const result = await llm.invoke(trimmed);
  return { messages: [result] };
}
```

### Paramètres de `trimMessages`

- **`maxTokens`** : Nombre maximum de tokens à garder
- **`strategy`** : Stratégie de trimming
  - `"last"` : Garde les messages les plus récents
  - `"first"` : Garde les messages les plus anciens
- **`tokenCounter`** : Modèle ou fonction pour compter les tokens
- **`allowPartial`** : Si `true`, peut couper un message en deux pour respecter la limite

**Avantages :**
- ✅ **Précision** : Basé sur les tokens, pas sur le nombre de messages
- ✅ **Respect des limites** : Garantit que le nombre de tokens ne dépasse pas la limite
- ✅ **Automatique** : Garde automatiquement les messages les plus récents

**Inconvénients :**
- Nécessite un modèle ou compteur de tokens pour fonctionner
- Peut être plus lent (comptage de tokens)

### Comparaison : Messages vs Tokens

**Limiter par nombre de messages :**
```typescript
const recent = messages.slice(-5); // 5 derniers messages
```
- ❌ Peut dépasser la limite de tokens si les messages sont longs
- ✅ Simple à implémenter

**Limiter par tokens :**
```typescript
const trimmed = await trimMessages(messages, { maxTokens: 1000 });
```
- ✅ Respecte toujours la limite de tokens
- ✅ Plus précis
- ❌ Nécessite un compteur de tokens

## Comparaison des Approches

| Approche | Modifie l'état | Préserve l'historique | Basé sur tokens | Complexité |
|----------|----------------|----------------------|-----------------|------------|
| **Filtrage avec reducer** | ✅ Oui | ❌ Non | ❌ Non | ⭐ Simple |
| **Filtrage avec slice** | ❌ Non | ✅ Oui | ❌ Non | ⭐ Simple |
| **Trimming avec tokens** | ❌ Non | ✅ Oui | ✅ Oui | ⭐⭐ Moyen |

## Choix de la Stratégie

### Utiliser le filtrage avec reducer quand :
- ✅ On veut nettoyer l'historique
- ✅ On n'a pas besoin des messages anciens
- ✅ On veut contrôler précisément le nombre de messages

### Utiliser le filtrage avec slice quand :
- ✅ On veut préserver l'historique complet
- ✅ D'autres nœuds ont besoin d'accéder à tous les messages
- ✅ La taille de l'état n'est pas un problème

### Utiliser le trimming avec tokens quand :
- ✅ On doit respecter une limite stricte de tokens
- ✅ Les messages ont des longueurs variables
- ✅ On veut optimiser l'utilisation du contexte

## Bonnes Pratiques

### 1. Choisir une stratégie cohérente

Définissez clairement votre stratégie et utilisez-la de manière cohérente :

```typescript
// Stratégie : Garder toujours les 3 derniers messages
const KEEP_MESSAGES = 3;

function filterMessages(state: MessagesState): Partial<MessagesState> {
  return { messages: state.messages.slice(-KEEP_MESSAGES) };
}
```

### 2. Documenter la stratégie

Documentez pourquoi vous utilisez une stratégie spécifique :

```typescript
/**
 * Filtre les messages pour garder seulement les 5 derniers.
 * Cela réduit l'utilisation de tokens tout en préservant
 * le contexte récent de la conversation.
 */
function filterRecentMessages(state: MessagesState): Partial<MessagesState> {
  return { messages: state.messages.slice(-5) };
}
```

### 3. Utiliser le trimming pour les limites strictes

Quand vous devez respecter une limite stricte de tokens :

```typescript
async function ensureTokenLimit(state: MessagesState) {
  const trimmed = await trimMessages(state.messages, {
    maxTokens: MAX_TOKENS - 500, // Laisser une marge pour la réponse
    strategy: "last",
    tokenCounter: llm,
    allowPartial: false,
  });
  return trimmed;
}
```

### 4. Combiner les approches

Vous pouvez combiner plusieurs approches :

```typescript
async function smartFiltering(state: MessagesState) {
  // D'abord, garder seulement les N derniers messages (réduction rapide)
  let filtered = state.messages.slice(-10);
  
  // Ensuite, trimmer selon les tokens (précision)
  const trimmed = await trimMessages(filtered, {
    maxTokens: 2000,
    strategy: "last",
    tokenCounter: llm,
    allowPartial: false,
  });
  
  return trimmed;
}
```

## Résumé

1. **Messages comme état** : Utilisez `MessagesState` avec `add_messages` reducer
2. **Filtrage avec reducer** : Modifie l'état pour ne garder que les messages récents
3. **Filtrage avec slice** : Préserve l'état complet mais passe seulement un sous-ensemble au modèle
4. **Trimming avec tokens** : Limite basée sur les tokens, plus précis mais nécessite un compteur

## Points à Retenir

- ✅ Utilisez le filtrage avec reducer pour nettoyer l'historique
- ✅ Utilisez le filtrage avec slice pour préserver l'historique complet
- ✅ Utilisez le trimming avec tokens pour respecter des limites strictes
- ⚠️ Choisissez votre stratégie selon vos besoins (préserver vs nettoyer)
- ⚠️ Le trimming nécessite un compteur de tokens (modèle ou fonction)

