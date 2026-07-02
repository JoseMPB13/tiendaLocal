from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, ConfigDict
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
    imagen_url: Optional[str] = None

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
    imagen_url: Optional[str] = None

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
    enlace_mapa: Optional[str] = None
    latitud: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitud: Optional[float] = Field(None, ge=-180.0, le=180.0)
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
    enlace_mapa: Optional[str] = None
    latitud: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitud: Optional[float] = Field(None, ge=-180.0, le=180.0)
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
    codigo_factura: Optional[str] = Field(default=None, max_length=50, description="Código de factura de la venta. Si es nulo o vacío se autogenera.")
    tipo_pago: Literal['Efectivo', 'Tarjeta', 'Credito', 'Transferencia', 'QR'] = Field(..., description="Efectivo, Tarjeta, Credito, Transferencia, QR")

class VentaCrear(VentaBase):
    detalles: list[DetalleVentaCrear] = Field(..., min_items=1)
    para_delivery: bool = Field(default=False, description="Indica si la venta requiere envío a domicilio")
    direccion_despacho: Optional[str] = Field(default=None, description="Dirección física de envío")
    costo_envio: Optional[Decimal] = Field(default=Decimal('0.00'), ge=0, description="Costo de transporte del delivery")
    latitud: Optional[float] = Field(default=None, description="Latitud de destino")
    longitud: Optional[float] = Field(default=None, description="Longitud de destino")

class VentaRespuesta(VentaBase):
    id: UUID
    total: float
    estado_venta: str
    fecha_venta: datetime
    para_delivery: bool = False
    direccion_despacho: Optional[str] = None
    costo_envio: float = 0.00
    latitud: Optional[float] = None
    longitud: Optional[float] = None

    class Config:
        from_attributes = True

class VentaConDetallesRespuesta(VentaRespuesta):
    detalles: list[DetalleVentaRespuesta]

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
    # Campos de posición GPS en tiempo real (nulos si el repartidor no está en ruta)
    latitud_actual: Optional[float] = None
    longitud_actual: Optional[float] = None
    ultima_actualizacion_gps: Optional[datetime] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE SEGUIMIENTO GPS EN TIEMPO REAL
# -----------------------------------------------------------------------------

class UbicacionActualizar(BaseModel):
    """Cuerpo del endpoint de alta frecuencia PUT /delivery/mi-ubicacion."""
    latitud: float = Field(..., ge=-90.0, le=90.0, description="Latitud GPS del repartidor")
    longitud: float = Field(..., ge=-180.0, le=180.0, description="Longitud GPS del repartidor")


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE CONFIGURACIÓN DEL SISTEMA
# -----------------------------------------------------------------------------

class ConfiguracionSistemaCrear(BaseModel):
    """Cuerpo para crear o actualizar (upsert) una configuración del sistema."""
    clave: str = Field(..., max_length=100, description="Clave única de configuración. Ej: kiosco_latitud")
    valor: Optional[str] = Field(None, description="Valor de la configuración en formato texto")

class ConfiguracionSistemaRespuesta(BaseModel):
    id: UUID
    clave: str
    valor: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE ENVÍOS (DELIVERY)
# -----------------------------------------------------------------------------

class EnvioBase(BaseModel):
    venta_id: UUID
    repartidor_id: Optional[UUID] = None
    direccion_despacho: str
    costo_envio: float = Field(0.00, ge=0)
    latitud: Optional[float] = None
    longitud: Optional[float] = None

class ClienteContacto(BaseModel):
    nombre_completo: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    enlace_ubicacion: Optional[str] = None
    enlace_mapa: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None

class EnvioCrear(EnvioBase):
    pass

class EnvioActualizar(BaseModel):
    repartidor_id: Optional[UUID] = None
    direccion_despacho: Optional[str] = None
    costo_envio: Optional[float] = Field(None, ge=0)
    estado_envio: Optional[str] = Field(None, description="Pendiente, En Camino, Entregado, Cancelado")
    motivo_cancelacion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None

