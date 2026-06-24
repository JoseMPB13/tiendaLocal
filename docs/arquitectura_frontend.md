# Arquitectura del Frontend - TiendaLocal

Este documento describe la arquitectura, diseño visual y organización de la interfaz de usuario para el proyecto **TiendaLocal**.

## 1. Stack Tecnológico
- **Core:** **React (v18+)** con empaquetador **Vite** para desarrollo ultra veloz.
- **Estilos:** **Tailwind CSS** puro para interfaces responsivas, optimizadas y ligeras.
- **Gestión de Estado Global:** **Zustand**, implementando almacenamiento atómico y persistencia en localStorage para sesiones activas.
- **Enrutamiento:** **React Router Dom (v6+)** para controlar la navegación y la protección de vistas basadas en roles.
- **Iconografía:** **Lucide React**.

## 2. Estructura de Directorios (`/frontend/src`)
La aplicación se organiza bajo una arquitectura modular limpia:
- `/components/`: Componentes comunes reutilizables (ej. `RutaProtegida.jsx`, `LayoutEscritorio.jsx`, `LayoutDelivery.jsx`).
- `/store/`: Manejadores de estado atómico de Zustand (ej. `authStore.js`).
- `/routes.jsx`: Archivo centralizador de la configuración de enrutadores.
- `/views/`: Pantallas principales de la aplicación (Login, POS, Dashboard, Productos, Clientes, Delivery).

## 3. Layouts Responsivos
El sistema discrimina y adapta su interfaz gráfica según el dispositivo y el rol de usuario:
1. **Layout de Escritorio (Sidebar colapsable):** Diseñado para pantallas de laptops y computadoras. Exclusivo para el rol `Administrador` y `Cajero`. Ofrece una navegación rápida a través de pestañas laterales para la caja y reportes.
2. **Layout Móvil (Tab Bar inferior fijo):** Diseñado y adaptado para dispositivos celulares táctiles. Optimizado para el rol `Repartidor` para consulta rápida de rutas activas y marcas de entrega bajo luz del día en exteriores.

## 4. Estado Global de Sesión (`authStore.js`)
- Gestiona las propiedades de sesión: `usuario`, `token`, `rol` y `autenticado`.
- Registra el rol del operador activo para inyectar dinámicamente la cabecera `X-User-Rol` en todas las peticiones salientes al backend de FastAPI.
- Persiste los datos de sesión de manera local mediante `localStorage` de forma transparente.

## 5. Gestión del Carrito del Punto de Venta (`cartStore.js`)
- Maneja el estado atómico del carrito POS: listado de productos agregados, cantidad solicitada, cliente seleccionado para el comprobante, código de la factura y método de pago.
- **Aritmética Monetaria Precisa (Centavos):** Para mitigar errores de redondeo IEEE 754 asociados a floats en JavaScript, todos los cálculos de totales se procesan internamente multiplicando precios y subtotales por 100 usando `Math.round(precio * 100)` para trabajar con centavos enteros en el acumulador. El resultado es dividido entre 100 únicamente al ser retornado para su renderizado.
- **Validaciones Integradas:** Controla que la cantidad de ítems no exceda el `stock_actual` disponible de forma reactiva en el cliente.
- **Control de Crédito Local:** Si el método de pago seleccionado es "Crédito", valida en caliente que la suma de la deuda existente del cliente más el total a cobrar no supere su `limite_credito` autorizado, rechazando la venta antes de enviarla.

## 6. Funcionalidad de Escucha Activa de Código de Barras (POS)
- Para acelerar la atención de cajeros, el input del buscador en `PuntoVenta.jsx` escucha continuamente.
- Si el texto ingresado coincide exactamente con la clave `codigo_barras` de un producto del catálogo, añade automáticamente el producto al carrito con cantidad inicial 1 y limpia el input de inmediato de forma automatizada, permitiendo emular el comportamiento de una pistola lectora física sin interrumpir el flujo.

