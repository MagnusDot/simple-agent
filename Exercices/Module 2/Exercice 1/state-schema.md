# State Schema - Schémas d'État

Ce cours présente les différentes façons de définir un schéma d'état pour un graphe LangGraph en TypeScript.

## Vue d'ensemble

Quand on définit un `StateGraph` LangGraph, on utilise un **schéma d'état**.

Le schéma d'état représente la structure et les types de données que notre graphe va utiliser.

Tous les nœuds communiquent avec ce schéma.

LangGraph offre de la flexibilité dans la façon dont vous définissez votre schéma d'état, en accommodant différents types TypeScript et approches de validation.

## Méthode 1 : Type TypeScript (équivalent de TypedDict Python)

### Définition simple

On peut utiliser un `type` ou `interface` TypeScript pour définir les clés et leurs types correspondants.

```typescript
type TypedDictState = {
  foo: string;
  bar: string;
};
```

### Avec contraintes (Literal Types)

Pour des contraintes plus spécifiques, on peut utiliser des **literal types** (équivalent de `Literal` en Python).

```typescript
type TypedDictStateWithMood = {
  name: string;
  mood: "happy" | "sad"; // Seulement "happy" ou "sad" sont autorisés
};
```

**Caractéristiques :**
- ✅ Hints de type pour l'IDE et TypeScript
- ✅ Vérification statique au moment de la compilation
- ❌ **Pas de validation à l'exécution** - TypeScript est supprimé à la compilation
- ❌ Les valeurs invalides peuvent être assignées sans erreur à l'exécution

### Accès aux propriétés

Avec un type/interface, on accède aux clés avec la notation `state["key"]` ou `state.key` :

```typescript
function node(state: TypedDictStateWithMood) {
  return { name: state.name + " is ... " };
}
```

## Méthode 2 : Classe TypeScript (équivalent de dataclass Python)

### Définition

Les classes TypeScript offrent une syntaxe concise pour créer des structures principalement utilisées pour stocker des données.

```typescript
class DataclassState {
  name: string;
  mood: "happy" | "sad";

  constructor(name: string, mood: "happy" | "sad") {
    this.name = name;
    this.mood = mood;
  }
}
```

**Différence avec les types :**
- On accède aux propriétés avec `state.name` (comme pour les types aussi, mais la syntaxe est plus naturelle)
- Les classes existent vraiment à l'exécution (contrairement aux types)
- On peut instancier avec `new DataclassState("Lance", "sad")`

**Caractéristiques :**
- ✅ Syntaxe claire et naturelle
- ✅ Classe réelle à l'exécution
- ❌ **Pas de validation automatique** à l'exécution
- ❌ Les valeurs invalides peuvent toujours être assignées

### Utilisation dans le graphe

```typescript
graph.invoke(new DataclassState("Lance", "sad"));
```

## Méthode 3 : Zod Schema (équivalent de Pydantic Python)

### Problème des types et classes

Comme mentionné, les types et classes fournissent des hints de type mais **ne valident pas à l'exécution**.

Cela signifie qu'on pourrait potentiellement assigner des valeurs invalides sans lever d'erreur !

Par exemple, avec une classe, on pourrait créer :
```typescript
new DataclassState("Lance", "mad"); // "mad" n'est pas valide mais pas d'erreur !
```

### Solution : Zod

**Zod** est une bibliothèque de validation TypeScript-first qui utilise les annotations de type.

Elle est particulièrement adaptée pour définir des schémas d'état dans LangGraph grâce à ses capacités de validation.

Zod peut valider si les données correspondent aux types et contraintes spécifiés **à l'exécution**.

```typescript
import { z } from "zod";

const PydanticStateSchema = z.object({
  name: z.string(),
  mood: z.enum(["happy", "sad"]),
});

type PydanticState = z.infer<typeof PydanticStateSchema>;
```

### Validation à l'exécution

```typescript
// ✅ Valide
const valid = PydanticStateSchema.parse({ name: "Lance", mood: "sad" });

// ❌ Lève une erreur
try {
  const invalid = PydanticStateSchema.parse({ name: "Lance", mood: "mad" });
} catch (error) {
  // Erreur de validation !
  console.log(error.errors);
}
```

**Caractéristiques :**
- ✅ **Validation à l'exécution**
- ✅ Erreurs claires quand les données sont invalides
- ✅ Peut être utilisé avec TypeScript pour avoir les deux avantages
- ✅ Déjà utilisé dans LangGraph pour les outils (schémas)

## Comparaison des méthodes

| Méthode | Validation statique | Validation runtime | Syntaxe | Exemple |
|---------|-------------------|-------------------|---------|---------|
| **Type** | ✅ Oui | ❌ Non | `state.key` | `type State = { key: string }` |
| **Classe** | ✅ Oui | ❌ Non | `state.key` | `class State { key: string }` |
| **Zod** | ✅ Oui (via type infer) | ✅ **Oui** | `state.key` | `z.object({ key: z.string() })` |

## Quand utiliser chaque méthode ?

### Type/Interface
- ✅ Projets simples où la validation runtime n'est pas critique
- ✅ Quand on fait confiance aux données d'entrée
- ✅ Développement rapide et prototypes

### Classe
- ✅ Quand on veut instancier explicitement : `new State(...)`
- ✅ Quand on a besoin de méthodes sur l'état
- ✅ Structure plus "orientée objet"

### Zod
- ✅ **Production** - Validation runtime nécessaire
- ✅ Données provenant de sources externes (APIs, utilisateurs)
- ✅ Validation de contraintes complexes
- ✅ Messages d'erreur détaillés pour le debugging

## Bonnes pratiques

1. **Développement** : Utiliser Type/Interface pour la rapidité
2. **Production** : Toujours valider avec Zod (ou autre validateur)
3. **Combinaison** : Utiliser Zod pour la validation + inférer le type TypeScript
   ```typescript
   const schema = z.object({ name: z.string() });
   type State = z.infer<typeof schema>; // Meilleur des deux mondes
   ```

## Résumé

1. **Type/Interface** : Hints de type, pas de validation runtime
2. **Classe** : Syntaxe naturelle, classe réelle, pas de validation automatique
3. **Zod** : Validation runtime + type safety, recommandé pour la production

## Points à Retenir

- Toutes les méthodes permettent d'accéder aux propriétés avec `state.key`
- Les types/classes ne valident pas à l'exécution
- Zod ajoute la validation runtime essentielle pour la production
- Les nœuds retournent toujours des objets partiels avec les clés à mettre à jour
- LangGraph stocke chaque clé de l'état séparément (comme des "canaux")

