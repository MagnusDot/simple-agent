@echo off
REM Script de raccourci pour lancer le CLI depuis n'importe où
cd /d "%~dp0\.."
call ".win\cli.bat" %* 