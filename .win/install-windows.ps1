# Script d'installation automatique pour Windows
Write-Host "🪟 Installation automatique pour Windows" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Blue

# Configuration UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Vérifier si on est dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: package.json non trouvé" -ForegroundColor Red
    Write-Host "💡 Veuillez exécuter ce script depuis la racine du projet" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n1️⃣ Vérification de Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js installé: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js non trouvé. Installation requise." -ForegroundColor Red
        Write-Host "💡 Téléchargez Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
        Start-Process "https://nodejs.org/"
        exit 1
    }
} catch {
    Write-Host "❌ Node.js non trouvé. Installation requise." -ForegroundColor Red
    Write-Host "💡 Téléchargez Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
    Start-Process "https://nodejs.org/"
    exit 1
}

Write-Host "`n2️⃣ Installation des dépendances..." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dépendances installées avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Échec de l'installation des dépendances" -ForegroundColor Red
    exit 1
}

Write-Host "`n3️⃣ Configuration de l'environnement..." -ForegroundColor Yellow
$envPath = "CLI\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "📝 Création du fichier .env..." -ForegroundColor Yellow
    $envContent = @"
# Configuration pour Windows
BEARER=your-token-here
API_URL=http://localhost:8080
PORT=8080
REQUIRE_AUTH=false

# Clés API (à configurer selon vos besoins)
# OPENAI_API_KEY=sk-...
# TAVILY_API_KEY=tvly-...
"@
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "✅ Fichier .env créé dans CLI/.env" -ForegroundColor Green
    Write-Host "💡 N'oubliez pas de configurer votre token BEARER" -ForegroundColor Yellow
} else {
    Write-Host "✅ Fichier .env déjà présent" -ForegroundColor Green
}

Write-Host "`n4️⃣ Test de l'installation..." -ForegroundColor Yellow
try {
    $testResult = & node --loader tsx/esm CLI/cli.mts --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CLI fonctionne correctement" -ForegroundColor Green
    } else {
        Write-Host "❌ Problème avec le CLI" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors du test du CLI" -ForegroundColor Red
}

Write-Host "`n5️⃣ Configuration des politiques PowerShell..." -ForegroundColor Yellow
try {
    $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
    if ($currentPolicy -eq "Restricted") {
        Write-Host "🔧 Configuration de la politique d'exécution..." -ForegroundColor Yellow
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Write-Host "✅ Politique d'exécution configurée" -ForegroundColor Green
    } else {
        Write-Host "✅ Politique d'exécution déjà configurée: $currentPolicy" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Impossible de configurer automatiquement la politique d'exécution" -ForegroundColor Yellow
    Write-Host "💡 Exécutez manuellement: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
}

Write-Host "`n🎉 Installation terminée !" -ForegroundColor Green
Write-Host "`n🚀 Commandes disponibles:" -ForegroundColor Magenta
Write-Host "• CLI: .\.win\cli.ps1 ou npm run cli:win" -ForegroundColor White
Write-Host "• Serveur: .\.win\server.ps1 ou npm run server:win" -ForegroundColor White
Write-Host "• Diagnostic: .\.win\diagnostic-windows.ps1" -ForegroundColor White

Write-Host "`n📖 Documentation complète: .\.win\WINDOWS-README.md" -ForegroundColor Cyan

# Demander si l'utilisateur veut lancer le diagnostic
$response = Read-Host "`nVoulez-vous lancer le diagnostic maintenant ? (o/N)"
if ($response -eq "o" -or $response -eq "O" -or $response -eq "oui") {
    Write-Host "`n🔍 Lancement du diagnostic..." -ForegroundColor Cyan
    & ".\.win\diagnostic-windows.ps1"
} 