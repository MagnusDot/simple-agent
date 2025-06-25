@echo off
chcp 65001 >nul
echo 🔥 Démarrage du serveur Agent...
echo.
echo 🔄 Lancement en cours...
set FORCE_COLOR=1
set NODE_ENV=development
node --loader tsx/esm serveur/server.mts
if errorlevel 1 (
    echo.
    echo ❌ Erreur lors du lancement du serveur
    pause
) 