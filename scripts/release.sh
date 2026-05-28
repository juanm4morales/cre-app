#!/usr/bin/env bash
set -e

# --- DevOps & Data Engineering Release Script ---
# This script handles DB migrations and idempotent data seeding
# during the Render deployment release phase.

echo "=== STARTING RELEASE PHASE ==="

# 1. Auto-detect directory structure to find manage.py and the XLSX data
if [ -f "backend/manage.py" ]; then
    echo "Detected execution from repository root."
    MANAGE_PATH="backend/manage.py"
    XLSX_PATH="docs/Grupo Tiempos- Información para prueba de concepto.xlsx"
elif [ -f "manage.py" ]; then
    echo "Detected execution from backend/ subdirectory."
    MANAGE_PATH="manage.py"
    XLSX_PATH="../docs/Grupo Tiempos- Información para prueba de concepto.xlsx"
else
    echo "Error: manage.py not found! Cannot proceed with migrations or import."
    exit 1
fi

# 2. Run Django database migrations
echo "Step 1: Running database migrations..."
python "$MANAGE_PATH" migrate --noinput

# 3. Import / Sync academic data (Idempotent execution)
echo "Step 2: Syncing initial academic data for FCE..."
if [ -f "$XLSX_PATH" ]; then
    python "$MANAGE_PATH" import_academic_xlsx "$XLSX_PATH" \
        --unidad-sigla "FCE" \
        --unidad-nombre "Facultad de Ciencias Económicas" \
        --plan-credits 300 \
        --vigente-desde "2024-01-01"
    echo "Academic data synced successfully!"
else
    echo "Warning: Excel data file not found at $XLSX_PATH. Seeding skipped."
fi

echo "=== RELEASE PHASE COMPLETED SUCCESSFULLY ==="
