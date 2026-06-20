import { create } from 'zustand';

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
        alert(`No hay stock suficiente. Stock disponible: ${producto.stock_actual}`);
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
        alert("Este producto no cuenta con existencias en stock.");
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
      alert(`Cantidad excede el stock disponible (${stockActual}).`);
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

  /**
   * Retorna el monto total calculado sumando subtotales del carrito.
   */
  obtenerTotal: () => {
    const { carrito } = get();
    return carrito.reduce((acc, item) => acc + (item.cantidad * item.precio_venta), 0.00);
  }
}));

export default useCartStore;
