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

## 5b. Panel de Estadísticas y Descripciones en el POS (`PuntoVenta.jsx`)
- **Renderizado de Descripciones:** Las tarjetas del catálogo muestran de forma elegante la descripción del producto (`prod.descripcion`) con tamaño de fuente pequeño (`text-[10px] text-slate-500`) y con límite de desborde (`line-clamp-2`), optimizando el alto de la tarjeta a `170px`.
- **Panel de Estadísticas Rápidas:** Añade una sección informativa arriba del listado del carrito que expone en tiempo real:
  - **Total de Venta y Unidades:** Total de la venta acumulado y sumatoria de unidades de artículos en el carrito.
  - **Cliente Seleccionado:** Nombre del cliente activo y resalte rojo de su saldo deudor si este es mayor a cero.
  - **Alertas de Stock Críticas:** Notificación visual roja reactiva si un producto del carrito cuenta con stock crítico (`stock_actual <= stock_minimo`) o si la cantidad en caja iguala/excede la capacidad física disponible (`cantidad >= stock_actual`).
  - **Historial de Sesión:** Listado rápido con las últimas 3 facturas registradas en la pestaña activa del navegador, con opción de pre-visualizar el ticket térmico usando un botón rápido de inspección visual (`Eye`).

## 6. Funcionalidad de Escucha Activa de Código de Barras (POS)
- Para acelerar la atención de cajeros, el input del buscador en `PuntoVenta.jsx` escucha continuamente.
- Si el texto ingresado coincide exactamente con la clave `codigo_barras` de un producto del catálogo, añade automáticamente el producto al carrito con cantidad inicial 1 y limpia el input de inmediato de forma automatizada, permitiendo emular el comportamiento de una pistola lectora física sin interrumpir el flujo.

## 7. Cliente HTTP y Comunicación con API (`api.js`)
- Configurado centralizadamente mediante **Axios** para conectar el cliente React con la API de FastAPI.
- **Intercepción de Peticiones:** Añade de forma transparente el token Bearer (`Authorization`) y el rol activo del operador (`X-User-Rol`) a partir de la información del `authStore` antes de despacharse al backend, garantizando la seguridad en la pasarela.
- **Gobernanza del Servidor en Ventas:** El backend FastAPI valida y gobierna de forma estricta los datos clave de la venta. El campo `usuario_id` es ignorado del payload recibido y sobrescrito con la identidad segura obtenida del token JWT. Asimismo, los precios unitarios de los ítems son validados y recalculados en base al catálogo oficial de la base de datos para productos activos, rechazando transacciones con precios alterados o productos inactivos.

## 8. Flujo de Confirmación de Pago y Captura de Errores
- **Consulta Correlativa en Tiempo Real:** El POS realiza llamadas dinámicas a `/api/ventas/proximo-numero-factura` mediante la función asíncrona `sincronizarProximoCodigoFactura` al cargar la vista por primera vez (montaje), y tras procesar con éxito una venta o cancelar una edición. Esto asegura que el correlativo esté libre antes de la próxima transacción, evitando colisiones de claves primarias (`SQLSTATE 23505`).
- **Modal de Pago Dinámico con Delivery e Integración de Mapa:** Al finalizar la compra, se abre un modal de cobro. Si la casilla de Delivery está marcada, se renderiza el componente `<MapaInteractivo />` inicializado dinámicamente con las coordenadas del cliente seleccionado o con las coordenadas por defecto de Santa Cruz de la Sierra (`[-17.7833, -63.1667]`).
- **Geocodificación Inversa de Despacho Única:** La interacción con el mapa del POS realiza una geocodificación inversa automática mediante Nominatim para autocompletar de forma exclusiva el estado `direccionDespacho` (usado para el payload `direccion_despacho` de la venta), sin alterar el objeto de cliente ni realizar modificaciones en sus datos maestros de base de datos.
- **Captura de Excepciones Transaccionales:** Utiliza `react-hot-toast` para desplegar alertas en español si el backend FastAPI o Supabase rechazan la transacción arrojando errores controlados por triggers (como `Stock insuficiente` o `Límite de crédito excedido`).

