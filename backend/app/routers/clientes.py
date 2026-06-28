from fastapi import APIRouter, Depends, status, Query, HTTPException
from typing import List, Optional
from uuid import UUID
import httpx
import re
from app.schemas.modelos import ClienteCrear, ClienteActualizar, ClienteRespuesta
from app.services.clientes import ClienteService
from app.services.dependencias import verificar_roles
from app.services.bitacora import BitacoraService

router = APIRouter(prefix="/clientes", tags=["Clientes"])

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def crear_cliente(
    cliente: ClienteCrear,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Registra un nuevo cliente. Accesible por Administrador y Cajero.
    """
    resultado = ClienteService.crear_cliente(cliente)
    # Registrar en bitácora de forma atómica con el usuario_id real del JWT
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="CREAR",
        tabla_afectada="clientes",
        registro_id=resultado["id"],
        operacion="INSERT",
        detalles=f"Cliente registrado: '{resultado.get('nombre')}' (DNI/RUC: {resultado.get('dni_ruc')})",
        datos_nuevos={"nombre": resultado.get("nombre"), "telefono": resultado.get("telefono"), "estado": resultado.get("estado")}
    )
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.get("/", response_model=dict)
async def listar_clientes(
    incluir_inactivos: bool = False,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Lista todos los clientes. Accesible por todos los roles autorizados.
    """
    lista = ClienteService.obtener_todos(incluir_inactivos=incluir_inactivos)
    respuestas = [ClienteRespuesta.model_validate(c) for c in lista]
    return {"ok": True, "data": respuestas}

@router.get("/{cliente_id}", response_model=dict)
async def obtener_cliente(
    cliente_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Busca un cliente por su ID.
    """
    resultado = ClienteService.obtener_por_id(cliente_id)
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.put("/{cliente_id}", response_model=dict)
async def actualizar_cliente(
    cliente_id: UUID,
    cliente: ClienteActualizar,
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Actualiza la información de un cliente. Accesible por Administrador y Cajero.
    """
    # Capturar estado previo del cliente antes de la modificación
    cli_antes = ClienteService.obtener_por_id(cliente_id)
    resultado = ClienteService.actualizar_cliente(cliente_id, cliente)
    # Registrar modificación con snapshot diferencial (antes/después)
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="MODIFICAR",
        tabla_afectada="clientes",
        registro_id=cliente_id,
        operacion="UPDATE",
        detalles=f"Cliente actualizado: '{resultado.get('nombre')}'",
        datos_anteriores={k: cli_antes.get(k) for k in cliente.model_dump(exclude_unset=True)},
        datos_nuevos=cliente.model_dump(exclude_unset=True)
    )
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

@router.delete("/{cliente_id}", response_model=dict)
async def eliminar_cliente(
    cliente_id: UUID,
    usuario_actual: dict = Depends(verificar_roles(["Administrador"]))
):
    """
    Inactiva un cliente (Baja lógica). Requiere rol 'Administrador'.
    """
    resultado = ClienteService.eliminar_cliente(cliente_id)
    # Registrar baja lógica de cliente en bitácora
    BitacoraService.registrar_accion(
        usuario_id=usuario_actual["id"],
        accion="DESACTIVAR",
        tabla_afectada="clientes",
        registro_id=cliente_id,
        operacion="UPDATE",
        detalles=f"Cliente desactivado: '{resultado.get('nombre')}'",
        datos_anteriores={"estado": "Activo"},
        datos_nuevos={"estado": "Inactivo"}
    )
    respuesta = ClienteRespuesta.model_validate(resultado)
    return {"ok": True, "data": respuesta}

def extraer_coordenadas(url_str: str) -> Optional[tuple[float, float]]:
    # Patrón 1: /@lat,lng
    match = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', url_str)
    if match:
        return float(match.group(1)), float(match.group(2))
    
    # Patrón 2: /place/lat,lng o /place/lat+lng
    match = re.search(r'/place/(-?\d+\.\d+)(?:,|\+)(-?\d+\.\d+)', url_str)
    if match:
        return float(match.group(1)), float(match.group(2))
    
    # Patrón 3: q=lat,lng o query=lat,lng o center=lat,lng
    match = re.search(r'[?&](?:q|query|ll|center)=(-?\d+\.\d+),(-?\d+\.\d+)', url_str)
    if match:
        return float(match.group(1)), float(match.group(2))
        
    return None

@router.get("/resolver-enlace-mapa", response_model=dict)
@router.get("/resolver-enlace-mapa/", include_in_schema=False)
async def resolver_enlace_mapa(
    url: str = Query(..., description="URL acortada de Google Maps (ej: maps.app.goo.gl)"),
    usuario_actual: dict = Depends(verificar_roles(["Administrador", "Cajero"]))
):
    """
    Sigue las redirecciones de un enlace acortado o móvil de Google Maps de forma interna
    y extrae las coordenadas geográficas (latitud y longitud) reales.
    Evita bloqueos de CORS en el navegador.
    """
    try:
        # Se establece un User Agent real para evitar respuestas que no redireccionen
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(follow_redirects=True, headers=headers, timeout=10.0) as client:
            response = await client.get(url)
            final_url = str(response.url)
            
            # 1. Intentar extraer de la URL final
            coords = extraer_coordenadas(final_url)
            
            # 2. Si no se encuentran coordenadas en la URL, buscar en meta tags del cuerpo HTML
            if not coords and response.text:
                # Buscar en la URL del mapa estático en las meta tags
                meta_match = re.search(r'staticmap\?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', response.text)
                if meta_match:
                    coords = (float(meta_match.group(1)), float(meta_match.group(2)))
                else:
                    # Intentar buscar URL en formato general dentro del HTML
                    meta_match_og = re.search(r'meta content="https://maps.google.com/\?q=(-?\d+\.\d+),(-?\d+\.\d+)', response.text)
                    if meta_match_og:
                        coords = (float(meta_match_og.group(1)), float(meta_match_og.group(2)))
            
            if not coords:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se pudieron extraer las coordenadas geográficas del enlace proporcionado."
                )
            
            return {
                "ok": True,
                "data": {
                    "latitud": coords[0],
                    "longitud": coords[1]
                }
            }
    except httpx.HTTPError as ex:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al realizar la petición HTTP de resolución: {str(ex)}"
        )
    except HTTPException as ex:
        raise ex
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor al resolver el enlace de mapas: {str(ex)}"
        )
