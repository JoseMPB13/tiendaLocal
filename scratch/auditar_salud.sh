#!/bin/bash
# Script de auditoría de salud automatizado para TiendaLocal API

# Determinar URL de la API (desde argumento, variable de entorno o localhost por defecto)
API_URL=${1:-${VITE_API_URL:-"http://localhost:8000"}}

echo "=========================================================="
echo "    AUDITORÍA DE SALUD DE TIENDALOCAL API"
echo "    Objetivo: $API_URL/health"
echo "    Fecha: $(date)"
echo "=========================================================="

# Comprobar si curl está disponible
if ! command -v curl &> /dev/null; then
    echo "ERROR: 'curl' no está instalado en este entorno. Por favor instálelo para ejecutar auditorías."
    exit 1
fi

# Petición HTTP al endpoint de salud
echo "Realizando petición a $API_URL/health..."
RESPUESTA=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_URL/health")

# Extraer cuerpo y código de estado
CUERPO=$(echo "$RESPUESTA" | head -n -1)
STATUS=$(echo "$RESPUESTA" | tail -n 1 | cut -d':' -f2)

echo "Código de respuesta HTTP: $STATUS"
echo "Respuesta del servidor: $CUERPO"

# Comprobaciones de salud
if [ "$STATUS" -eq 200 ]; then
    # Validar si contiene la palabra "saludable"
    if echo "$CUERPO" | grep -q '"estado":"saludable"'; then
        echo "=========================================================="
        echo "  [ÉXITO] La API está funcionando y conectada a Supabase."
        echo "=========================================================="
        exit 0
    else
        echo "=========================================================="
        echo "  [ADVERTENCIA] Código HTTP 200 pero estado no saludable."
        echo "  Revise los detalles de la base de datos Supabase."
        echo "=========================================================="
        exit 1
    fi
else
    echo "=========================================================="
    echo "  [CRÍTICO] La API no responde correctamente."
    echo "  Compruebe si el servicio está levantado y revise logs."
    echo "=========================================================="
    exit 1
fi
