/**
 * Servicio: compraService.js
 * Propósito: Proveer funciones para interactuar con la API de compras y reabastecimiento.
 * Conecta con los endpoints del backend en FastAPI para registrar compras,
 * listar el historial de reabastecimientos, obtener detalles y cancelar compras de forma lógica.
 * Idioma: Español
 */

import clienteApi from './api';

export const compraService = {
  /**
   * Obtiene el historial de compras filtrado opcionalmente por estado.
   * @param {string|null} estadoCompra - Estado de la compra ('Completada', 'Cancelada')
   * @param {number} skip - Número de registros a saltar para la paginación
   * @param {number} limit - Límite de registros a retornar
   * @returns {Promise<Object>} Respuesta del backend con el listado de compras
   */
  obtenerCompras: async (estadoCompra = null, skip = 0, limit = 100) => {
    let url = `/compras/?skip=${skip}&limit=${limit}`;
    if (estadoCompra) {
      url += `&estado_compra=${estadoCompra}`;
    }
    const respuesta = await clienteApi.get(url);
    return respuesta.data;
  },

  /**
   * Obtiene los detalles completos de una compra (cabecera + lista de artículos con nombres).
   * @param {string} id - UUID de la compra
   * @returns {Promise<Object>} Detalles de la compra y sus productos
   */
  obtenerCompraDetalle: async (id) => {
    const respuesta = await clienteApi.get(`/compras/${id}`);
    return respuesta.data;
  },

  /**
   * Registra una nueva compra/reabastecimiento en el backend.
   * @param {Object} datos - Datos de la compra { proveedor_nombre, codigo_referencia, detalles: [...] }
   * @returns {Promise<Object>} Datos de la compra creada
   */
  registrarCompra: async (datos) => {
    const respuesta = await clienteApi.post('/compras/', datos);
    return respuesta.data;
  },

  /**
   * Realiza la anulación de una compra y revierte el stock asociado.
   * @param {string} id - UUID de la compra a anular
   * @returns {Promise<Object>} Datos de la compra cancelada
   */
  cancelarCompra: async (id) => {
    const respuesta = await clienteApi.put(`/compras/${id}/cancelar`);
    return respuesta.data;
  }
};

export default compraService;
