import React, { useState, useEffect } from 'react';
import clienteService from '../services/clienteService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X } from 'lucide-react';

export const GestionClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 5;

  // Modal Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);

  // Campos Formulario
  const [dniRuc, setDniRuc] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [saldoDeudor, setSaldoDeudor] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal Desactivación (Baja lógica)
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [clienteEliminarId, setClienteEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  const cargarClientes = async () => {
    try {
      setCargando(true);
      const res = await clienteService.obtenerTodos(true);
      if (res.ok) {
        setClientes(res.data);
      }
    } catch (ex) {
      toast.error("Error al cargar los clientes.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const abrirCrear = () => {
    setClienteEdit(null);
    setDniRuc('');
    setNombre('');
    setTelefono('');
    setDireccion('');
    setSaldoDeudor(0.00);
    setLimiteCredito(0.00);
    setMostrarForm(true);
  };

  const abrirEditar = (cli) => {
    setClienteEdit(cli);
    setDniRuc(cli.dni_ruc || '');
    setNombre(cli.nombre);
    setTelefono(cli.telefono || '');
    setDireccion(cli.direccion || '');
    setSaldoDeudor(cli.saldo_deudor);
    setLimiteCredito(cli.limite_credito);
    setMostrarForm(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setProcesandoForm(true);

    const payload = {
      dni_ruc: dniRuc || null,
      nombre,
      telefono: telefono || null,
      direccion: direccion || null,
      saldo_deudor: parseFloat(saldoDeudor),
      limite_credito: parseFloat(limiteCredito)
    };

    try {
      if (clienteEdit) {
        const res = await clienteService.actualizar(clienteEdit.id, payload);
        if (res.ok) {
          toast.success("Cliente actualizado correctamente.");
          setMostrarForm(false);
          cargarClientes();
        }
      } else {
        const res = await clienteService.crear(payload);
        if (res.ok) {
          toast.success("Cliente registrado con éxito.");
          setMostrarForm(false);
          cargarClientes();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "Error al procesar el cliente.";
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  const abrirDesactivar = (id) => {
    setClienteEliminarId(id);
    setMostrarEliminar(true);
  };

  const handleConfirmarDesactivar = async () => {
    setProcesandoEliminar(true);
    try {
      const res = await clienteService.eliminar(clienteEliminarId);
      if (res.ok) {
        toast.success("Cliente desactivado (baja lógica).");
        setMostrarEliminar(false);
        cargarClientes();
      }
    } catch (ex) {
      toast.error("No se pudo desactivar el cliente.");
    } finally {
      setProcesandoEliminar(false);
    }
  };

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const clientesPaginados = clientes.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* CABECERA ACCIÓN */}
      <div className="bg-white rounded-lg p-5 shadow border border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Gestión de Clientes</h3>
          <p className="text-xs text-gray-500 mt-0.5">Control de cuentas de crédito de clientes fiados.</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center py-2 px-4 bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
        >
          <Plus size={14} className="mr-1" />
          Registrar Cliente
        </button>
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-premium-dark text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">DNI / RUC</th>
                <th className="py-3.5 px-4">Nombre</th>
                <th className="py-3.5 px-4">Teléfono</th>
                <th className="py-3.5 px-4 text-right">Saldo Deudor</th>
                <th className="py-3.5 px-4 text-right">Límite Crédito</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500 font-semibold">
                    Cargando catálogo de clientes...
                  </td>
                </tr>
              </tbody>
            ) : clientes.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400">
                    No se registran clientes.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {clientesPaginados.map((cli) => (
                  <tr key={cli.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono">{cli.dni_ruc || 'Sin documento'}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">{cli.nombre}</td>
                    <td className="py-3 px-4 text-gray-500">{cli.telefono || 'Sin teléfono'}</td>
                    <td className="py-3 px-4 text-right text-red-600 font-semibold">${cli.saldo_deudor.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-premium-primary font-semibold">${cli.limite_credito.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                        cli.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {cli.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center flex items-center justify-center space-x-2">
                      <button
                        onClick={() => abrirEditar(cli)}
                        className="p-1 hover:bg-gray-100 rounded text-premium-primary"
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </button>
                      {cli.estado === 'Activo' && cli.dni_ruc !== '00000000' && (
                        <button
                          onClick={() => abrirDesactivar(cli.id)}
                          className="p-1 hover:bg-gray-100 rounded text-premium-danger"
                          title="Desactivar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        <PaginadorTablas
          totalItems={clientes.length}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* MODAL FORMULARIO DE CLIENTES */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">
                {clienteEdit ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="my-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo / Razón Social</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Carlos Mendoza"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">DNI / RUC (Opcional)</label>
                  <input
                    type="text"
                    value={dniRuc}
                    onChange={(e) => setDniRuc(e.target.value)}
                    placeholder="Documento único"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="999-999-999"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dirección (Opcional)</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Av. Los Tulipanes 789"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Saldo Deudor Inicial ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={saldoDeudor}
                    onChange={(e) => setSaldoDeudor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Límite de Crédito ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={limiteCredito}
                    onChange={(e) => setLimiteCredito(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-premium-primary focus:border-premium-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="py-1.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoForm}
                  className="py-1.5 px-4 bg-premium-primary hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {procesandoForm ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Inactivar Cliente"
        mensaje="¿Está seguro de desactivar este cliente? Dejará de aparecer en los selectores de facturación y crédito de caja POS."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />
    </div>
  );
};

export default GestionClientes;
