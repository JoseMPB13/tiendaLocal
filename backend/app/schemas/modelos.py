from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal

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
    categoria_nombre: Optional[str] = None  # Campo enriquecido con join para el POS
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
    enlace_ubicacion: Optional[str] = None
    saldo_deudor: float = Field(0.00, ge=0)
    limite_credito: float = Field(0.00, ge=0)

class ClienteCrear(ClienteBase):
    pass

class ClienteActualizar(BaseModel):
    dni_ruc: Optional[str] = Field(None, max_length=20)
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    telefono: Optional[str] = Field(None, max_length=20)
    direccion: Optional[str] = None
    enlace_ubicacion: Optional[str] = None
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


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE VENTAS Y DETALLES
# -----------------------------------------------------------------------------

class DetalleVentaBase(BaseModel):
    producto_id: UUID
    cantidad: int = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)

class DetalleVentaCrear(DetalleVentaBase):
    pass

class DetalleVentaRespuesta(DetalleVentaBase):
    id: UUID
    venta_id: UUID
    subtotal: float

    class Config:
        from_attributes = True

class VentaBase(BaseModel):
    cliente_id: UUID
    usuario_id: Optional[UUID] = None
    codigo_factura: str = Field(..., max_length=50)
    tipo_pago: Literal['Efectivo', 'Tarjeta', 'Credito', 'Transferencia', 'QR'] = Field(..., description="Efectivo, Tarjeta, Credito, Transferencia, QR")

class VentaCrear(VentaBase):
    detalles: list[DetalleVentaCrear] = Field(..., min_items=1)

class VentaRespuesta(VentaBase):
    id: UUID
    total: float
    estado_venta: str
    fecha_venta: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE REPARTIDORES
# -----------------------------------------------------------------------------

class RepartidorBase(BaseModel):
    usuario_id: UUID
    vehiculo: Optional[str] = None
    placa: Optional[str] = Field(None, max_length=20)

class RepartidorCrear(RepartidorBase):
    pass

class RepartidorActualizar(BaseModel):
    vehiculo: Optional[str] = None
    placa: Optional[str] = None
    estado_repartidor: Optional[str] = Field(None, description="Disponible, En Ruta, Inactivo")

class RepartidorRespuesta(RepartidorBase):
    id: UUID
    estado_repartidor: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE ENVÍOS (DELIVERY)
# -----------------------------------------------------------------------------

class EnvioBase(BaseModel):
    venta_id: UUID
    repartidor_id: Optional[UUID] = None
    direccion_despacho: str
    costo_envio: float = Field(0.00, ge=0)

class EnvioCrear(EnvioBase):
    pass

class EnvioActualizar(BaseModel):
    repartidor_id: Optional[UUID] = None
    direccion_despacho: Optional[str] = None
    costo_envio: Optional[float] = Field(None, ge=0)
    estado_envio: Optional[str] = Field(None, description="Pendiente, En Camino, Entregado, Cancelado")

class EnvioRespuesta(EnvioBase):
    id: UUID
    estado_envio: str
    fecha_despacho: Optional[datetime] = None
    fecha_entrega: Optional[datetime] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE REPORTES Y DASHBOARD
# -----------------------------------------------------------------------------

class CategoriaVentas(BaseModel):
    name: str
    valor: float

class DashboardMetricas(BaseModel):
    total_ventas: float = Field(..., description="Suma total vendida")
    cantidad_transacciones: int = Field(..., description="Cantidad total de ventas registradas")
    deudas_activas_calle: float = Field(..., description="Suma total de saldos deudores de clientes")
    efectividad_delivery_porcentaje: float = Field(..., description="Porcentaje de entregas completadas con éxito")
    clientes_activos: int = Field(..., description="Cantidad de clientes activos registrados")
    ventas_por_categoria: list[CategoriaVentas] = Field(default=[], description="Distribución de ventas por categoría")

class MovimientoKardex(BaseModel):
    id: UUID
    producto_id: UUID
    nombre_producto: str
    cantidad_cambio: int
    tipo_movimiento: str
    referencia_id: Optional[UUID]
    fecha_movimiento: datetime

    class Config:
        from_attributes = True



