# Script de diagnostic pour Windows
Write-Host "🔍 Diagnostic des problèmes Windows" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Blue

# Configuration UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Test 1: Vérifier Node.js
Write-Host "`n1️⃣ Vérification de Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js installé: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js non trouvé dans le PATH" -ForegroundColor Red
        Write-Host "💡 Installez Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification de Node.js: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Vérifier npm
Write-Host "`n2️⃣ Vérification de npm..." -ForegroundColor Yellow
try {
    $npmVersion = & npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ npm installé: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ npm non trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification de npm: $_" -ForegroundColor Red
}

# Test 3: Vérifier les dépendances
Write-Host "`n3️⃣ Vérification des dépendances..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    if (Test-Path "node_modules") {
        Write-Host "✅ node_modules trouvé" -ForegroundColor Green
    } else {
        Write-Host "❓ node_modules manquant. Installation des dépendances..." -ForegroundColor Yellow
        & npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Dépendances installées avec succès" -ForegroundColor Green
        } else {
            Write-Host "❌ Échec de l'installation des dépendances" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ package.json non trouvé dans le répertoire courant" -ForegroundColor Red
}

# Test 4: Vérifier tsx
Write-Host "`n4️⃣ Vérification de tsx..." -ForegroundColor Yellow
try {
    $tsxCheck = & npx tsx --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ tsx accessible via npx" -ForegroundColor Green
    } else {
        Write-Host "❓ Installation de tsx globalement..." -ForegroundColor Yellow
        & npm install -g tsx
    }
} catch {
    Write-Host "❓ Installation de tsx..." -ForegroundColor Yellow
    & npm install -g tsx
}

# Test 5: Vérifier l'encodage de la console
Write-Host "`n5️⃣ Test d'affichage des emojis..." -ForegroundColor Yellow
Write-Host "🚀 🔥 💬 ✅ ❌ 🔍 📡" -ForegroundColor Cyan
Write-Host "Si vous voyez des emojis ci-dessus, l'affichage fonctionne correctement !" -ForegroundColor Green

# Test 6: Vérifier les fichiers nécessaires
Write-Host "`n6️⃣ Vérification des fichiers..." -ForegroundColor Yellow
$requiredFiles = @(
    "CLI/cli.mts",
    "serveur/server.mts",
    "serveur/server-simple.mts"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file trouvé" -ForegroundColor Green
    } else {
        Write-Host "❌ $file manquant" -ForegroundColor Red
    }
}

# Test 7: Test simple du CLI
Write-Host "`n7️⃣ Test rapide du CLI..." -ForegroundColor Yellow
try {
    $cliTest = & node --loader tsx/esm CLI/cli.mts --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CLI accessible" -ForegroundColor Green
    } else {
        Write-Host "❌ Problème avec le CLI: $cliTest" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors du test du CLI: $_" -ForegroundColor Red
}

# Informations système
Write-Host "`n8️⃣ Informations système..." -ForegroundColor Yellow
Write-Host "OS: $([System.Environment]::OSVersion.VersionString)" -ForegroundColor Cyan
Write-Host "PowerShell: $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
Write-Host "Répertoire courant: $(Get-Location)" -ForegroundColor Cyan

# Résumé et recommandations
Write-Host "`n🎯 Recommandations pour Windows:" -ForegroundColor Magenta
Write-Host "• Utilisez PowerShell (recommandé) ou CMD" -ForegroundColor White
Write-Host "• Lancez: .\.win\cli.ps1 ou .\.win\cli.bat" -ForegroundColor White
Write-Host "• Pour le serveur: .\.win\server.ps1 ou .\.win\server.bat" -ForegroundColor White
Write-Host "• Alternative: npm run cli:win ou npm run server:win" -ForegroundColor White
Write-Host "• Test du serveur: .\.win\test-server.ps1" -ForegroundColor White

# Proposer de lancer le test du serveur
$testResponse = Read-Host "`nVoulez-vous tester le serveur maintenant ? (o/N)"
if ($testResponse -eq "o" -or $testResponse -eq "O" -or $testResponse -eq "oui") {
    Write-Host "`n🧪 Lancement du test du serveur..." -ForegroundColor Cyan
    & ".\.win\test-server.ps1"
}

Write-Host "`n✨ Diagnostic terminé !" -ForegroundColor Green 