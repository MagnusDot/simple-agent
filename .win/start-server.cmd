@echo off
REM Script de raccourci pour lancer le serveur depuis n'importe où
cd /d "%~dp0\.."
call ".win\server.bat" %* 