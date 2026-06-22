from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import RepartidorCrear, RepartidorActualizar, EnvioCrear, EnvioActualizar

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
        query = supabase.table("envios")\
            .select("*, ventas(id, cliente_id, clientes(nombre, telefono, direccion, enlace_ubicacion))")\
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
                    "enlace_ubicacion": cliente_data.get("enlace_ubicacion", "")
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
                DeliveryService.obtener_repartidor_por_id(UUID(datos_up["repartidor_id"]))

            resultado = supabase.table("envios").update(datos_up).eq("id", str(envio_id)).execute()
            if not resultado.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo actualizar la orden de envío."
                )
            return resultado.data[0]

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

        query = supabase.table("envios")\
            .select("*, ventas(id, cliente_id, clientes(nombre, telefono, direccion, enlace_ubicacion))")\
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
                    "enlace_ubicacion": cliente_data.get("enlace_ubicacion", "")
                }
            }
            envios_formateados.append(e_formateado)
        return envios_formateados

