# Agent Memory Server

Serveur web Express pour interagir avec un agent LangGraph doté de mémoire persistante.

## 🚀 Démarrage

```bash
# Installer les dépendances (si nécessaire)
npm install

# Lancer le serveur
npx tsx agent-memory-server.mts
```

Le serveur démarre sur `http://localhost:3000`

## 📡 API Endpoints

### POST /chat

Envoie un message à l'agent avec contexte de conversation.

**Body (JSON):**
```json
{
  "message": "Add 3 and 4",
  "thread_id": "optional-thread-id"
}
```

- `message` (requis): Le message à envoyer à l'agent
- `thread_id` (optionnel): Identifiant de la conversation pour maintenir le contexte. Si absent, un ID unique est généré automatiquement.

**Réponse:**
```json
{
  "thread_id": "user123",
  "response": "The sum of 3 and 4 is 7.",
  "message_count": 4
}
```

**Exemple avec curl:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Add 3 and 4", "thread_id": "user123"}'
```

### GET /health

Vérifie l'état du serveur.

**Exemple:**
```bash
curl http://localhost:3000/health
```

**Réponse:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-01T10:30:00.000Z"
}
```

### GET /

Page d'accueil avec documentation interactive.

## 🔧 Outils disponibles

L'agent a accès aux outils suivants:

- **add**: Additionne deux nombres
- **multiply**: Multiplie deux nombres
- **divide**: Divise deux nombres

## 💡 Exemple de conversation avec mémoire

```bash
# Premier message
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Add 3 and 4", "thread_id": "conversation1"}'

# Réponse: "The sum of 3 and 4 is 7."

# Deuxième message (référence au résultat précédent)
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Multiply that by 2", "thread_id": "conversation1"}'

# Réponse: "7 multiplied by 2 is 14."
```

Grâce au même `thread_id`, l'agent se souvient du contexte et comprend que "that" fait référence au résultat précédent (7).

## 🧠 Fonctionnement de la mémoire

- Chaque `thread_id` maintient son propre contexte de conversation
- Sans `thread_id`, chaque message est traité indépendamment
- La mémoire est persistante pendant la durée de vie du serveur
- Utilise `MemorySaver` de LangGraph pour stocker l'historique des messages

## 🌐 Variables d'environnement

- `OPENAI_API_KEY`: Clé API OpenAI (requise)
- `PORT`: Port du serveur (par défaut: 3000)