## 7. Cliente HTTP y Comunicación con API (`api.js`)
- Configurado centralizadamente mediante **Axios** para conectar el cliente React con la API de FastAPI.
- **Intercepción de Peticiones:** Añade de forma transparente el token Bearer (`Authorization`) y el rol activo del operador (`X-User-Rol`) a partir de la información del `authStore` antes de despacharse al backend, garantizando la seguridad en la pasarela.
- **Gobernanza del Servidor en Ventas:** El backend FastAPI valida y gobierna de forma estricta los datos clave de la venta. El campo `usuario_id` es ignorado del payload recibido y sobrescrito con la identidad segura obtenida del token JWT. Asimismo, los precios unitarios de los ítems son validados y recalculados en base al catálogo oficial de la base de datos para productos activos, rechazando transacciones con precios alterados o productos inactivos.

## 8. Flujo de Confirmación de Pago y Captura de Errores
- **Consulta Correlativa en Tiempo Real:** El POS realiza llamadas dinámicas a `/api/ventas/proximo-numero-factura` al cargar la vista y limpiar el carrito para desplegar el próximo correlativo de factura y sincronizarlo con el estado del carrito (`setCodigoFactura`), brindando total transparencia al cajero.
- **Modal de Pago Dinámico:** Al finalizar la compra, se abre un modal de confirmación. En efectivo, requiere ingresar la cantidad recibida y calcula en caliente el vuelto. En ventas a crédito, despliega el estado actual de la deuda y el nuevo saldo proyectado del cliente para aprobación antes de la transacción.
- **Captura de Excepciones Transaccionales:** Utiliza `react-hot-toast` para desplegar alertas en español si el backend FastAPI o Supabase rechazan la transacción arrojando errores controlados por triggers (como `Stock insuficiente` o `Límite de crédito excedido`).

## 8b. Módulo del Historial de Ventas (CRUD e Integración)
- **Interfaz de Pestañas Responsivas:** Permite conmutar fluidamente entre "Nueva Venta" (POS) e "Historial de Ventas" con una navegación intuitiva y reactiva.
- **Diseño Dual y Responsivo (CSS Grid & Flexbox):** El historial de ventas se adapta dinámicamente según el tamaño de la pantalla:
  - *Vista de Escritorio:* Una tabla estructurada (`hidden lg:block`) que muestra fecha, código de factura, método de pago, monto total y estado.
  - *Vista Móvil:* Tarjetas de información colapsables (`block lg:hidden`) compactas y fáciles de escanear en pantallas táctiles pequeñas.
- **Filtros e Historial Paginado:** Implementa filtros reactivos por estado (`Todas`, `Completada`, `Cancelada`, `Pendiente`) y controles de paginación estructurados mediante `ventaService.obtenerVentas(params)`.
- **Vista Detallada de Comprobantes:** Modal responsivo que carga de forma atómica a través de `obtenerVentaDetalle(id)` la cabecera enriquecida con información del cliente y la lista completa de artículos asociados con su correspondiente subtotal.
- **Proceso de Anulación / Cancelación Lógica:** Un botón interactivo permite ejecutar `cancelarVenta(id)` (cambiando `estado_venta = 'Cancelada'`). El backend procesa de manera transaccional la reversión del stock de productos y la deudas del cliente. El frontend actualiza los estados en tiempo real sin requerir una recarga completa de la página, refrescando los balances locales del catálogo de productos y clientes.

## 9. Flujo Móvil del Repartidor (`DeliveryReparto.jsx`)
- **Organización por Acordeones Colapsables:** Los envíos se agrupan en acordeones según su estado logístico. Aquellos en estado "En Camino" se muestran expandidos por defecto para prioridad táctil, mientras que los "Pendientes" e históricos permanecen contraídos para descongestionar la pantalla.
- **Acciones Seguras (Gesto Swipe):** Para impedir marcas de entrega o tránsito accidentales durante el trayecto, se integra el componente `DeslizadorInteractivo.jsx`, requiriendo un arrastre continuo del control deslizante hasta el 92% para consolidar la actualización de estado.
- **Enlaces Geográficos Dinámicos:** Cuenta con redirección nativa al mapa del dispositivo móvil mediante protocolo `geo:0,0?q=` con fallback integrado a Google Maps vía web, permitiendo abrir la ruta de destino de forma fluida.

