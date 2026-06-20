from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import CategoriaCrear, CategoriaActualizar

class CategoriaService:
    @staticmethod
    def crear_categoria(categoria: CategoriaCrear) -> dict:
        """
        Crea una nueva categoría de productos.
        """
        # Verificar si ya existe el nombre
        nombre_check = supabase.table("categorias").select("id").eq("nombre", categoria.nombre).execute()
        if nombre_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La categoría '{categoria.nombre}' ya se encuentra registrada."
            )

        nueva_cat = {
            "nombre": categoria.nombre,
            "descripcion": categoria.descripcion,
            "estado": "Activo"
        }

        resultado = supabase.table("categorias").insert(nueva_cat).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar la categoría."
            )
        return resultado.data[0]

    @staticmethod
    def obtener_todas(incluir_inactivas: bool = False) -> List[dict]:
        """
        Retorna la lista de categorías. Por defecto filtra solo las que tienen estado 'Activo'.
        """
        query = supabase.table("categorias").select("*")
        if not incluir_inactivas:
            query = query.eq("estado", "Activo")
        
        resultado = query.execute()
        return resultado.data or []

    @staticmethod
    def obtener_por_id(categoria_id: UUID) -> dict:
        """
        Busca una categoría por su identificador UUID.
        """
        resultado = supabase.table("categorias").select("*").eq("id", str(categoria_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Categoría no encontrada."
            )
        return resultado.data[0]

    @staticmethod
    def actualizar_categoria(categoria_id: UUID, categoria: CategoriaActualizar) -> dict:
        """
        Actualiza los datos de una categoría.
        """
        CategoriaService.obtener_por_id(categoria_id)

        datos_actualizar = categoria.model_dump(exclude_unset=True)
        resultado = supabase.table("categorias").update(datos_actualizar).eq("id", str(categoria_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar la categoría."
            )
        return resultado.data[0]

    @staticmethod
    def eliminar_categoria(categoria_id: UUID) -> dict:
        """
        Eliminación lógica de una categoría (cambia el atributo estado a 'Inactivo').
        Regla estricta: Bajas Lógicas.
        """
        CategoriaService.obtener_por_id(categoria_id)

        resultado = supabase.table("categorias").update({"estado": "Inactivo"}).eq("id", str(categoria_id)).execute()
        if not resultado.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo inactivar la categoría."
            )
        return resultado.data[0]
