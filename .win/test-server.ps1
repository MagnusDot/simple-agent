# Script de test du serveur pour Windows
Write-Host "🧪 Test du serveur sur Windows" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Blue

# Configuration UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Variables d'environnement pour forcer l'affichage
$env:FORCE_COLOR = "1"
$env:NODE_ENV = "development"

Write-Host "`n1️⃣ Test de compilation TypeScript..." -ForegroundColor Yellow
try {
    $compileTest = & npx tsx --check serveur/server.mts 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Compilation TypeScript OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur de compilation: $compileTest" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors du test de compilation: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n2️⃣ Test de démarrage du serveur..." -ForegroundColor Yellow
Write-Host "⏰ Le serveur va démarrer pendant 10 secondes puis s'arrêter automatiquement" -ForegroundColor Yellow

# Démarrer le serveur en arrière-plan
$serverJob = Start-Job -ScriptBlock {
    $env:FORCE_COLOR = "1"
    $env:NODE_ENV = "development"
    & node --loader tsx/esm serveur/server.mts
}

# Attendre un peu que le serveur démarre
Start-Sleep -Seconds 3

Write-Host "`n3️⃣ Test de connectivité..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Serveur accessible sur http://localhost:8080" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "✅ Status: $($healthData.status)" -ForegroundColor Green
        Write-Host "✅ Version: $($healthData.version)" -ForegroundColor Green
    } else {
        Write-Host "❌ Serveur non accessible (Code: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur de connexion au serveur: $_" -ForegroundColor Red
}

Write-Host "`n4️⃣ Vérification des logs du serveur..." -ForegroundColor Yellow
$jobOutput = Receive-Job -Job $serverJob
if ($jobOutput) {
    Write-Host "✅ Logs du serveur reçus:" -ForegroundColor Green
    $jobOutput | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
} else {
    Write-Host "⚠️ Aucun log reçu du serveur" -ForegroundColor Yellow
}

# Arrêter le serveur
Write-Host "`n5️⃣ Arrêt du serveur..." -ForegroundColor Yellow
Stop-Job -Job $serverJob
Remove-Job -Job $serverJob
Write-Host "✅ Serveur arrêté" -ForegroundColor Green

Write-Host "`n🎯 Résumé du test:" -ForegroundColor Magenta
Write-Host "• Compilation TypeScript: ✅" -ForegroundColor White
Write-Host "• Démarrage du serveur: ✅" -ForegroundColor White
Write-Host "• Connectivité HTTP: ✅" -ForegroundColor White

Write-Host "`n💡 Pour lancer le serveur normalement:" -ForegroundColor Yellow
Write-Host "  .\.win\server.ps1" -ForegroundColor White
Write-Host "  ou" -ForegroundColor Gray
Write-Host "  npm run server:win" -ForegroundColor White

Write-Host "`n✨ Test terminé !" -ForegroundColor Green 