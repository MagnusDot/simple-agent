# Multiple Schemas - Schémas Multiples

Ce cours explique comment utiliser plusieurs schémas d'état dans un graphe LangGraph : les **états privés** entre nœuds et les **schémas d'entrée/sortie spécifiques**.

## Vue d'ensemble

Par défaut, un `StateGraph` utilise un **seul schéma** pour :
- L'entrée du graphe
- L'état interne partagé entre les nœuds
- La sortie du graphe

Cependant, il existe des cas où on veut plus de contrôle :

1. **État privé** : Des nœuds peuvent communiquer avec des données qui ne sont **pas nécessaires** dans l'input/output du graphe
2. **Schémas Input/Output** : On peut vouloir **filtrer** les clés acceptées en entrée ou retournées en sortie

## 1. État Privé (Private State)

### Concept

Un **état privé** est utilisé pour le passage de données entre nœuds spécifiques, mais ces données ne font **pas partie** du schéma principal du graphe.

**Exemple :**
- Le graphe utilise `OverallState` avec la clé `foo`
- `node_1` lit `foo` et écrit dans `PrivateState` avec la clé `baz`
- `node_2` lit `baz` et écrit dans `OverallState` avec `foo`
- `baz` n'apparaît **pas** dans l'output final du graphe

```typescript
type OverallState = {
  foo: number;
};

type PrivateState = {
  baz: number;
};

function node_1(state: OverallState): PrivateState {
  return { baz: state.foo + 1 };
}

function node_2(state: PrivateState): Partial<OverallState> {
  return { foo: state.baz + 1 };
}
```

### Avantages

- ✅ Permet de masquer des données intermédiaires de l'API publique
- ✅ Réduit la complexité de l'input/output du graphe
- ✅ Utile pour des calculs intermédiaires qui ne doivent pas être exposés

### Limitations en TypeScript

En TypeScript, LangGraph utilise le schéma principal pour définir les **channels**. Les nœuds peuvent retourner des types différents, mais ils doivent être compatibles avec le système de channels. Pour un vrai état privé, on doit souvent utiliser des techniques de filtrage ou des wrappers.

## 2. Schémas d'Entrée et de Sortie

### Concept

On peut vouloir définir des schémas **spécifiques** pour l'entrée et la sortie du graphe, même si le graphe interne utilise un schéma plus large.

**Exemple :**
- **Input** : Seulement `question`
- **Output** : Seulement `answer`
- **État interne** : `question`, `answer`, `notes` (où `notes` est utilisé pour le traitement mais pas retourné)

```typescript
type InputState = {
  question: string;
};

type OutputState = {
  answer: string;
};

type OverallStateFull = {
  question: string;
  answer: string;
  notes: string; // Utilisé en interne mais pas dans l'output
};
```

### Implémentation en TypeScript

En Python, LangGraph supporte directement `input_schema` et `output_schema` dans le constructeur de `StateGraph`. En TypeScript, on peut :

#### Méthode 1 : Filtrage manuel

```typescript
function filterOutput(result: OverallStateFull): OutputState {
  return {
    answer: result.answer,
  };
}

const result = await graph.invoke({ question: "hi" });
const filtered = filterOutput(result); // Retourne seulement { answer: "..." }
```

#### Méthode 2 : Wrapper fonction

```typescript
async function invokeWithSchemas(input: InputState): Promise<OutputState> {
  const internalInput: OverallStateFull = {
    question: input.question,
    answer: "",
    notes: "",
  };
  
  const result = await graph.invoke(internalInput);
  return { answer: result.answer };
}
```

#### Méthode 3 : Validation avec Zod

On peut combiner les schémas avec **Zod** pour valider les entrées et sorties :

```typescript
import { z } from "zod";

const InputSchema = z.object({
  question: z.string().min(1),
});

const OutputSchema = z.object({
  answer: z.string(),
});

function validateAndInvoke(input: unknown): Promise<OutputState> {
  const validatedInput = InputSchema.parse(input);
  const result = await graph.invoke(validatedInput);
  return OutputSchema.parse({ answer: result.answer });
}
```