## 10. Dashboard de Administración y Auditorías (`DashboardAdmin.jsx`, `KardexInventario.jsx`)
- **Visualización de Estadísticas Interactivas:** Utiliza **Recharts** para graficar de forma dinámica la distribución y participación de ventas del negocio por categoría de producto mediante gráficos de barras y pastel.
- **Auditoría de Historial de Stock:** El kárdex presenta una interfaz tabular donde se consultan los movimientos filtrados por producto, rango de fechas y tipo de variación (compras, ventas, mermas por ajuste).
- **Cierre de Caja Diario en PDF:** El botón de cierre diario abre una nueva pestaña del navegador apuntando directamente a la ruta de streaming del backend (`/reportes/cierre-pdf`), la cual sirve el archivo binario dinámico permitiendo visualizarlo en el lector nativo de PDF e imprimirlo con facilidad.

## 11. Gestión de Catálogos y CRUDs Administrativos (`GestionCategorias.jsx`, `GestionProductos.jsx`, `GestionClientes.jsx`, `GestionUsuarios.jsx`)
- **Modales Flotantes:** Los formularios de creación y edición se presentan mediante modales interactivos superpuestos en la misma pantalla. Esto permite registrar y actualizar registros de forma rápida y fluida sin redireccionamientos ni pérdida de contexto.
- **Paginación Clásica (`PaginadorTablas.jsx`):** Diseñado con botones de "Anterior", "Siguiente" y acceso a páginas numeradas en la parte inferior de las tablas de datos para garantizar la legibilidad y un control estructurado de los conjuntos de datos.
- **Confirmación de Baja Lógica (`ModalDesactivar.jsx`):** Todas las acciones de inactivación muestran un modal flotante personalizado con advertencias claras de las implicaciones (ej: bloqueo de acceso para usuarios, desaparición en POS para productos, o exclusión de selectores para clientes). La desactivación se envía mediante una petición de actualización para cambiar el campo `estado` a `'Inactivo'` (Baja Lógica), asegurando la conservación de los datos para auditoría histórica.
- **Gestión de Usuarios y Seguridad:** El módulo `GestionUsuarios.jsx` está protegido estrictamente por rol permitiendo acceso únicamente a usuarios con rol `Administrador`. Incluye un botón interactivo (ojo) para ocultar/mostrar la contraseña y validaciones de longitud mínima de 6 caracteres en el cliente.

## 12. Rendimiento y Seguridad de Ciclo de Vida en el POS
- **Debounce de Búsqueda de Productos:** Para proteger el hilo de ejecución principal de React y evitar refiltrar la colección completa de productos con cada pulsación de tecla, se introdujo un debounce de 300ms. Al escribir en la barra de búsqueda, el filtrado semántico por nombre se pospone hasta 300ms de inactividad de teclado, previniendo re-renderizados innecesarios.
- **Lector de Códigos de Barra Instantáneo:** El debounce se aplica de forma selectiva. Si el valor ingresado corresponde a un código de barras exacto, el sistema detecta de forma instantánea la coincidencia, añade el producto al carrito sin demoras y limpia el input, asegurando una experiencia ágil con lectores físicos.
- **AbortController en Peticiones Asíncronas:** El efecto de carga de inventario inicial (`useEffect`) integra la API nativa de `AbortController`. Si el componente se desmonta porque el cajero navega hacia otra sección antes de que resuelvan las promesas de la API, las llamadas Axios HTTP pendientes son canceladas de forma segura (`controller.abort()`), evitando fugas de memoria y actualizaciones de estado sobre componentes desmontados.
- **Resiliencia ante Datos Obsoletos:** El sistema confía en la validación atómica del Backend. Si al presionar "Confirmar Venta" la API de ventas retorna una falla de stock o precio obsoleto (HTTP 400), el frontend captura el error de forma controlado en un bloque `try/catch`, muestra el detalle descriptivo con un toast y recarga inmediatamente el catálogo local para refrescar los stocks en pantalla.






