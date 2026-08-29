#!/bin/zsh
# Запуск ScaleQL
cd "$(dirname "$0")"
[ -f .env ] && export $(grep -v '^#' .env | xargs)
open http://localhost:8777
exec .venv/bin/python platform/app.py
