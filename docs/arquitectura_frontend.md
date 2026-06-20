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
- **Validaciones Integradas:** Controla que la cantidad de ítems no exceda el `stock_actual` disponible de forma reactiva en el cliente.
- **Control de Crédito Local:** Si el método de pago seleccionado es "Crédito", valida en caliente que la suma de la deuda existente del cliente más el total a cobrar no supere su `limite_credito` autorizado, rechazando la venta antes de enviarla.

## 6. Funcionalidad de Escucha Activa de Código de Barras (POS)
- Para acelerar la atención de cajeros, el input del buscador en `PuntoVenta.jsx` escucha continuamente.
- Si el texto ingresado coincide exactamente con la clave `codigo_barras` de un producto del catálogo, añade automáticamente el producto al carrito con cantidad inicial 1 y limpia el input de inmediato de forma automatizada, permitiendo emular el comportamiento de una pistola lectora física sin interrumpir el flujo.

## 7. Cliente HTTP y Comunicación con API (`api.js`)
- Configurado centralizadamente mediante **Axios** para conectar el cliente React con la API de FastAPI.
- **Intercepción de Peticiones:** Añade de forma transparente el token Bearer (`Authorization`) y el rol activo del operador (`X-User-Rol`) a partir de la información del `authStore` antes de despacharse al backend, garantizando la seguridad en la pasarela.

## 8. Flujo de Confirmación de Pago y Captura de Errores
- **Modal de Pago Dinámico:** Al finalizar la compra, se abre un modal de confirmación. En efectivo, requiere ingresar la cantidad recibida y calcula en caliente el vuelto. En ventas a crédito, despliega el estado actual de la deuda y el nuevo saldo proyectado del cliente para aprobación antes de la transacción.
- **Captura de Excepciones Transaccionales:** Utiliza `react-hot-toast` para desplegar alertas en español si el backend FastAPI o Supabase rechazan la transacción arrojando errores controlados por triggers (como `Stock insuficiente` o `Límite de crédito excedido`).

## 9. Flujo Móvil del Repartidor (`DeliveryReparto.jsx`)
- **Organización por Acordeones Colapsables:** Los envíos se agrupan en acordeones según su estado logístico. Aquellos en estado "En Camino" se muestran expandidos por defecto para prioridad táctil, mientras que los "Pendientes" e históricos permanecen contraídos para descongestionar la pantalla.
- **Acciones Seguras (Gesto Swipe):** Para impedir marcas de entrega o tránsito accidentales durante el trayecto, se integra el componente `DeslizadorInteractivo.jsx`, requiriendo un arrastre continuo del control deslizante hasta el 92% para consolidar la actualización de estado.
- **Enlaces Geográficos Dinámicos:** Cuenta con redirección nativa al mapa del dispositivo móvil mediante protocolo `geo:0,0?q=` con fallback integrado a Google Maps vía web, permitiendo abrir la ruta de destino de forma fluida.



