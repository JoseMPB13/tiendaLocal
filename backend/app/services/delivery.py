from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import RepartidorCrear, RepartidorActualizar, EnvioCrear, EnvioActualizar
from postgrest.exceptions import APIError

class DeliveryService:
    # -------------------------------------------------------------------------
    # OPERACIONES DEL REPARTIDOR
    # -------------------------------------------------------------------------
    @staticmethod
    def registrar_repartidor(repartidor: RepartidorCrear) -> dict:
        """
        Registra un usuario con rol de Repartidor en la tabla correspondiente.
        """
        # Verificar que el usuario exista y tenga el rol de Repartidor
        usr = supabase.table("usuarios").select("rol, estado").eq("id", str(repartidor.usuario_id)).execute()
        if not usr.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario especificado no existe."
            )
        if usr.data[0]["rol"] != "Repartidor":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario seleccionado debe poseer el rol 'Repartidor'."
            )

        # Validar si ya está registrado en repartidores
        rep_check = supabase.table("repartidores").select("id").eq("usuario_id", str(repartidor.usuario_id)).execute()
        if rep_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este usuario ya se encuentra registrado como repartidor."
            )

        nuevo_rep = {
            "usuario_id": str(repartidor.usuario_id),
            "vehiculo": repartidor.vehiculo,
            "placa": repartidor.placa,
            "estado_repartidor": "Disponible"
        }

        resultado = supabase.table("repartidores").insert(nuevo_rep).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el perfil de repartidor."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_todos_repartidores() -> List[dict]:
        resultado = supabase.table("repartidores").select("*").execute()
        return resultado.data or []

    @staticmethod
    def obtener_repartidor_por_id(repartidor_id: UUID) -> dict:
        resultado = supabase.table("repartidores").select("*").eq("id", str(repartidor_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repartidor no encontrado."
            )
        return resultado.data[0]

    @staticmethod
    def actualizar_repartidor(repartidor_id: UUID, datos: RepartidorActualizar) -> dict:
        DeliveryService.obtener_repartidor_por_id(repartidor_id)
        datos_up = datos.model_dump(exclude_unset=True)
        resultado = supabase.table("repartidores").update(datos_up).eq("id", str(repartidor_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar el repartidor."
            )
        return resultado.data[0]

    # -------------------------------------------------------------------------
    # OPERACIONES DE ENVÍOS (DESPACHO)
    # -------------------------------------------------------------------------
    @staticmethod
    def registrar_envio(envio: EnvioCrear) -> dict:
        """
        Crea un registro de despacho para una venta específica.
        """
        # Verificar existencia de la venta
        vta = supabase.table("ventas").select("id").eq("id", str(envio.venta_id)).execute()
        if not vta.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La venta especificada no existe."
            )

        # Validar si ya cuenta con registro de envío
        env_check = supabase.table("envios").select("id").eq("venta_id", str(envio.venta_id)).execute()
        if env_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe una orden de delivery asociada a esta venta."
            )

        # Validar repartidor si se asigna inicialmente
        if envio.repartidor_id:
            DeliveryService.obtener_repartidor_por_id(envio.repartidor_id)

        nuevo_env = {
            "venta_id": str(envio.venta_id),
            "repartidor_id": str(envio.repartidor_id) if envio.repartidor_id else None,
            "direccion_despacho": envio.direccion_despacho,
            "costo_envio": envio.costo_envio,
            "estado_envio": "Pendiente"
        }

        resultado = supabase.table("envios").insert(nuevo_env).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar la orden de envío."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_todos_envios() -> List[dict]:
        # Se incluyen latitud, longitud y enlace_mapa del cliente para que el
        # frontend pueda renderizar el mapa interactivo en la vista administrativa
        query = supabase.table("envios")\
            .select("*, ventas(id, cliente_id, clientes(nombre, telefono, direccion, enlace_ubicacion, enlace_mapa, latitud, longitud))")\
            .execute()

        envios_formateados = []
        for e in (query.data or []):
            venta = e.get("ventas") or {}
            cliente_data = venta.get("clientes") or {}
            e_formateado = {
                "id": e["id"],
                "venta_id": e["venta_id"],
                "repartidor_id": e["repartidor_id"],
                "direccion_despacho": e["direccion_despacho"],
                "costo_envio": float(e["costo_envio"]) if e.get("costo_envio") is not None else 0.0,
                "estado_envio": e["estado_envio"],
                "fecha_despacho": e["fecha_despacho"],
                "fecha_entrega": e["fecha_entrega"],
                "fecha_creacion": e["fecha_creacion"],
                "fecha_actualizacion": e["fecha_actualizacion"],
                "motivo_cancelacion": e.get("motivo_cancelacion"),
                "cliente": {
                    "nombre_completo": cliente_data.get("nombre", ""),
                    "telefono": cliente_data.get("telefono", ""),
                    "direccion": cliente_data.get("direccion", ""),
                    "enlace_ubicacion": cliente_data.get("enlace_ubicacion", ""),
                    "enlace_mapa": cliente_data.get("enlace_mapa", ""),
                    # Coordenadas geográficas del cliente para el mapa interactivo
                    "latitud": cliente_data.get("latitud"),
                    "longitud": cliente_data.get("longitud")
                }
            }
            envios_formateados.append(e_formateado)
        return envios_formateados

    @staticmethod
    def obtener_envio_por_id(envio_id: UUID) -> dict:
        resultado = supabase.table("envios").select("*").eq("id", str(envio_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Orden de envío no encontrada."
            )
        return resultado.data[0]

    @staticmethod
    def actualizar_envio(envio_id: UUID, datos: EnvioActualizar, usuario_actual: dict) -> dict:
        """
        Actualiza el estado y datos del envío. Bloquea modificaciones si ya figura como Entregado o Cancelado.
        Aplica control de transiciones y propiedad para Repartidores, y asignación atómica.
        """
        try:
            envio_act = DeliveryService.obtener_envio_por_id(envio_id)
            datos_up = datos.model_dump(exclude_unset=True)

            # Validación obligatoria del motivo de cancelación
            if datos_up.get("estado_envio") == "Cancelado":
                motivo = datos_up.get("motivo_cancelacion")
                if not motivo or not motivo.strip():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Debe proporcionar un motivo de cancelación obligatorio para cancelar el envío."
                    )

            # Determinar el repartidor_id efectivo para validar
            rep_id_efectivo = None
            if usuario_actual["rol"] == "Repartidor":
                rep_res = supabase.table("repartidores").select("id").eq("usuario_id", str(usuario_actual["id"])).execute()
                if rep_res.data:
                    rep_id_efectivo = rep_res.data[0]["id"]
            else:
                rep_id_efectivo = datos_up.get("repartidor_id") or envio_act.get("repartidor_id")

            # Comprobar si se está intentando iniciar ruta o asignar repartidor
            es_asignacion_ruta = (
                datos_up.get("estado_envio") == "En Camino" or 
                ("repartidor_id" in datos_up and datos_up["repartidor_id"] is not None)
            )

            if es_asignacion_ruta:
                if not rep_id_efectivo:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Se requiere un repartidor asignado para iniciar la ruta."
                    )
                
                # Obtener el repartidor de la base de datos
                rep_data = supabase.table("repartidores").select("usuario_id").eq("id", str(rep_id_efectivo)).execute()
                if not rep_data.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El repartidor especificado no existe."
                    )
                
                usr_id = rep_data.data[0]["usuario_id"]
                # Consultar el rol del usuario en la base de datos
                usr_data = supabase.table("usuarios").select("rol").eq("id", str(usr_id)).execute()
                if not usr_data.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El usuario asociado al repartidor no existe."
                    )
                
                rol_usuario = usr_data.data[0]["rol"]
                if rol_usuario != "Repartidor":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El usuario asignado no tiene el rol de Repartidor."
                    )

            if usuario_actual["rol"] == "Repartidor":
                # Buscar perfil de repartidor
                rep_res = supabase.table("repartidores").select("id").eq("usuario_id", str(usuario_actual["id"])).execute()
                if not rep_res.data:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="El usuario actual no tiene asignado un perfil de repartidor válido."
                    )
                repartidor_autenticado_id = rep_res.data[0]["id"]

                if envio_act["estado_envio"] == "Pendiente":
                    # Fase de autoasignación: debe pasar a 'En Camino'
                    if datos_up.get("estado_envio") != "En Camino":
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Un repartidor solo puede cambiar el estado de un envío 'Pendiente' a 'En Camino'."
                        )
                    
                    # Asignar forzosamente a sí mismo
                    datos_up["repartidor_id"] = str(repartidor_autenticado_id)
                    datos_up["fecha_despacho"] = datetime.utcnow().isoformat()
                    
                    # Ejecutar actualización atómica filtrando por repartidor_id IS NULL y estado_envio = 'Pendiente'
                    resultado = supabase.table("envios")\
                        .update(datos_up)\
                        .eq("id", str(envio_id))\
                        .is_("repartidor_id", "null")\
                        .eq("estado_envio", "Pendiente")\
                        .execute()
                    
                    if not resultado.data:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="Conflicto de asignación: el envío ya ha sido tomado por otro repartidor o ya no está disponible."
                        )
                    return resultado.data[0]

                elif envio_act["estado_envio"] == "En Camino":
                    # Fase de entrega: comprobar que sea el repartidor asignado
                    if not envio_act["repartidor_id"] or str(envio_act["repartidor_id"]) != str(repartidor_autenticado_id):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Acceso denegado: no puedes modificar un envío que está asignado a otro repartidor o no te pertenece."
                        )
                    
                    nuevo_estado = datos_up.get("estado_envio")
                    if nuevo_estado not in ["Entregado", "Cancelado"]:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Un repartidor en ruta solo puede cambiar el estado a 'Entregado' o 'Cancelado'."
                        )
                    
                    # Deshabilitar que modifique otros datos que no sean el estado_envio
                    claves_restringidas = ["repartidor_id", "direccion_despacho", "costo_envio"]
                    for clave in claves_restringidas:
                        if clave in datos_up and datos_up[clave] is not None and str(datos_up[clave]) != str(envio_act.get(clave)):
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"No tienes permitido modificar el campo '{clave}' en ruta activa."
                            )
                    
                    if nuevo_estado == "Entregado":
                        datos_up["fecha_entrega"] = datetime.utcnow().isoformat()

                    resultado = supabase.table("envios").update(datos_up).eq("id", str(envio_id)).execute()
                    if not resultado.data:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="No se pudo actualizar el estado del envío."
                        )
                    return resultado.data[0]

                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se permite modificar un envío finalizado en estado '{envio_act['estado_envio']}'."
                    )
            else:
                # Roles Administrador o Cajero
                if envio_act["estado_envio"] in ["Entregado", "Cancelado"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se permite modificar una orden de envío que ya figura como '{envio_act['estado_envio']}'."
                    )
                
                # Ajuste de fechas automáticas para el delivery
                if "estado_envio" in datos_up:
                    if datos_up["estado_envio"] == "En Camino":
                        datos_up["fecha_despacho"] = datetime.utcnow().isoformat()
                    elif datos_up["estado_envio"] == "Entregado":
                        datos_up["fecha_entrega"] = datetime.utcnow().isoformat()

                if "repartidor_id" in datos_up and datos_up["repartidor_id"]:
                    DeliveryService.obtener_repartidor_por_id(UUID(str(datos_up["repartidor_id"])))

                resultado = supabase.table("envios").update(datos_up).eq("id", str(envio_id)).execute()
                if not resultado.data:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="No se pudo actualizar la orden de envío."
                    )
                return resultado.data[0]
        except APIError as ex:
            if ex.code == "42501":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permiso denegado por políticas RLS (SQLSTATE 42501): {ex.message}"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en base de datos (SQLSTATE {ex.code}): {ex.message}"
            )

    @staticmethod
    def obtener_envios_activos_repartidor(usuario_actual: dict) -> List[dict]:
        """
        Obtiene los envíos con estado 'En Camino' asignados al repartidor autenticado.
        Enriquece cada registro con la información de contacto del cliente de forma anidada.
        """
        rep_res = supabase.table("repartidores").select("id").eq("usuario_id", str(usuario_actual["id"])).execute()
        if not rep_res.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario actual no tiene asignado un perfil de repartidor válido."
            )
        repartidor_id = rep_res.data[0]["id"]

        # Se incluyen latitud, longitud y enlace_mapa para pintar el destino
        # del repartidor en el mapa interactivo de DeliveryReparto.jsx
        query = supabase.table("envios")\
            .select("*, ventas(id, cliente_id, clientes(nombre, telefono, direccion, enlace_ubicacion, enlace_mapa, latitud, longitud))")\
            .eq("repartidor_id", str(repartidor_id))\
            .eq("estado_envio", "En Camino")\
            .execute()

        envios_formateados = []
        for e in (query.data or []):
            venta = e.get("ventas") or {}
            cliente_data = venta.get("clientes") or {}

            e_formateado = {
                "id": e["id"],
                "venta_id": e["venta_id"],
                "repartidor_id": e["repartidor_id"],
                "direccion_despacho": e["direccion_despacho"],
                "costo_envio": float(e["costo_envio"]) if e.get("costo_envio") is not None else 0.0,
                "estado_envio": e["estado_envio"],
                "fecha_despacho": e["fecha_despacho"],
                "fecha_entrega": e["fecha_entrega"],
                "fecha_creacion": e["fecha_creacion"],
                "fecha_actualizacion": e["fecha_actualizacion"],
                "motivo_cancelacion": e.get("motivo_cancelacion"),
                "cliente": {
                    "nombre_completo": cliente_data.get("nombre", ""),
                    "telefono": cliente_data.get("telefono", ""),
                    "direccion": cliente_data.get("direccion", ""),
                    "enlace_ubicacion": cliente_data.get("enlace_ubicacion", ""),
                    "enlace_mapa": cliente_data.get("enlace_mapa", ""),
                    # Coordenadas para renderizar el mapa de destino en pantalla
                    "latitud": cliente_data.get("latitud"),
                    "longitud": cliente_data.get("longitud")
                }
            }
            envios_formateados.append(e_formateado)
        return envios_formateados

    @staticmethod
    def cancelar_envio(envio_id: UUID, motivo: str) -> dict:
        """
        Realiza una baja lógica del envío cambiando su estado a 'Cancelado'.
        Nunca elimina el registro físico de la base de datos.
        Solo se permite cancelar envíos en estado 'Pendiente'.
        """
        # Verificar que el envío exista
        envio_act = DeliveryService.obtener_envio_por_id(envio_id)

        # Solo se permite cancelar envíos que aún están en estado Pendiente
        if envio_act["estado_envio"] != "Pendiente":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden cancelar envíos en estado 'Pendiente'. Estado actual: '{envio_act['estado_envio']}'."
            )

        # Validar que el motivo de cancelación no sea vacío
        if not motivo or not motivo.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe proporcionar un motivo de cancelación para registrar la baja lógica del envío."
            )

        # Aplicar la baja lógica: actualizar estado a 'Cancelado' y guardar el motivo
        datos_cancelacion = {
            "estado_envio": "Cancelado",
            "motivo_cancelacion": motivo.strip()
        }
        resultado = supabase.table("envios").update(datos_cancelacion).eq("id", str(envio_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar la cancelación del envío."
            )
        return resultado.data[0]