### Avantages

- ✅ **Séparation des préoccupations** : L'API publique est claire et simple
- ✅ **Masquage des détails d'implémentation** : Les clés internes (`notes`) ne sont pas exposées
- ✅ **Validation** : On peut valider les entrées/sorties indépendamment
- ✅ **Évolutivité** : On peut changer l'état interne sans casser l'API publique

### Cas d'usage

1. **API publique simplifiée** : Exposer seulement les données nécessaires à l'utilisateur
2. **Sécurité** : Masquer des informations sensibles utilisées en interne
3. **Versioning** : Changer l'état interne sans affecter l'API publique
4. **Documentation** : Clarifier exactement ce qui est accepté en entrée et retourné en sortie

## Comparaison : Schéma Unique vs Schémas Multiples

### Schéma Unique (par défaut)

```typescript
// Input, état interne, et output utilisent le même schéma
const graph = new StateGraph<State>({
  channels: { /* ... */ }
});

const result = await graph.invoke({ question: "hi", answer: "", notes: "" });
// Résultat : { question: "hi", answer: "bye", notes: "..." }
```

**Avantages :**
- Simple à implémenter
- Pas de conversion nécessaire

**Inconvénients :**
- Expose toutes les clés internes
- API publique peut être complexe
- Risque d'exposer des données sensibles

### Schémas Multiples

```typescript
// Input et output filtrent les clés
const input: InputState = { question: "hi" };
const output = await invokeWithSchemas(input);
// Résultat : { answer: "bye" }
```

**Avantages :**
- API publique claire et simple
- Masque les détails d'implémentation
- Meilleure sécurité et validation

**Inconvénients :**
- Nécessite du code supplémentaire (wrappers, filtrage)
- Plus complexe à maintenir

## Bonnes Pratiques

### 1. Utiliser des types distincts

Définissez clairement les types pour l'input, l'output, et l'état interne :

```typescript
type InputState = { question: string };
type OutputState = { answer: string };
type InternalState = { question: string; answer: string; notes: string };
```

### 2. Documenter les conversions

Documentez comment les données sont converties entre les schémas :

```typescript
/**
 * Convertit InputState vers InternalState en ajoutant des valeurs par défaut
 */
function inputToInternal(input: InputState): InternalState {
  return {
    question: input.question,
    answer: "",
    notes: "",
  };
}
```

### 3. Valider avec Zod

Utilisez Zod pour valider les entrées et sorties :

```typescript
const InputSchema = z.object({
  question: z.string().min(1).max(500),
});
```

### 4. Gérer les erreurs

Gérez les erreurs de validation et de conversion :

```typescript
try {
  const validatedInput = InputSchema.parse(input);
  return await graph.invoke(validatedInput);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Gérer les erreurs de validation
  }
}
```

## Résumé

1. **État privé** : Permet de masquer des données intermédiaires entre nœuds
2. **Schémas Input/Output** : Filtre les clés acceptées en entrée et retournées en sortie
3. **Implémentation TypeScript** : Nécessite des wrappers ou filtrage manuel (contrairement à Python)
4. **Validation** : Utilisez Zod pour valider les entrées et sorties
5. **Bonnes pratiques** : Types distincts, documentation, gestion d'erreurs

## Points à Retenir

- ✅ Utilisez des états privés pour masquer des données intermédiaires
- ✅ Filtrez l'output pour exposer seulement les données nécessaires
- ✅ Validez les entrées/sorties avec Zod pour la sécurité
- ✅ Documentez les conversions entre schémas
- ⚠️ En TypeScript, les schémas multiples nécessitent du code supplémentaire (wrappers)
- ⚠️ Assurez-vous que les types sont compatibles avec le système de channels

