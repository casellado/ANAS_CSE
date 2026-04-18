#!/bin/bash
# ─────────────────────────────────────────────────────
#   ANAS SafeHub — Avvio locale automatico (Linux/Mac)
# ─────────────────────────────────────────────────────

cd "$(dirname "$0")"

echo
echo "==========================================="
echo "  ANAS SafeHub - Avvio locale"
echo "==========================================="
echo

# Verifica Python
if ! command -v python3 &> /dev/null; then
    echo "ERRORE: python3 non installato."
    echo "Installalo con: sudo apt install python3  (Linux)"
    echo "                brew install python       (Mac)"
    read -p "Premi Invio per chiudere..."
    exit 1
fi

PORTA=8765
echo "Server avviato su: http://localhost:$PORTA/"
echo
echo "Premi CTRL+C per chiudere il server."
echo

# Apri browser in background dopo 2s
(sleep 2 && {
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:$PORTA/"
    elif command -v open &> /dev/null; then
        open "http://localhost:$PORTA/"
    fi
}) &

# Avvia server (blocca terminale)
python3 -m http.server $PORTA
