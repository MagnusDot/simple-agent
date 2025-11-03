# Le Graphe le Plus Simple

Ce cours présente comment construire un graphe simple avec 3 nœuds et une arête conditionnelle en utilisant LangGraph avec TypeScript.

## Architecture du Graphe

```
START → node_1 → [décision] → node_2 ou node_3 → END
```

## Concepts Clés

### 1. État (State)

L'état du graphe sert de schéma d'entrée pour tous les nœuds et arêtes.

- On utilise un type TypeScript (`type State`) pour définir la structure
- Chaque clé de l'état peut être accédée dans les nœuds
- Par défaut, les nouvelles valeurs retournées par un nœud **écrasent** les valeurs précédentes

```typescript
type State = {
  graph_state: string;
};
```

### 2. Nœuds (Nodes)

Les nœuds sont de simples fonctions TypeScript.

- Le premier paramètre est toujours l'état du graphe
- Chaque nœud peut accéder aux clés de l'état (ex: `state.graph_state`)
- Chaque nœud retourne une nouvelle valeur pour mettre à jour l'état

```typescript
function node_1(state: State): Partial<State> {
  console.log("---Node 1---");
  return { graph_state: `${state.graph_state} I am` };
}
```

**Point important** : Par défaut, la nouvelle valeur retournée par chaque nœud écrase la valeur précédente de l'état.

### 3. Arêtes (Edges)

Les arêtes connectent les nœuds entre eux.

- **Arêtes normales** : Utilisées quand on veut **toujours** aller d'un nœud à un autre (ex: `node_1` → `node_2`)
- **Arêtes conditionnelles** : Utilisées quand on veut router **conditionnellement** entre plusieurs nœuds
  - Implémentées comme des fonctions qui retournent le prochain nœud à visiter basé sur une logique

```typescript
function decide_mood(state: State): NextNode {
  // Souvent, on utilisera l'état pour décider du prochain nœud
  // Ici, on fait simplement un split 50/50 entre node_2 et node_3
  return Math.random() < 0.5 ? "node_2" : "node_3";
}
```

### 4. Construction du Graphe

On construit le graphe à partir des composants définis ci-dessus.

1. **Initialiser** un `StateGraph` avec la définition de l'état
2. **Ajouter** les nœuds et arêtes
3. **Utiliser les nœuds spéciaux** :
   - `START` : Un nœud spécial qui envoie l'entrée utilisateur au graphe
   - `END` : Un nœud spécial qui représente un nœud terminal
4. **Compiler** le graphe pour effectuer des vérifications de base sur la structure

#### Configuration des canaux (Channels)

En TypeScript/JavaScript, il faut définir les canaux avec :
- `default` : Valeur par défaut pour le canal
- `reducer` : Fonction qui réduit/fusionne les mises à jour (ici on écrase simplement)

```typescript
const builder = new StateGraph<State>({
  channels: {
    graph_state: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
  },
});
```

### 5. Exécution du Graphe

Le graphe compilé implémente le protocole Runnable de LangChain.

- `invoke` : Exécute le graphe de manière synchrone (attend chaque étape avant de passer à la suivante)
- Retourne l'état final après l'exécution de tous les nœuds
- L'exécution commence depuis le nœud `START`
- Progresse à travers les nœuds définis dans l'ordre
- L'arête conditionnelle route depuis `node_1` vers `node_2` ou `node_3` selon la logique
- Continue jusqu'à atteindre le nœud `END`

```typescript
const result = await graph.invoke({ graph_state: "Hi, this is Lance." });
// Résultat possible : { graph_state: "Hi, this is Lance. I am sad!" }
```

## Résumé

1. **State** : Définit la structure des données partagées
2. **Nodes** : Fonctions qui transforment l'état
3. **Edges** : Connectent les nœuds (normales ou conditionnelles)
4. **Compilation** : Valide et prépare le graphe pour l'exécution
5. **Invocation** : Exécute le graphe de manière synchrone

## Points à Retenir

- L'état est partagé entre tous les nœuds
- Les nœuds retournent des mises à jour partielles de l'état
- Les arêtes conditionnelles permettent du routage dynamique
- Le graphe s'exécute de manière séquentielle (une étape après l'autre)

