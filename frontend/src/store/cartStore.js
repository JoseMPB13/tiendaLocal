import { create } from 'zustand';
import toast from 'react-hot-toast';

/**
 * Store centralizado para la gestión del carrito de compras en el Punto de Venta (POS).
 * Permite agregar productos, removerlos, ajustar cantidades y calcular totales de la venta en tiempo real.
 */
export const useCartStore = create((set, get) => ({
  carrito: [],
  clienteSeleccionado: null,
  metodoPago: "Efectivo",
  codigoFactura: "",

  /**
   * Agrega un producto al carrito. Si ya existe, incrementa su cantidad.
   * Regla de Negocio: No se permite agregar una cantidad mayor al stock_actual disponible.
   */
  agregarProducto: (producto) => {
    const { carrito } = get();
    const existe = carrito.find(item => item.id === producto.id);

    if (existe) {
      if (existe.cantidad + 1 > producto.stock_actual) {
        toast.error(`No hay stock suficiente. Stock disponible: ${producto.stock_actual}`);
        return;
      }
      set({
        carrito: carrito.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      });
    } else {
      if (producto.stock_actual < 1) {
        toast.error("Este producto no cuenta con existencias en stock.");
        return;
      }
      set({
        carrito: [...carrito, { ...producto, cantidad: 1 }]
      });
    }
  },

  /**
   * Modifica la cantidad directamente en el carrito validando stock.
   */
  actualizarCantidad: (productoId, cantidad, stockActual) => {
    const { carrito } = get();
    if (cantidad > stockActual) {
      toast.error(`Cantidad excede el stock disponible (${stockActual}).`);
      return;
    }
    if (cantidad <= 0) {
      get().removerProducto(productoId);
      return;
    }
    set({
      carrito: carrito.map(item =>
        item.id === productoId ? { ...item, cantidad } : item
      )
    });
  },

  /**
   * Remueve un producto del carrito.
   */
  removerProducto: (productoId) => {
    const { carrito } = get();
    set({
      carrito: carrito.filter(item => item.id !== productoId)
    });
  },

  /**
   * Limpia el carrito de compras restableciendo la cabecera.
   */
  vaciarCarrito: () => {
    set({
      carrito: [],
      clienteSeleccionado: null,
      metodoPago: "Efectivo",
      codigoFactura: ""
    });
  },

  setCliente: (cliente) => set({ clienteSeleccionado: cliente }),
  setMetodoPago: (metodo) => set({ metodoPago: metodo }),
  setCodigoFactura: (codigo) => set({ codigoFactura: codigo }),
  cargarCarrito: (items) => set({ carrito: items }),

  /**
   * Retorna el monto total calculado de forma precisa usando aritmética de centavos (enteros)
   * para mitigar los errores de redondeo de punto flotante en JavaScript.
   */
  obtenerTotal: () => {
    const { carrito } = get();
    const totalCentavos = carrito.reduce((acc, item) => {
      const precioCentavos = Math.round(item.precio_venta * 100);
      return acc + (item.cantidad * precioCentavos);
    }, 0);
    return totalCentavos / 100;
  }
}));

export default useCartStore;
