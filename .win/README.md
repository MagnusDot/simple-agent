# 🪟 Dossier Windows - Scripts et utilitaires

Ce dossier contient tous les fichiers spécifiques à Windows pour faciliter l'utilisation du CLI et du serveur.

## 📁 Contenu du dossier

### 🔧 Scripts PowerShell (.ps1) - Recommandés
- `install-windows.ps1` - Script d'installation automatique
- `cli.ps1` - Lance le CLI avec configuration UTF-8
- `server.ps1` - Lance le serveur avec informations de démarrage
- `diagnostic-windows.ps1` - Script de diagnostic complet
- `test-server.ps1` - Test automatique du serveur

### 🔧 Scripts Batch (.bat) - Compatibilité maximale
- `cli.bat` - Version CMD du CLI
- `server.bat` - Version CMD du serveur
- `server-simple.bat` - Version CMD du serveur simple
- `test-server.bat` - Test automatique du serveur (version CMD)

### 🔧 Scripts de raccourci (.cmd)
- `start-cli.cmd` - Raccourci pour lancer le CLI depuis n'importe où
- `start-server.cmd` - Raccourci pour lancer le serveur depuis n'importe où

### 📖 Documentation
- `WINDOWS-README.md` - Guide complet d'utilisation Windows
- `README.md` - Ce fichier

## 🚀 Utilisation rapide

### Installation automatique (Première fois)
```powershell
# Installation complète automatique
.\.win\install-windows.ps1
```

### Depuis PowerShell (Recommandé)
```powershell
# Lancer le diagnostic
.\.win\diagnostic-windows.ps1

# Lancer le CLI
.\.win\cli.ps1

# Lancer le serveur
.\.win\server.ps1
```

### Depuis CMD
```cmd
REM Lancer le CLI
.win\cli.bat

REM Lancer le serveur
.win\server.bat
```

### Scripts de raccourci
```cmd
REM Depuis n'importe quel sous-dossier
.win\start-cli.cmd
.win\start-server.cmd
```

## 🔍 Diagnostic des problèmes

Si vous rencontrez des problèmes, lancez d'abord le diagnostic :
```powershell
.\.win\diagnostic-windows.ps1
```

Ce script vérifie :
- ✅ Installation de Node.js et npm
- ✅ Dépendances du projet
- ✅ Accessibilité de tsx
- ✅ Affichage des emojis
- ✅ Présence des fichiers requis
- ✅ Test rapide du CLI

### Test spécifique du serveur
Si le serveur ne s'affiche pas correctement :
```powershell
# PowerShell
.\.win\test-server.ps1

# CMD
.win\test-server.bat
```

Ce script teste :
- ✅ Compilation TypeScript
- ✅ Démarrage du serveur
- ✅ Connectivité HTTP
- ✅ Récupération des logs

## 💡 Conseils Windows

1. **PowerShell vs CMD** : Préférez PowerShell pour un meilleur support UTF-8
2. **Politique d'exécution** : Si PowerShell bloque, exécutez :
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. **Encodage** : Tous les scripts configurent automatiquement l'UTF-8
4. **Node.js** : Assurez-vous que Node.js est dans le PATH système

## 🆘 Support

En cas de problème :
1. Lancez le diagnostic : `.\.win\diagnostic-windows.ps1`
2. Consultez le guide complet : `.\.win\WINDOWS-README.md`
3. Utilisez les scripts npm : `npm run cli:win` ou `npm run server:win` 