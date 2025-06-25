@echo off
chcp 65001 >nul
echo 🚀 Démarrage du CLI Agent...
echo.
node --loader tsx/esm CLI/cli.mts %* 