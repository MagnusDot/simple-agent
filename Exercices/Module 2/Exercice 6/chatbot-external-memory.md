# Chatbot with External Memory - Chatbot avec Mémoire Externe

Ce cours explique comment utiliser une base de données externe (SQLite) pour persister l'état du chatbot, permettant une mémoire qui survit aux redémarrages.

## Vue d'ensemble

Dans l'exercice précédent, nous avons utilisé `MemorySaver` qui stocke l'état en mémoire RAM :
- ✅ Simple à utiliser
- ✅ Idéal pour le développement
- ❌ Les données sont perdues au redémarrage
- ❌ Ne survit pas aux redémarrages du serveur

Pour une persistance réelle, nous avons besoin d'une **base de données externe**.

## SqliteSaver : Persistance Externe

### SQLite

**SQLite** est une base de données SQL légère et populaire :
- Petite taille et rapide
- Pas besoin de serveur séparé
- Fichier unique sur le disque
- Parfait pour le développement et la production légère

### Installation

```bash
npm install @langchain/langgraph-checkpoint-sqlite better-sqlite3
```

### Options de Stockage

#### 1. Base de données en mémoire

```typescript
const conn = new Database(":memory:");
const memory = new SqliteSaver(conn);
```

- Les données sont en RAM
- Perdues au redémarrage
- Utile pour les tests

#### 2. Base de données sur disque

```typescript
const dbPath = "state_db/example.db";
const conn = new Database(dbPath);
const memory = new SqliteSaver(conn);
```

- Les données sont sur disque
- **Persistentes** après redémarrage
- Utile pour la production

## Architecture

Le chatbot avec mémoire externe a la même architecture que l'exercice précédent :

```
START → conversation → [should_continue] → summarize_conversation → END
                                ↓
                               END
```

La seule différence est le **checkpointer** utilisé :
- Exercice 5 : `MemorySaver` (mémoire RAM)
- Exercice 6 : `SqliteSaver` (base de données SQLite)

## Code

### Import et Configuration SQLite

```typescript
import Database from "better-sqlite3";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

// Créer la connexion SQLite
const dbPath = "state_db/example.db";
const conn = new Database(dbPath);

// Créer le checkpointer
const memory = new SqliteSaver(conn);
```

### Compilation du Graphe

```typescript
export const graph = builder.compile({ checkpointer: memory });
```

C'est tout ! Le reste du code est identique à l'exercice précédent.

## Avantages de la Persistance Externe

### 1. Survie aux Redémarrages

```typescript
// Exécution 1
await graph.invoke(
  { messages: [new HumanMessage({ content: "hi! I'm Lance" })] },
  { configurable: { thread_id: "1" } }
);

// Redémarrage du serveur...

// Exécution 2 (même thread_id)
const state = await graph.getState({ configurable: { thread_id: "1" } });
// ✅ L'état est toujours là !
```

### 2. Partage entre Processus

Plusieurs processus peuvent accéder à la même base de données :
- Processus web
- Workers
- Scripts séparés

### 3. Sauvegarde et Restauration

Le fichier SQLite peut être :
- Sauvegardé régulièrement
- Restauré en cas de problème
- Copié vers un autre serveur

### 4. Inspection Manuelle

On peut inspecter l'état directement dans la base de données :
```sql
SELECT * FROM checkpoints WHERE thread_id = '1';
```

## Comparaison : MemorySaver vs SqliteSaver

| Critère | MemorySaver | SqliteSaver |
|---------|-------------|-------------|
| **Simplicité** | ✅ Très simple | ⚠️ Nécessite installation |
| **Performance** | ✅ Très rapide | ✅ Rapide |
| **Persistance** | ❌ Perdue au redémarrage | ✅ Survit aux redémarrages |
| **Partage** | ❌ Un seul processus | ✅ Plusieurs processus |
| **Inspection** | ❌ Difficile | ✅ Base de données SQL |
| **Utilisation** | Développement/Tests | Production |

## Flux d'Exécution

### Exécution 1

1. Créer la connexion SQLite
2. Créer le checkpointer `SqliteSaver`
3. Compiler le graphe avec le checkpointer
4. Invoquer le graphe avec `thread_id = "1"`
5. ✅ L'état est sauvegardé dans `state_db/example.db`

### Redémarrage

1. Recréer la connexion SQLite (même fichier)
2. Recréer le checkpointer
3. Recompiler le graphe
4. Récupérer l'état avec `getState({ thread_id: "1" })`
5. ✅ L'état est toujours là !

### Exécution 2

1. Utiliser le même `thread_id`
2. L'état précédent est automatiquement restauré
3. Continuer la conversation où on l'avait laissée

## Alternatives

### PostgreSQL

Pour des applications plus complexes, on peut utiliser PostgreSQL :

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const memory = new PostgresSaver({
  connectionString: "postgresql://user:password@localhost/dbname"
});
```

### Redis

Pour des performances élevées :

```typescript
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";

const memory = new RedisSaver({
  url: "redis://localhost:6379"
});
```

## Cas d'Usage

1. **Chatbots Production** : Mémoire persistante entre sessions utilisateur
2. **Agents Long Terme** : Suivi de tâches sur plusieurs jours
3. **Applications Web** : État partagé entre requêtes
4. **Microservices** : Partage d'état entre services

## Vérification de l'État

On peut vérifier que l'état est bien sauvegardé :

```typescript
const state = await graph.getState(config);
console.log("État sauvegardé:");
console.log(`  - Messages: ${state.values.messages.length}`);
console.log(`  - Résumé: "${state.values.summary}"`);
console.log(`  - Thread ID: ${config.configurable.thread_id}`);
```

## Résumé

1. **Problème** : `MemorySaver` perd les données au redémarrage
2. **Solution** : Utiliser `SqliteSaver` avec une base de données sur disque
3. **Avantage** : Persistance réelle, survit aux redémarrages
4. **Installation** : `npm install @langchain/langgraph-checkpoint-sqlite better-sqlite3`
5. **Utilisation** : Même code que `MemorySaver`, juste changer le checkpointer

La mémoire externe permet de créer des chatbots et agents qui maintiennent leur état sur le long terme, idéal pour les applications de production.

