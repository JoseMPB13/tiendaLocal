import clienteApi from './api';

export const deliveryService = {
  /**
   * Obtiene la lista completa de envíos registrados en el sistema.
   * El cliente Axios inyecta automáticamente el X-User-Rol y token.
   */
  obtenerEnvios: async () => {
    const respuesta = await clienteApi.get('/delivery/envios');
    return respuesta.data;
  },

  /**
   * Obtiene la lista de envíos activos asignados al repartidor autenticado.
   */
  obtenerMisEnviosActivos: async () => {
    const respuesta = await clienteApi.get('/delivery/mis-envios-activos');
    return respuesta.data;
  },

  /**
   * Actualiza los datos o el estado de un envío (despachado, entregado, cancelado).
   */
  actualizarEstadoEnvio: async (envioId, datosActualizar) => {
    const respuesta = await clienteApi.put(`/delivery/envios/${envioId}`, datosActualizar);
    return respuesta.data;
  },

  crearEnvio: async (datosEnvio) => {
    const respuesta = await clienteApi.post('/delivery/envios', datosEnvio);
    return respuesta.data;
  },

  /**
   * Cancela un envío de forma lógica (baja lógica → estado='Cancelado').
   * El registro NO se elimina físicamente de la base de datos.
   * Solo se permite cancelar envíos en estado 'Pendiente'.
   * @param {string} envioId - UUID del envío a cancelar.
   * @param {string} motivoCancelacion - Motivo textual obligatorio.
   */
  cancelarEnvio: async (envioId, motivoCancelacion) => {
    const respuesta = await clienteApi.delete(`/delivery/envios/${envioId}`, {
      data: { motivo_cancelacion: motivoCancelacion }
    });
    return respuesta.data;
  },

  /**
   * Obtiene el listado de repartidores registrados.
   */
  obtenerRepartidores: async () => {
    const respuesta = await clienteApi.get('/delivery/repartidores');
    return respuesta.data;
  },

  // ---------------------------------------------------------------------------
  // MÉTODOS DE SEGUIMIENTO GPS EN TIEMPO REAL
  // ---------------------------------------------------------------------------

  /**
   * Envía la posición GPS actual del repartidor autenticado al servidor.
   * Endpoint de alta frecuencia, llamado cada ~7 segundos mientras el repartidor
   * tiene un envío en estado 'En Camino'.
   * @param {number} latitud - Latitud GPS actual del dispositivo.
   * @param {number} longitud - Longitud GPS actual del dispositivo.
   */
  actualizarMiUbicacion: async (latitud, longitud) => {
    const respuesta = await clienteApi.put('/delivery/mi-ubicacion', { latitud, longitud });
    return respuesta.data;
  },

  /**
   * Obtiene la última posición GPS registrada de un repartidor específico.
   * Utilizado por MapaSeguimiento.jsx para dibujar el ícono del repartidor en el mapa.
   * @param {string} repartidorId - UUID del repartidor a consultar.
   */
  obtenerUbicacionRepartidor: async (repartidorId) => {
    const respuesta = await clienteApi.get(`/delivery/repartidores/${repartidorId}/ubicacion`);
    return respuesta.data;
  },

  // ---------------------------------------------------------------------------
  // MÉTODOS DE CONFIGURACIÓN DEL SISTEMA (Ubicación del Kiosco)
  // ---------------------------------------------------------------------------

  /**
   * Obtiene el valor de una clave de configuración del sistema.
   * @param {string} clave - Nombre de la clave. Ej: 'kiosco_latitud'.
   */
  obtenerConfiguracion: async (clave) => {
    const respuesta = await clienteApi.get(`/delivery/configuracion/${clave}`);
    return respuesta.data;
  },

  /**
   * Crea o actualiza una clave de configuración del sistema (solo Administrador).
   * @param {string} clave - Nombre de la clave.
   * @param {string|number} valor - Valor a almacenar (se convierte a texto).
   */
  guardarConfiguracion: async (clave, valor) => {
    const respuesta = await clienteApi.put('/delivery/configuracion', {
      clave,
      valor: String(valor)
    });
    return respuesta.data;
  },

  /**
   * Consulta pública de una clave de configuración (sin JWT).
   * Claves permitidas: logo_url, kiosco_nombre.
   */
  obtenerConfiguracionPublica: async (clave) => {
    const respuesta = await clienteApi.get(`/delivery/configuracion/publica/${clave}`);
    return respuesta.data;
  },

  /**
   * Sube el logotipo de la tienda en formato PNG (solo Administrador).
   * @param {File} archivo - Archivo PNG seleccionado por el usuario.
   */
  subirLogo: async (archivo) => {
    const formData = new FormData();
    formData.append('file', archivo);
    const respuesta = await clienteApi.post('/delivery/configuracion/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return respuesta.data;
  },
};

export default deliveryService;
