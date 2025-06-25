# Script PowerShell pour lancer le serveur Agent
Write-Host "🔥 Démarrage du serveur Agent..." -ForegroundColor Cyan
Write-Host ""

# Configuration UTF-8 pour l'affichage des emojis
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Vérifier si Node.js est installé
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: Node.js n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Veuillez installer Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Afficher les informations de démarrage
Write-Host "📡 Démarrage du serveur sur le port 8080..." -ForegroundColor Green
Write-Host "🌐 URL: http://localhost:8080" -ForegroundColor Blue
Write-Host "💡 Appuyez sur Ctrl+C pour arrêter le serveur" -ForegroundColor Yellow
Write-Host ""

# Lancer le serveur
try {
    # Forcer l'affichage des logs en temps réel
    $env:FORCE_COLOR = "1"
    $env:NODE_ENV = "development"
    
    Write-Host "🔄 Lancement en cours..." -ForegroundColor Yellow
    & node --loader tsx/esm serveur/server.mts
} catch {
    Write-Host "❌ Erreur lors du lancement du serveur: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour fermer"
    exit 1
} 