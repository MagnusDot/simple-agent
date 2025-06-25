# Script PowerShell pour lancer le CLI Agent
Write-Host "🚀 Démarrage du CLI Agent..." -ForegroundColor Cyan
Write-Host ""

# Configuration UTF-8 pour l'affichage des emojis
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Vérifier si Node.js est installé
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: Node.js n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Veuillez installer Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Lancer le CLI
try {
    & node --loader tsx/esm CLI/cli.mts $args
} catch {
    Write-Host "❌ Erreur lors du lancement du CLI: $_" -ForegroundColor Red
    exit 1
} 