class EnvioRespuesta(EnvioBase):
    id: UUID
    estado_envio: str
    fecha_despacho: Optional[datetime] = None
    fecha_entrega: Optional[datetime] = None
    motivo_cancelacion: Optional[str] = None
    cliente: Optional[ClienteContacto] = None
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
    clientes_activos: int = Field(default=0, description="Cantidad de clientes activos registrados")
    pedidos_delivery: int = Field(default=0, description="Cantidad absoluta de pedidos por delivery")
    productos_vendidos: int = Field(default=0, description="Cantidad total de productos/unidades vendidos")
    ventas_por_categoria: list[CategoriaVentas] = Field(default=[], description="Distribución de ventas por categoría")
    tendencia_ventas: float = Field(default=0.00, description="Porcentaje de crecimiento/tendencia de ventas")

class MovimientoKardex(BaseModel):
    id: UUID
    producto_id: UUID
    nombre_producto: str
    cantidad_cambio: int
    tipo_movimiento: str
    referencia_id: Optional[UUID]
    motivo: Optional[str] = None
    fecha_movimiento: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE COMPRAS (Reabastecimiento)
# -----------------------------------------------------------------------------

class DetalleCompraCrear(BaseModel):
    producto_id: UUID
    cantidad: int = Field(..., gt=0)
    costo_unitario: Decimal = Field(..., ge=0)

class CompraCrear(BaseModel):
    proveedor_nombre: Optional[str] = Field(default=None, max_length=150)
    codigo_referencia: Optional[str] = Field(default=None, max_length=100)
    detalles: list[DetalleCompraCrear] = Field(..., min_items=1)

class DetalleCompraRespuesta(BaseModel):
    id: UUID
    compra_id: UUID
    producto_id: UUID
    cantidad: int
    costo_unitario: Decimal
    subtotal: Decimal
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CompraRespuesta(BaseModel):
    id: UUID
    usuario_id: UUID
    proveedor_nombre: Optional[str] = None
    codigo_referencia: Optional[str] = None
    total: Decimal
    estado_compra: str
    fecha_compra: datetime

    model_config = ConfigDict(from_attributes=True)

class ProductoReabastecer(BaseModel):
    producto_id: UUID
    cantidad: int = Field(..., gt=0, description="Cantidad a ingresar")
    costo_compra: Decimal = Field(..., ge=0, description="Nuevo costo de compra unitario")
    codigo_referencia: Optional[str] = Field(default=None, max_length=100, description="Código de factura o nota de referencia")


class ProductoAjustarStock(BaseModel):
    cantidad: int = Field(..., description="Cantidad de cambio (positivo para ingresos, negativo para egresos/mermas)")
    justificacion: str = Field(..., min_length=3, max_length=255, description="Justificación técnica del movimiento de inventario")


class CompraConDetallesRespuesta(CompraRespuesta):
    detalles: list[DetalleCompraRespuesta]

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# ESQUEMAS PARA EL MÓDULO DE BITÁCORA Y AUDITORÍA
# -----------------------------------------------------------------------------

class MovimientoStockAgrupadoRespuesta(BaseModel):
    periodo_fecha: datetime
    periodo_fecha_bolivia: Optional[str] = None
    producto_id: UUID
    producto_nombre: str
    tipo_movimiento: str
    total_entradas: Decimal
    total_salidas: Decimal
    balance_neto: Decimal
    cantidad_movimientos: int

    model_config = ConfigDict(from_attributes=True)

class UsuarioMini(BaseModel):
    nombre_completo: str
    email: str

    model_config = ConfigDict(from_attributes=True)

class BitacoraUsuarioRespuesta(BaseModel):
    id: UUID
    usuario_id: Optional[UUID] = None
    accion: str
    tabla_afectada: str
    registro_id: UUID
    detalles: Optional[str] = None
    fecha: datetime
    fecha_bolivia: Optional[str] = None
    # Campos de captura diferencial agregados en la migración de normalización
    operacion: Optional[str] = None        # Tipo DML: INSERT, UPDATE, DELETE
    datos_anteriores: Optional[dict] = None  # Snapshot JSONB del estado previo
    datos_nuevos: Optional[dict] = None      # Snapshot JSONB del estado nuevo
    usuarios: Optional[UsuarioMini] = None  # Enriquecido con el join de la tabla usuarios

    model_config = ConfigDict(from_attributes=True)




