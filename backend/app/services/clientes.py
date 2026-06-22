from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import ClienteCrear, ClienteActualizar

class ClienteService:
    @staticmethod
    def crear_cliente(cliente: ClienteCrear) -> dict:
        """
        Crea un nuevo cliente. Valida que el límite de crédito no sea menor al saldo deudor inicial.
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

        nuevo_cli = {
            "dni_ruc": cliente.dni_ruc,
            "nombre": cliente.nombre,
            "telefono": cliente.telefono,
            "direccion": cliente.direccion,
            "saldo_deudor": cliente.saldo_deudor,
            "limite_credito": cliente.limite_credito,
            "estado": "Activo"
        }

        resultado = supabase.table("clientes").insert(nuevo_cli).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el cliente en la base de datos."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_todos(incluir_inactivos: bool = False) -> List[dict]:
        """
        Retorna la lista de clientes.
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

        resultado = supabase.table("clientes").update(datos_actualizar).eq("id", str(cliente_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar el cliente."
            )
        return resultado.data[0]

    @staticmethod
    def eliminar_cliente(cliente_id: UUID) -> dict:
        """
        Baja lógica del cliente (estado = 'Inactivo').
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