## 8b. Módulo del Historial de Ventas, Edición e Impresión de Facturas
- **Interfaz de Pestañas Responsivas:** Permite conmutar fluidamente entre "Nueva Venta" (POS) e "Historial de Ventas" con una navegación intuitiva y reactiva.
- **Diseño Dual y Responsivo (CSS Grid & Flexbox):** El historial de ventas se adapta dinámicamente según el tamaño de la pantalla:
  - *Vista de Escritorio:* Una tabla estructurada (`hidden lg:block`) que muestra fecha, código de factura, método de pago, monto total y estado.
  - *Vista Móvil:* Tarjetas de información colapsables (`block lg:hidden`) compactas y fáciles de escanear en pantallas táctiles pequeñas.
- **Filtros e Historial Paginado:** Implementa filtros reactivos por estado (`Todas`, `Completada`, `Cancelada`, `Pendiente`) y controles de paginación estructurados mediante `ventaService.obtenerVentas(params)`.
- **Vista Detallada y Comprobante Térmico:** Modal interactivo responsivo (scrolleable en móviles) que carga de forma atómica mediante `obtenerVentaDetalle(id)` la información de la factura. Emula la visualización de un tique térmico corporativo de 80mm. Se levanta de forma automática inmediatamente después de completar con éxito una venta en el POS.
- **Flujo de Impresión Físico Optimizado:** El modal del recibo integra un botón de "Imprimir Comprobante" que dispara `window.print()`. Utiliza una directiva `@media print` en [index.css](file:///c:/Users/josem/Desktop/tienda/frontend/src/index.css) que oculta toda la interfaz de la aplicación React y expone únicamente el tique escalado para ticketeras y terminales POS de 80mm con máxima nitidez.
- **Operación de Edición / Ajuste de Venta:**
  - El usuario puede presionar el botón de editar (`Edit2` de Lucide) en el historial de ventas. Esto carga la venta completa de regreso al carrito del POS (incluyendo cliente, método de pago y productos).
  - **Stock Dinámico Ajustado:** Durante la edición, el stock de productos disponible en el catálogo del cajero se incrementa de forma dinámica sumando las cantidades originales vendidas en esa transacción, permitiendo reajustes lógicos consistentes.
  - **Advertencia Visual de Reajuste:** Si el usuario altera el carrito original (agrega productos, elimina o cambia cantidades), la interfaz del POS despliega inmediatamente una alerta de advertencia en color ámbar/naranja sobre el reajuste físico del stock que se ejecutará en la base de datos.
  - **Actualización Transaccional Atómica:** Al guardar los cambios, el POS despacha los datos al backend FastAPI que los procesa en la base de datos a través de la función `actualizar_venta(uuid, uuid, varchar, jsonb, boolean, text, numeric)`. Esto revierte de forma transaccional el stock y deudas previas y aplica las nuevas especificaciones de forma atómica en un único bloque transaccional seguro.
- **Proceso de Anulación / Cancelación Lógica:** Un botón interactivo permite ejecutar `cancelarVenta(id)` (cambiando `estado_venta = 'Cancelada'`). El backend procesa de manera transaccional la reversión del stock de productos y la deudas del cliente. El frontend actualiza los estados en tiempo real sin requerir una recarga completa de la página, refrescando los balances locales del catálogo de productos y clientes.

## 9. Flujo Móvil del Repartidor (`DeliveryReparto.jsx`)
- **Organización por Acordeones Colapsables:** Los envíos se agrupan en acordeones según su estado logístico. Aquellos en estado "En Camino" se muestran expandidos por defecto para prioridad táctil, mientras que los "Pendientes" e históricos permanecen contraídos para descongestionar la pantalla.
- **Acciones Seguras (Gesto Swipe):** Para impedir marcas de entrega o tránsito accidentales durante el trayecto, se integra el componente `DeslizadorInteractivo.jsx`, requiriendo un arrastre continuo del control deslizante hasta el 92% para consolidar la actualización de estado.
- **Enlaces Geográficos Dinámicos:** Cuenta con redirección nativa al mapa del dispositivo móvil mediante protocolo `geo:0,0?q=` con fallback integrado a Google Maps vía web, permitiendo abrir la ruta de destino de forma fluida.

## 10. Dashboard de Administración y Auditorías (`DashboardAdmin.jsx`, `BitacoraSistema.jsx`)
- **Visualización de Estadísticas Interactivas:** Utiliza **Recharts** para graficar de forma dinámica la distribución y participación de ventas del negocio por categoría de producto mediante gráficos de barras y pastel.
- **Bitácora del Sistema (Pestañas Duales):** Sustituye el antiguo kárdex plano por una interfaz integrada y unificada:
  - **Pestaña 1: Movimientos de Inventario:** Permite auditar el flujo de stock de productos mediante filtros de intervalo temporal dinámicos (**Día, Semana, Mes**) con conmutadores premium. Las métricas (total transacciones, ingresos, salidas y balance neto) se calculan y actualizan de forma reactiva en base al período. Es completamente adaptativa en celulares (las filas de la tabla colapsan en tarjetas de datos compactas).
  - **Pestaña 2: Auditoría de Usuarios:** Muestra un listado cronológico de las acciones del personal (creaciones, modificaciones, bajas lógicas, anulaciones) detallando operador, módulo afectado y justificación. En celulares se presenta como una línea de tiempo (Timeline) vertical interactiva con avatares de usuario.
- **Descarga Directa de Reporte PDF (Fase 2):** El botón de cierre de caja utiliza ahora las bibliotecas `jspdf` y `html2canvas` para estructurar, renderizar y descargar directamente desde el cliente el reporte de cierre en formato PDF. Esto evita dependencias de impresión nativas del navegador y permite:
  - **Títulos Dinámicos:** Si la consulta corresponde a un día único (Fecha Inicio = Fecha Fin), el reporte y el documento PDF se titulan `"REPORTE DE CIERRE DIARIO - [FECHA]"`. Si se realiza sobre un intervalo de fechas, se titula `"REPORTE DE CIERRE GENERAL - PERIODO [FECHA_INICIO] AL [FECHA_FIN]"`.
  - **Contenido del Documento:** Consolida un reporte formal en escala de grises y diseño corporativo con métricas financieras completas (Ventas, Deudas, Reparto de Delivery y Productos vendidos), una tabla de participación de mercado por categoría de producto y bloques de firmas físicas para la validación del administrador y del auditor de caja.


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

## 13. Integración de Reabastecimiento e Historial de Compras en Productos (`GestionProductos.jsx`)
- **Interfaz de Pestañas Duales:** Se integró el submódulo de compras en la vista de Productos mediante pestañas conmutables ("Catálogo de Productos" e "Historial de Reabastecimientos"). Esto unifica la experiencia visual y mantiene la coherencia de estilos de la aplicación.
- **Acceso Directo y Modal de Reabastecimiento Rápido:**
  - El botón con el ícono `Plus` en el catálogo de productos funciona como atajo rápido para reabastecer stock de un producto específico.
  - Abre un modal diseñado exactamente como los formularios del CRUD de productos. Permite ingresar: Nombre del Proveedor, Cantidad a ingresar, Costo de compra unitario y un Código de Referencia / Nota opcional (asociando de forma segura el `producto_id` de la fila seleccionada).
  - *Validación Temprana de Costo:* Compara en tiempo real el costo unitario ingresado con el precio de venta del catálogo, alertando si el costo es superior para prevenir un fallo de base de datos.
- **Historial de Compras Adaptable (Responsive):**
  - Consume el servicio `compraService.obtenerCompras()` y despliega los reabastecimientos realizados.
  - *Diseño de Escritorio:* Tabla tradicional que indica fecha, proveedor, código de referencia, importe total y estado ('Completada' o 'Cancelada').
  - *Diseño Móvil:* Transforma de manera responsiva las filas de la tabla en tarjetas de datos organizadas.
- **Modal de Detalle del Reabastecimiento:** Muestra el desglose de productos adquiridos con sus nombres enriquecidos, cantidades, costos y subtotales.
- **Anulación Lógica de Compras:** Admite la cancelación mediante el procedimiento `cancelarCompra(id)` en la base de datos (restringido a administradores), revirtiendo el stock de productos de forma segura y controlando que no resulte en inventario negativo.

## 13b. Panel de Filtros y Mini-Dashboard de Inventario (`GestionProductos.jsx`)
- **Panel de Filtros Modular (`PanelFiltroBusqueda.jsx`):** Se integró un componente modular en la parte superior del catálogo de productos que permite filtrar reactivamente la lista por nombre del producto o por su código de barras, así como por la categoría asociada. La tabla y el paginador se ajustan dinámicamente y reinician el contador a la página 1 al interactuar con el filtro.
- **Mini-Dashboard de Inventario:** Se inyectó un panel horizontal antes de la tabla del catálogo con 4 tarjetas de métricas calculadas en tiempo real:
  - *Stock Bajo:* Conteo de productos activos con existencia inferior o igual al stock mínimo.
  - *Valor del Inventario:* Capital invertido acumulado (`stock_actual * precio_compra`) para todos los productos activos.
  - *Margen de Ganancia Promedio:* Porcentaje del margen de ganancia promedio (`((precio_venta - precio_compra) / precio_compra) * 100`) para productos activos con costo de compra positivo.
  - *Variedad del Catálogo:* Sumatoria de productos activos únicos registrados.

## 14. Integración del Mapa Interactivo y Geolocalización de Clientes (`GestionClientes.jsx`, `MapaInteractivo.jsx`)
- **Controlador del Mapa Wrapper de Leaflet (`MapaInteractivo.jsx`):**
  - Implementado mediante la biblioteca principal `leaflet` directamente asociada al DOM con React refs (`useRef`) y hooks de ciclo de vida (`useEffect`). Esto asegura total compatibilidad con **React 19** y evita peer dependencies obsoletas que podrían causar fallos en la compilación de Vite.
  - **Corrección de Reactividad Unificada:** Para resolver condiciones de carrera y des-sincronizaciones (donde el mapa no se actualizaba al pegar enlaces), se consolidó la inicialización y actualización reactiva en un único efecto `useEffect` dependiente de `[lat, lng, soloLectura]`. Si la instancia del mapa es nula, se crea; de lo contrario, se actualiza la posición del marcador y la vista del mapa de forma imperativa.
  - **Evitar Bucles con Tolerancia:** Se implementó una tolerancia absoluta de `0.00001` al comparar la posición del marcador actual y las coordenadas entrantes para evitar rebotes infinitos y re-renderizados innecesarios.
  - **Carga de Contenedor en Modales:** Ejecuta `map.invalidateSize()` con un pequeño retardo de `100ms` tras la creación para corregir fallos visuales donde el mapa renderizaba gris o incompleto dentro de contenedores modal de React.
  - Se configuró el centro de inicio operativo por defecto en **Santa Cruz de la Sierra, Bolivia** (Latitud `-17.7833`, Longitud `-63.1667`) si el cliente no cuenta con coordenadas guardadas.
  - Resuelve las imágenes de marcadores Leaflet por defecto en la compilación estática de Vite (`marker-icon.png`, `marker-shadow.png`).
- **Captura Bidireccional de Coordenadas:**
  - El modal de creación/edición de clientes incluye el mapa interactivo. Si el cliente cuenta con coordenadas previas, el mapa centra el marcador automáticamente.
  - El usuario puede hacer clic en cualquier punto del mapa o arrastrar el marcador para actualizar los inputs numéricos de latitud y longitud en tiempo real.
  - **Parser Universal de Enlaces en Caliente (onChange / onPaste / onBlur):** Se agregaron escuchadores para los eventos de cambio y pegado en el input. Al recibir un enlace válido (ej. que contenga `@-17.7833,-63.1821` o `q=-17.7833,-63.1821`), se extraen la Latitud y Longitud reactivamente, actualizando el mapa y centrando el marcador en tiempo real. Este parser es completamente agnóstico al dominio (soporta dominios de producción como `google.com` u `openstreetmap.org`, así como subdominios mock de desarrollo como `googleusercontent.com` y placeholders). Adicionalmente, cuenta con un fallback agresivo que detecta cualquier secuencia consecutiva de coordenadas decimales.
  - **Validación Geográfica Estricta:** Antes de adoptar cualquier par de coordenadas extraídas, el sistema verifica que la Latitud se encuentre en el rango [-90, 90] y la Longitud en el rango [-180, 180], previniendo saltos de marcador erráticos ante enlaces mal formados. Esto actualiza los estados locales y gatilla la sincronización imperativa hacia el mapa.
- **Geocodificación Inversa con OpenStreetMap Nominatim:**
  - Al interactuar con el mapa (hacer clic o terminar de arrastrar el marcador) o al resolver un enlace pegado/cambiado, se dispara una consulta asíncrona a la API gratuita de geocodificación inversa de Nominatim.
  - Extrae el nombre de la calle, avenida, barrio o localidad del JSON de respuesta y lo inyecta automáticamente en el input de **"Dirección"** del cliente.
  - Se implementó un control de llamadas discretas (únicamente en eventos finalizados como `dragend`, `click` y en detecciones de enlaces válidos) para no violar el límite de uso de la API Nominatim (máximo 1 petición/segundo) ni saturar la conexión mientras el usuario interactúa.
- **Acceso Rápido y Modal de Vista Previa:**
  - Si un cliente cuenta con coordenadas, se muestra un icono `MapPin` de color fucsia en la tabla de escritorio o en la tarjeta móvil.

## 14b. Búsqueda, Filtros y Mini-Dashboard del Módulo de Clientes (`GestionClientes.jsx`, `PanelFiltroBusqueda.jsx`)
- **Extensión del Componente de Filtro:** Se modificó `PanelFiltroBusqueda.jsx` para soportar de manera opcional parámetros de Estado (`estadoSeleccionado`, `alCambiarEstado`) y Deuda (`deudaSeleccionada`, `alCambiarDeuda`). Esto mantiene la modularidad del componente, asegurando compatibilidad con el catálogo de productos mientras unifica la visualización y estilos de los filtros de clientes.
- **Filtrado Multi-Parámetro de Clientes:** `GestionClientes.jsx` filtra la colección en base a coincidencias insensibles a mayúsculas sobre Nombre, DNI/RUC o Teléfono, junto con los selectores de Estado (Activos/Inactivos) y condición de Deuda (con o sin saldo pendiente).
- **Mini-Dashboard de Cartera y Crédito:** Se renderiza en la parte superior un panel con 4 tarjetas estadísticas dinámicas:
  - **Clientes Activos:** Conteo de clientes en estado `Activo`.
  - **Con Deuda:** Cantidad de deudores con `saldo_deudor > 0`.
  - **Cartera en la Calle:** Suma monetaria total acumulada de saldos deudores pendientes de cobro.
  - **Promedio Límite de Crédito:** Promedio del límite de crédito asignado a todos los registros.


## 15. Módulo de Envíos y Reparto (Delivery)

### 15a. Backend: Enriquecimiento de Respuesta con Coordenadas Geográficas
- Los métodos `obtener_todos_envios` y `obtener_envios_activos_repartidor` en `backend/app/services/delivery.py` incluyen ahora en su SELECT de Supabase los campos `latitud`, `longitud` y `enlace_mapa` del cliente asociado a la venta. Estos datos viajan en el objeto `cliente` anidado dentro de cada envío y son consumidos directamente por el frontend para renderizar el mapa.

### 15b. Backend: Baja Lógica de Envíos (`DELETE /delivery/envios/{id}`)
- Se implementó el endpoint `DELETE /delivery/envios/{envio_id}` en `backend/app/routers/delivery.py`.
- **Política de integridad:** Nunca elimina el registro físicamente. Cambia el `estado_envio` a `'Cancelado'` y persiste el `motivo_cancelacion` en la base de datos.
- **Restricciones:** Solo opera sobre envíos en estado `'Pendiente'`. Requiere un cuerpo JSON con el campo `motivo_cancelacion` (obligatorio y no vacío).
- **Autorización:** Accesible únicamente por roles `Administrador` y `Cajero`.
- El método `cancelar_envio` en `DeliveryService` centraliza toda la lógica de validación antes de ejecutar el UPDATE atómico.

### 15c. Frontend: `deliveryService.js`
- Se añadió el método `cancelarEnvio(envioId, motivoCancelacion)` que invoca `DELETE /delivery/envios/{id}` pasando el motivo en el cuerpo de la petición (`data` del objeto de configuración de Axios).

### 15d. Frontend: `GestionEnvios.jsx` (Vista Administrativa)
- **Botón de Cancelación por Fila:** En la columna "Gestión Directa" de la tabla, los envíos en estado `Pendiente` cuentan ahora con un botón secundario rojo (`Ban`) de cancelación administrativa, además del botón "Iniciar Ruta".
- **Modal de Cancelación Administrativa:** Al hacer clic en el botón `Cancelar`, se despliega un modal con:
  - Mensaje informativo que aclara la naturaleza de la baja lógica (conserva el historial).
  - Campo de texto obligatorio para ingresar el motivo de cancelación.
  - Botones "Atrás" (cerrar modal) y "Confirmar Cancelación" (deshabilitado hasta que se ingrese un motivo).
  - Indicador de estado `procesandoCancelarAdmin` para evitar doble envío.

### 15e. Frontend: `DeliveryReparto.jsx` (Vista del Repartidor)
- **Integración de `MapaInteractivo`:** Se importó y se renderiza el componente `MapaInteractivo.jsx` (basado en Leaflet) en la pestaña **"Mi Ruta"**.
- **Condicional de activación:** El mapa solo se muestra si el envío activo dispone de coordenadas (`env.cliente?.latitud` y `env.cliente?.longitud`). En ese caso, aparece un botón "Ver Mapa de Destino" (azul) que alterna la visibilidad del mapa.
- **Modo solo lectura:** El mapa se renderiza con `soloLectura={true}` para deshabilitar la interacción del usuario y centrar el marcador en las coordenadas del cliente.
- **Estado `mapasExpandidos`:** Diccionario local `{[envio.id]: boolean}` que permite expandir/colapsar mapas de múltiples envíos en la vista de forma independiente.


## 16. Módulo de Bitácora y Auditoría (BitacoraSistema.jsx)

### 16a. Backend & DB: Normalización y Persistencia Atómica
- **Captura diferencial:** Se agregaron las columnas `operacion` (VARCHAR), `datos_anteriores` (JSONB) y `datos_nuevos` (JSONB) a la tabla `bitacora_usuarios` de la base de datos.
- **Inserción directa desde FastAPI:** Se eliminó por completo el uso del método parche `asociar_usuario_a_ultimo_cambio`. Ahora, tras cada mutación exitosa en los routers (`ventas.py`, `productos.py`, `clientes.py`, `delivery.py`), se invoca de manera síncrona `BitacoraService.registrar_accion()`.
- **Garantía del operador JWT:** Se inyecta de forma segura el `usuario_id` recuperado desde el JWT, eliminando la latencia y las fallas por concurrencia que ocurrían cuando el frontend asignaba el usuario "a posteriori".
- **Desactivación de Triggers Obsoletos:** Se eliminaron los triggers de auditoría a nivel de base de datos (`trg_auditar_clientes`, `trg_auditar_productos`, etc.) para evitar duplicidad de registros y auditorías con `usuario_id` nulo.

### 16b. Backend: Endpoints con Filtrado Delegado a la DB
- El endpoint `GET /bitacora/usuarios` acepta ahora parámetros de consulta opcionales: `fecha_inicio`, `fecha_fin`, `tabla_afectada` (módulo) y `operacion` (DML).
- La consulta a Supabase se construye dinámicamente y se aplica el filtrado a nivel de motor de base de datos (no en memoria en el servidor), garantizando eficiencia en consultas con alto volumen de registros.

### 16c. Frontend: `bitacoraService.js`
- El servicio fue extendido para recibir un objeto `filtros` y enviarlo como query params (`params: { skip, limit, ...filtros }`) en `obtenerAuditoriaUsuarios`.

### 16d. Frontend: `BitacoraSistema.jsx` (Vista de Auditoría Premium)
- **Panel de Filtros Avanzados:** Se rediseñó la cabecera de la pestaña de auditoría para incluir inputs de fecha (`fechaInicio`/`fechaFin`), un selector de módulo (`tabla_afectada`, integrando `envios` y `repartidores`) y un selector de operación (`operacion` DML: `INSERT`, `UPDATE`, `DELETE`).
- **Filtrado delegado:** Al presionar "Actualizar", el frontend realiza la consulta directa al backend con los filtros vigentes (cero filtrado manual en memoria).
- **Visor de Diffs JSON Expandible:** 
  - Se implementó el estado `filaExpandida` (almacena el ID del registro seleccionado).
  - En la tabla de escritorio, se agregó la columna "Cambios" con el botón "Ver JSON". Al hacer clic, se despliega un panel inferior de ancho completo con dos contenedores premium que contrastan en tiempo real el **Estado Anterior (Antes)** y el **Estado Nuevo (Después)** formateados de manera indentada y elegante.
  - En la vista móvil, las tarjetas cuentan con el botón "Ver Cambios JSON" que expande en la misma tarjeta la vista diferencial para asegurar una excelente experiencia de usuario adaptable.


## 17. Módulo de Personal e Indicadores de Rendimiento (GestionUsuarios.jsx)

### 17a. Backend & DB: Agregación Analítica (RPC)
- **Función RPC Analítica:** Se implementó `obtener_rendimiento_personal()` en la base de datos (con script incremental en `scratch/migracion_rendimiento_personal.sql` e incorporado en `programmability.sql`). Esta función ejecuta agrupaciones con cláusulas SQL de tipo `COUNT` y `SUM` condicionadas por el estado de las transacciones para recolectar:
  - **Para Cajeros:** Suma total facturada en dinero de ventas completadas y número de ventas procesadas desde la tabla `ventas`.
  - **Para Repartidores:** Cantidad de envíos entregados con éxito, envíos cancelados, total de envíos asignados y efectividad logístico-operativa calculada como `(entregados / total) * 100` desde la tabla `envios` con JOIN a `repartidores`.
- **Nuevo Endpoint Analítico (`GET /usuarios/rendimiento`):** Implementado en `backend/app/routers/usuarios.py` antes de los selectores dinámicos por ID para evitar colisiones de enrutamiento en FastAPI. Consume la lógica encapsulada en `UsuarioService.obtener_rendimiento()`.

### 17b. Frontend: Panel de Búsqueda y Filtrado
- Se integró el componente reusable `PanelFiltroBusqueda.jsx` en `GestionUsuarios.jsx`.
- **Filtros en tiempo real:** Permite la búsqueda libre por Nombre Completo o Correo Electrónico, y filtrado selectivo por el Rol de Acceso (`Administrador`, `Cajero`, `Repartidor`) y por el Estado actual del operador (`Activo`, `Inactivo`).

### 17c. Frontend: Dashboard de Indicadores de Rendimiento de Personal
- Se implementó un panel visual premium dividido en dos cuadrículas analíticas en la parte superior de la vista:
  - **Top de Cajeros:** Muestra a los cajeros ordenados de forma descendente en base al volumen total facturado, incluyendo cantidad de ventas procesadas.
  - **Top de Repartidores:** Muestra a los repartidores ordenados de forma descendente en base a su porcentaje de efectividad de entrega, detallando el balance de envíos entregados y cancelados.
- **Sincronización:** El dashboard se recarga de forma automática cada vez que se carga la vista o se realiza una mutación sobre el personal (creación, edición o baja lógica).
