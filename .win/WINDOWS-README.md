# Guide d'utilisation sur Windows 🪟

## Prérequis
- **Node.js** (version 18 ou supérieure) : [Télécharger ici](https://nodejs.org/)
- **npm** (inclus avec Node.js)

## Installation
```bash
npm install
```

## Lancement sur Windows

### 🎯 Option 1 : Scripts PowerShell (Recommandé)
**Ouvrez PowerShell en tant qu'administrateur et exécutez :**
```powershell
# Pour le CLI
.\.win\cli.ps1

# Pour le serveur
.\.win\server.ps1
```

### 🎯 Option 2 : Scripts Batch (.bat)
**Depuis l'invite de commande (cmd) :**
```cmd
REM Pour le CLI
.win\cli.bat

REM Pour le serveur
.win\server.bat

REM Pour le serveur simple
.win\server-simple.bat
```

### 🎯 Option 3 : Scripts npm
```bash
# Pour le CLI
npm run cli:win

# Pour le serveur
npm run server:win

# Pour le serveur simple
npm run server-simple:win

# Pour le développement (redémarrage automatique)
npm run dev:win
```

### 🎯 Option 4 : Commandes directes
```bash
# Pour le CLI
npx tsx CLI/cli.mts

# Pour le serveur
npx tsx serveur/server.mts
```

## Problèmes courants et solutions

### ❌ Erreur : "tsx n'est pas reconnu"
**Solution :**
```bash
npm install -g tsx
```

### ❌ Problème d'affichage des emojis
**Solution :** Les scripts PowerShell et batch configurent automatiquement l'UTF-8. Si le problème persiste :
1. Ouvrez PowerShell/CMD en tant qu'administrateur
2. Exécutez : `chcp 65001`

### ❌ Erreur de politique d'exécution PowerShell
**Solution :**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ Le serveur ne démarre pas
**Vérifiez :**
1. Le port 8080 n'est pas déjà utilisé
2. Le fichier `.env` est correctement configuré dans le dossier `CLI/`
3. Les dépendances sont installées : `npm install`

## Configuration requise

### Fichier CLI/.env
```env
BEARER=votre-token-ici
API_URL=http://localhost:8080
```

## URLs importantes
- **Interface CLI** : Lancez `.\.win\cli.ps1` ou `.\.win\cli.bat`
- **Serveur API** : http://localhost:8080
- **Health Check** : http://localhost:8080/health
- **Liste des agents** : http://localhost:8080/agents

## Diagnostic automatique
Lancez le script de diagnostic pour identifier les problèmes :
```powershell
.\.win\diagnostic-windows.ps1
```

## Support
Si vous rencontrez des problèmes, vérifiez :
1. Node.js est bien installé : `node --version`
2. npm fonctionne : `npm --version`
3. Les dépendances sont installées : `npm list` 