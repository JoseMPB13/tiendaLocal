# =============================================================================
# SERVICIO: clientes.py
# Propósito: Lógica de negocio y persistencia para la entidad Clientes.
# Gestiona validaciones de DNI, límites de crédito, saldo deudor y ahora
# extracción automática de coordenadas geográficas a partir de enlaces de mapas.
# Idioma: Español
# =============================================================================

import re
from typing import List, Tuple, Optional
from uuid import UUID
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from app.database import supabase
from app.schemas.modelos import ClienteCrear, ClienteActualizar

class ClienteService:
    @staticmethod
    def extraer_coordenadas_de_mapa(url: str) -> Tuple[Optional[float], Optional[float]]:
        """
        Analiza un enlace de mapa (Google Maps / OpenStreetMap) utilizando expresiones regulares
        para intentar extraer las coordenadas geográficas de latitud y longitud.
        
        Parámetros:
            url (str): Enlace del mapa.
            
        Retorna:
            Tuple[Optional[float], Optional[float]]: Latitud y longitud extraídas o (None, None).
        """
        if not url:
            return None, None
            
        # Patrón 1: @lat,lng (Formato estándar de Google Maps en la URL, ej: /maps/@-16.4839,-68.1302,17z)
        m1 = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
        if m1:
            try:
                return float(m1.group(1)), float(m1.group(2))
            except ValueError:
                pass
            
        # Patrón 2: q=lat,lng o ll=lat,lng o query=lat,lng (Formatos de parámetros query)
        m2 = re.search(r'[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)', url)
        if m2:
            try:
                return float(m2.group(1)), float(m2.group(2))
            except ValueError:
                pass
            
        # Patrón 3: OpenStreetMap, ej: #map=18/-16.4839/-68.1302
        m3 = re.search(r'#map=\d+/(-?\d+\.\d+)/(-?\d+\.\d+)', url)
        if m3:
            try:
                return float(m3.group(1)), float(m3.group(2))
            except ValueError:
                pass
            
        # Patrón 4: Coordenadas simples en la url separadas por place/lat,lng
        m4 = re.search(r'/place/(-?\d+\.\d+),(-?\d+\.\d+)', url)
        if m4:
            try:
                return float(m4.group(1)), float(m4.group(2))
            except ValueError:
                pass

        return None, None

    @staticmethod
    def crear_cliente(cliente: ClienteCrear) -> dict:
        """
        Crea un nuevo cliente. Valida que el límite de crédito no sea menor al saldo deudor inicial.
        Sincroniza y extrae coordenadas de ubicación geográfica de forma automatizada si aplica.
        
        Parámetros:
            cliente (ClienteCrear): Datos de entrada del cliente.
            
        Retorna:
            dict: Registro del cliente insertado en la base de datos.
        """
        if cliente.dni_ruc:
            dni_check = supabase.table("clientes").select("id").eq("dni_ruc", cliente.dni_ruc).execute()
            if dni_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El DNI/RUC ingresado ya se encuentra registrado."
                )

        if cliente.limite_credito < cliente.saldo_deudor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El límite de crédito ({cliente.limite_credito}) no puede ser menor al saldo deudor actual ({cliente.saldo_deudor})."
            )

        lat = cliente.latitud
        lng = cliente.longitud
        map_url = cliente.enlace_mapa or cliente.enlace_ubicacion

        # Si no se proveen coordenadas, intentamos extraerlas del enlace de ubicación/mapa
        if (lat is None or lng is None) and map_url:
            parsed_lat, parsed_lng = ClienteService.extraer_coordenadas_de_mapa(map_url)
            if parsed_lat is not None and parsed_lng is not None:
                lat = parsed_lat
                lng = parsed_lng

        nuevo_cli = {
            "dni_ruc": cliente.dni_ruc,
            "nombre": cliente.nombre,
            "telefono": cliente.telefono,
            "direccion": cliente.direccion,
            "enlace_ubicacion": map_url,
            "enlace_mapa": map_url,
            "latitud": lat,
            "longitud": lng,
            "saldo_deudor": cliente.saldo_deudor,
            "limite_credito": cliente.limite_credito,
            "estado": "Activo"
        }

        try:
            resultado = supabase.table("clientes").insert(nuevo_cli).execute()
            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo registrar el cliente en la base de datos."
                )
            return resultado.data[0]
        except APIError as ex:
            if ex.code == "23514":  # Restricción CHECK de Postgres
                if "chk_clientes_latitud_rango" in ex.message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La latitud ingresada no es válida. Debe estar entre -90 y 90."
                    )
                elif "chk_clientes_longitud_rango" in ex.message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La longitud ingresada no es válida. Debe estar entre -180 y 180."
                    )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de base de datos al registrar cliente: {ex.message}"
            )

    @staticmethod
    def obtener_todos(incluir_inactivos: bool = False) -> List[dict]:
        """
        Retorna la lista de clientes.
        
        Parámetros:
            incluir_inactivos (bool): Indica si se retornan clientes inactivos.
            
        Retorna:
            List[dict]: Listado de clientes encontrados.
        """
        query = supabase.table("clientes").select("*")
        if not incluir_inactivos:
            query = query.eq("estado", "Activo")
        
        resultado = query.execute()
        return resultado.data or []

    @staticmethod
    def obtener_por_id(cliente_id: UUID) -> dict:
        """
        Busca un cliente por su UUID.
        
        Parámetros:
            cliente_id (UUID): Identificador único del cliente.
            
        Retorna:
            dict: Registro del cliente encontrado.
        """
        resultado = supabase.table("clientes").select("*").eq("id", str(cliente_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado."
            )
        return resultado.data[0]

    @staticmethod
    def actualizar_cliente(cliente_id: UUID, cliente: ClienteActualizar) -> dict:
        """
        Actualiza la información del cliente. Valida estrictamente límite_crédito >= saldo_deudor.
        Procesa, sincroniza y autocompleta latitud y longitud a partir del enlace de mapas si aplica.
        
        Parámetros:
            cliente_id (UUID): Identificador del cliente.
            cliente (ClienteActualizar): Datos con campos a actualizar.
            
        Retorna:
            dict: Registro del cliente actualizado.
        """
        cli_actual = ClienteService.obtener_por_id(cliente_id)
        datos_actualizar = cliente.model_dump(exclude_unset=True)

        # Validación estricta de saldo deudor contra límite de crédito
        s_deudor = datos_actualizar.get("saldo_deudor", cli_actual["saldo_deudor"])
        l_credito = datos_actualizar.get("limite_credito", cli_actual["limite_credito"])

        if l_credito < s_deudor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El límite de crédito ({l_credito}) no puede ser menor al saldo deudor actual ({s_deudor})."
            )

        # Validar si se está intentando inactivar un cliente con deudas activas
        if datos_actualizar.get("estado") == "Inactivo" and s_deudor > 0.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede inactivar un cliente con deudas pendientes."
            )

        # Sincronización de enlaces de mapas/ubicaciones y extracción automática de coordenadas
        map_url = datos_actualizar.get("enlace_mapa") or datos_actualizar.get("enlace_ubicacion")
        if "enlace_mapa" in datos_actualizar or "enlace_ubicacion" in datos_actualizar:
            datos_actualizar["enlace_mapa"] = map_url
            datos_actualizar["enlace_ubicacion"] = map_url

        lat_update = datos_actualizar.get("latitud")
        lng_update = datos_actualizar.get("longitud")

        # Si se actualizó el mapa pero no las coordenadas de forma explícita, intentamos extraerlas
        if (lat_update is None or lng_update is None) and map_url:
            parsed_lat, parsed_lng = ClienteService.extraer_coordenadas_de_mapa(map_url)
            if parsed_lat is not None and parsed_lng is not None:
                if "latitud" not in datos_actualizar or datos_actualizar["latitud"] is None:
                    datos_actualizar["latitud"] = parsed_lat
                if "longitud" not in datos_actualizar or datos_actualizar["longitud"] is None:
                    datos_actualizar["longitud"] = parsed_lng

        try:
            resultado = supabase.table("clientes").update(datos_actualizar).eq("id", str(cliente_id)).execute()
            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo actualizar el cliente."
                )
            return resultado.data[0]
        except APIError as ex:
            if ex.code == "23514":  # Restricción CHECK de Postgres
                if "chk_clientes_latitud_rango" in ex.message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La latitud ingresada no es válida. Debe estar entre -90 y 90."
                    )
                elif "chk_clientes_longitud_rango" in ex.message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La longitud ingresada no es válida. Debe estar entre -180 y 180."
                    )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de base de datos al actualizar cliente: {ex.message}"
            )

    @staticmethod
    def eliminar_cliente(cliente_id: UUID) -> dict:
        """
        Baja lógica del cliente (estado = 'Inactivo').
        
        Parámetros:
            cliente_id (UUID): Identificador del cliente.
            
        Retorna:
            dict: Registro inactivo del cliente.
        """
        cli_actual = ClienteService.obtener_por_id(cliente_id)

        # Validar si posee saldo deudor mayor a 0
        if cli_actual.get("saldo_deudor", 0.0) > 0.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede inactivar un cliente con deudas pendientes."
            )

        resultado = supabase.table("clientes").update({"estado": "Inactivo"}).eq("id", str(cliente_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo inactivar al cliente."
            )
        return resultado.data[0]
