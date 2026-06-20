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


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE PRODUCTOS
# -----------------------------------------------------------------------------

class ProductoBase(BaseModel):
    categoria_id: UUID
    codigo_barras: Optional[str] = Field(None, max_length=50)
    nombre: str = Field(..., min_length=2, max_length=150)
    descripcion: Optional[str] = None
    precio_compra: float = Field(..., ge=0)
    precio_venta: float = Field(..., ge=0)
    stock_actual: int = Field(0, ge=0)
    stock_minimo: int = Field(5, ge=0)

class ProductoCrear(ProductoBase):
    pass

class ProductoActualizar(BaseModel):
    categoria_id: Optional[UUID] = None
    codigo_barras: Optional[str] = Field(None, max_length=50)
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    descripcion: Optional[str] = None
    precio_compra: Optional[float] = Field(None, ge=0)
    precio_venta: Optional[float] = Field(None, ge=0)
    stock_actual: Optional[int] = Field(None, ge=0)
    stock_minimo: Optional[int] = Field(None, ge=0)
    estado: Optional[str] = Field(None, description="Estados válidos: Activo, Inactivo")

class ProductoRespuesta(ProductoBase):
    id: UUID
    estado: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE CLIENTES
# -----------------------------------------------------------------------------

class ClienteBase(BaseModel):
    dni_ruc: Optional[str] = Field(None, max_length=20)
    nombre: str = Field(..., min_length=2, max_length=150)
    telefono: Optional[str] = Field(None, max_length=20)
    direccion: Optional[str] = None
    saldo_deudor: float = Field(0.00, ge=0)
    limite_credito: float = Field(0.00, ge=0)

class ClienteCrear(ClienteBase):
    pass

class ClienteActualizar(BaseModel):
    dni_ruc: Optional[str] = Field(None, max_length=20)
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    telefono: Optional[str] = Field(None, max_length=20)
    direccion: Optional[str] = None
    saldo_deudor: Optional[float] = Field(None, ge=0)
    limite_credito: Optional[float] = Field(None, ge=0)
    estado: Optional[str] = Field(None, description="Estados válidos: Activo, Inactivo")

class ClienteRespuesta(ClienteBase):
    id: UUID
    estado: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True

