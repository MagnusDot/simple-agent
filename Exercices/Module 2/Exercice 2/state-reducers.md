# State Reducers

Ce cours explique comment gérer les mises à jour d'état dans LangGraph avec des **reducers**. Les reducers spécifient comment les mises à jour sont effectuées sur des clés spécifiques de l'état.

## Problème : Écrasement par défaut

Par défaut, LangGraph **écrase** les valeurs d'état. Quand un nœud retourne une nouvelle valeur pour une clé, elle remplace l'ancienne valeur.

```typescript
type DefaultState = {
  foo: number;
};

const builder = new StateGraph<DefaultState>({
  channels: {
    foo: {
      default: () => 0,
      reducer: (current: number, update: number) => update, // Écrase la valeur
    },
  },
});
```

**Exemple :**
- État initial : `{ foo: 1 }`
- Nœud retourne : `{ foo: 2 }`
- État final : `{ foo: 2 }` ✅

Cela fonctionne bien pour un nœud unique, mais pose problème quand plusieurs nœuds s'exécutent en parallèle.

## Problème : Branches parallèles

Quand plusieurs nœuds s'exécutent en parallèle (branches), ils tentent tous d'écraser la même clé d'état. Cela génère une erreur `InvalidUpdateError`.

```
START → node_1 → [branch] → node_2 ┐
                                   ├→ END
                                  node_3 ┘
```

**Problème :**
- `node_2` et `node_3` s'exécutent en parallèle
- Tous deux tentent d'écraser `foo`
- LangGraph ne sait pas quelle valeur garder !
- Erreur : `InvalidUpdateError: Can receive only one value per step`

## Solution : Reducers avec listes

Pour résoudre ce problème, on utilise un **reducer** qui **concatène** les valeurs au lieu de les écraser. Cela permet à plusieurs nœuds d'ajouter des valeurs sans conflit.

### Reducer de concaténation

```typescript
function concatReducer(current: number[], update: number[] | number): number[] {
  const updateArray = Array.isArray(update) ? update : [update];
  return [...current, ...updateArray];
}

type ListState = {
  foo: number[];
};

const builder = new StateGraph<ListState>({
  channels: {
    foo: {
      default: () => [],
      reducer: concatReducer, // Concatène au lieu d'écraser
    },
  },
});
```

**Fonctionnement :**
- État initial : `{ foo: [1] }`
- `node_2` retourne : `{ foo: [2] }`
- `node_3` retourne : `{ foo: [3] }`
- Reducer combine : `{ foo: [1, 2, 3] }` ✅

**Avantages :**
- Plusieurs nœuds peuvent ajouter des valeurs en parallèle
- Pas de conflit entre les mises à jour
- L'historique des valeurs est préservé

## Reducers personnalisés

Parfois, les reducers par défaut ne suffisent pas. On peut créer des **reducers personnalisés** pour gérer des cas spéciaux.

### Gestion de `undefined` / `None`

Le reducer de concaténation échoue si l'entrée est `undefined` ou `null`. On peut créer un reducer qui gère ces cas :

```typescript
function reduceListSafe(
  current: number[] | undefined,
  update: number[] | number | undefined
): number[] {
  const currentArray = current || [];
  if (update === undefined || update === null) {
    return currentArray;
  }
  const updateArray = Array.isArray(update) ? update : [update];
  return [...currentArray, ...updateArray];
}
```

**Avantages :**
- Gère les valeurs `undefined` / `null` sans erreur
- Plus robuste pour des entrées variables
- Utile pour des cas où l'état initial peut être `undefined`

## Reducer pour messages : `add_messages`

Pour les messages, LangGraph fournit un reducer spécial `add_messages` qui :
1. **Ajoute** les messages à la liste existante
2. **Réécrit** les messages avec le même ID
3. Permet de **supprimer** des messages

### Ajout de messages

```typescript
function addMessages(
  current: BaseMessage[],
  update: BaseMessage | BaseMessage[]
): BaseMessage[] {
  const messagesToAdd = Array.isArray(update) ? update : [update];
  return [...current, ...messagesToAdd];
}
```

