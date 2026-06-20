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
        resultado = supabase.table("envios").select("*").execute()
        return resultado.data or []

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
    def actualizar_envio(envio_id: UUID, datos: EnvioActualizar) -> dict:
        """
        Actualiza el estado y datos del envío. Bloquea modificaciones si ya figura como Entregado.
        """
        envio_act = DeliveryService.obtener_envio_por_id(envio_id)

        # REGLA DE NEGOCIO: Bloquear modificaciones si ya fue Entregado
        if envio_act["estado_envio"] == "Entregado":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se permite modificar una orden de envío que ya figura como 'Entregado'."
            )

        datos_up = datos.model_dump(exclude_unset=True)

        # Ajuste de fechas automáticas para el delivery
        if "estado_envio" in datos_up:
            if datos_up["estado_envio"] == "En Camino":
                datos_up["fecha_despacho"] = datetime.utcnow().isoformat()
            elif datos_up["estado_envio"] == "Entregado":
                datos_up["fecha_entrega"] = datetime.utcnow().isoformat()

        # Validar repartidor si se está actualizando
        if "repartidor_id" in datos_up and datos_up["repartidor_id"]:
            DeliveryService.obtener_repartidor_por_id(UUID(datos_up["repartidor_id"]))

        resultado = supabase.table("envios").update(datos_up).eq("id", str(envio_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar la orden de envío."
            )
        return resultado.data[0]
