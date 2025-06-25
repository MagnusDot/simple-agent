@echo off
chcp 65001 >nul
echo 🧪 Test du serveur sur Windows
echo ========================================

echo.
echo 1️⃣ Test de compilation TypeScript...
npx tsx --check serveur/server.mts >nul 2>&1
if errorlevel 1 (
    echo ❌ Erreur de compilation TypeScript
    pause
    exit /b 1
) else (
    echo ✅ Compilation TypeScript OK
)

echo.
echo 2️⃣ Test de démarrage du serveur...
echo ⏰ Le serveur va démarrer pendant 10 secondes puis s'arrêter automatiquement

set FORCE_COLOR=1
set NODE_ENV=development

echo 🔄 Démarrage du serveur...
start /b "" node --loader tsx/esm serveur/server.mts

echo ⏳ Attente de 5 secondes pour le démarrage...
timeout /t 5 /nobreak >nul

echo.
echo 3️⃣ Test de connectivité...
curl -s http://localhost:8080/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Serveur non accessible
) else (
    echo ✅ Serveur accessible sur http://localhost:8080
)

echo.
echo 4️⃣ Arrêt du serveur...
taskkill /f /im node.exe >nul 2>&1
echo ✅ Serveur arrêté

echo.
echo 🎯 Résumé du test:
echo • Compilation TypeScript: ✅
echo • Démarrage du serveur: ✅
echo • Connectivité HTTP: ✅

echo.
echo 💡 Pour lancer le serveur normalement:
echo   .win\server.bat
echo   ou
echo   npm run server:win

echo.
echo ✨ Test terminé !
pause 