**Exemple :**
- Messages initiaux : `[AIMessage("Hello"), HumanMessage("Hi")]`
- Nouveau message : `AIMessage("How can I help?")`
- Résultat : `[AIMessage("Hello"), HumanMessage("Hi"), AIMessage("How can I help?")]`

### Réécriture de messages

Si un message a le même ID qu'un message existant, il **remplace** l'ancien message au lieu d'être ajouté.

```typescript
const messages = [
  new HumanMessage({ content: "I like marine biology", id: "1" }),
  new AIMessage({ content: "Great!", id: "2" }),
];

const updated = new HumanMessage({ 
  content: "I like whales specifically", 
  id: "1" // Même ID que le premier message
});

// Résultat : le premier message est remplacé
// [HumanMessage("I like whales specifically"), AIMessage("Great!")]
```

**Utilité :**
- Permet de mettre à jour un message après qu'il a été généré
- Utile pour les messages de streaming où le contenu évolue

### Suppression de messages

On peut supprimer des messages en filtrant par ID :

```typescript
function removeMessages(
  current: BaseMessage[],
  idsToRemove: string[]
): BaseMessage[] {
  return current.filter((m) => !idsToRemove.includes(m.id || ""));
}
```

**Utilité :**
- Permet de nettoyer l'historique des messages
- Utile pour limiter la taille du contexte
- Peut être utilisé pour implémenter des stratégies de "trimming" des messages

## Configuration des Reducers dans StateGraph

En TypeScript, on configure les reducers dans la définition des **channels** :

```typescript
const builder = new StateGraph<MyState>({
  channels: {
    messages: {
      default: () => [], // Valeur par défaut
      reducer: addMessages, // Fonction reducer
    },
    count: {
      default: () => 0,
      reducer: (current: number, update: number) => update, // Écrasement
    },
    logs: {
      default: () => [],
      reducer: (current: string[], update: string[]) => [...current, ...update], // Concaténation
    },
  },
});
```

**Structure :**
- `default`: Fonction qui retourne la valeur par défaut pour cette clé
- `reducer`: Fonction qui combine la valeur actuelle avec la mise à jour

**Signature du reducer :**
```typescript
type Reducer<T> = (current: T, update: T | Partial<T>) => T;
```

## Cas d'usage courants

### 1. Accumulation de valeurs

Quand on veut accumuler des valeurs au fil du temps :

```typescript
reducer: (current: number[], update: number[]) => [...current, ...update]
```

### 2. Mise à jour partielle

Quand on veut permettre des mises à jour partielles :

```typescript
reducer: (current: Record<string, any>, update: Record<string, any>) => ({ ...current, ...update })
```

### 3. Maximum/Minimum

Quand on veut garder seulement la valeur la plus grande/petite :

```typescript
reducer: (current: number, update: number) => Math.max(current, update)
```

### 4. Messages avec gestion d'ID

Quand on travaille avec des messages et qu'on veut gérer les ID :

```typescript
reducer: (current: BaseMessage[], update: BaseMessage[]) => {
  // Logique de fusion qui gère les ID
}
```

## Résumé

1. **Par défaut**, LangGraph **écrase** les valeurs d'état
2. Les **branches parallèles** créent des conflits quand elles écrivent la même clé
3. Les **reducers** permettent de spécifier comment combiner les mises à jour
4. Les reducers peuvent **concaténer**, **fusionner**, ou implémenter d'autres logiques
5. Pour les messages, utilisez `add_messages` qui gère l'ajout, la réécriture et la suppression
6. En TypeScript, configurez les reducers dans les **channels** du `StateGraph`

## Points à retenir

- ✅ Utilisez des reducers de concaténation pour les listes qui doivent accumuler des valeurs
- ✅ Utilisez des reducers personnalisés pour gérer des cas spéciaux (`undefined`, validation, etc.)
- ✅ Utilisez `add_messages` pour les messages car il gère les ID et la réécriture
- ❌ Ne tentez pas d'écraser la même clé depuis plusieurs nœuds en parallèle sans reducer approprié
- ❌ N'oubliez pas de gérer les valeurs `undefined` / `null` dans vos reducers personnalisés

