from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE USUARIOS
# -----------------------------------------------------------------------------

class UsuarioBase(BaseModel):
    email: EmailStr
    nombre_completo: str
    rol: str = Field(..., description="Roles válidos: Administrador, Cajero, Repartidor")

class UsuarioCrear(UsuarioBase):
    password: str = Field(..., min_length=6, description="Contraseña en texto plano a hashear")

class UsuarioActualizar(BaseModel):
    email: Optional[EmailStr] = None
    nombre_completo: Optional[str] = None
    rol: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6, description="Nueva contraseña a hashear opcional")
    estado: Optional[str] = Field(None, description="Estados válidos: Activo, Inactivo")

class UsuarioRespuesta(UsuarioBase):
    id: UUID
    estado: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE CATEGORÍAS
# -----------------------------------------------------------------------------

class CategoriaBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None

class CategoriaCrear(CategoriaBase):
    pass

class CategoriaActualizar(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    estado: Optional[str] = Field(None, description="Estados válidos: Activo, Inactivo")

class CategoriaRespuesta(CategoriaBase):
    id: UUID
    estado: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True
