/**
 * Vista: GestionClientes.jsx
 * Módulo de gestión de clientes con control de crédito y saldo deudor.
 * Diseño premium con tabla, badges de estado y formulario modal.
 */

import { useState, useEffect } from 'react';
import clienteService from '../services/clienteService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Users } from 'lucide-react';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };

export const GestionClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 7;

  // Modal Formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);

  // Campos del Formulario
  const [dniRuc, setDniRuc] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [enlaceUbicacion, setEnlaceUbicacion] = useState('');
  const [saldoDeudor, setSaldoDeudor] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Modal Desactivación
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
      console.error(ex);
      toast.error('Error al cargar los clientes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarClientes();
    };
    inicializar();
  }, []);

  const abrirCrear = () => {
    setClienteEdit(null);
    setDniRuc('');
    setNombre('');
    setTelefono('');
    setDireccion('');
    setEnlaceUbicacion('');
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
    setEnlaceUbicacion(cli.enlace_ubicacion || '');
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
      enlace_ubicacion: enlaceUbicacion || null,
      saldo_deudor: parseFloat(saldoDeudor),
      limite_credito: parseFloat(limiteCredito)
    };

    try {
      if (clienteEdit) {
        const res = await clienteService.actualizar(clienteEdit.id, payload);
        if (res.ok) {
          toast.success('Cliente actualizado correctamente.');
          setMostrarForm(false);
          cargarClientes();
        }
      } else {
        const res = await clienteService.crear(payload);
        if (res.ok) {
          toast.success('Cliente registrado con éxito.');
          setMostrarForm(false);
          cargarClientes();
        }
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || 'Error al procesar el cliente.';
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
        toast.success('Cliente desactivado (baja lógica).');
        setMostrarEliminar(false);
        cargarClientes();
      }
    } catch (ex) {
      console.error(ex);
      toast.error('No se pudo desactivar el cliente.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  const indexInicio = (pagina - 1) * itemsPorPagina;
  const clientesPaginados = clientes.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '12px' },
        }}
      />

      {/* ── CABECERA ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #ec4899, #db2777)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="page-title">Gestión de Clientes</h3>
            <p className="page-subtitle">Control de cuentas de crédito y saldos deudores</p>
          </div>
        </div>
        <button onClick={abrirCrear} className="btn-primary">
          <Plus size={15} />
          Registrar Cliente
        </button>
      </div>

      {/* ── TABLA ── */}
      <div className="table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '750px' }}>
            <thead>
              <tr>
                <th>DNI / RUC</th>
                <th>Nombre / Razón Social</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'right' }}>Saldo Deudor</th>
                <th style={{ textAlign: 'right' }}>Límite Crédito</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>

            {cargando ? (
              <tbody>
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontWeight: 500 }}>
                    Cargando catálogo de clientes...
                  </td>
                </tr>
              </tbody>
            ) : clientes.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No se registran clientes en el sistema.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {clientesPaginados.map((cli) => (
                  <tr key={cli.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
                      {cli.dni_ruc || '—'}
                    </td>
                    <td className="bold">{cli.nombre}</td>
                    <td style={{ color: '#6b7280' }}>{cli.telefono || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: cli.saldo_deudor > 0 ? '#dc2626' : '#374151' }}>
                      Bs. {cli.saldo_deudor.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#6d28d9' }}>
                      Bs. {cli.limite_credito.toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge ${cli.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`}>
                        {cli.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button onClick={() => abrirEditar(cli)} className="btn-icon" title="Editar cliente">
                          <Edit3 size={15} />
                        </button>
                        {cli.estado === 'Activo' && cli.dni_ruc !== '00000000' && (
                          <button onClick={() => abrirDesactivar(cli.id)} className="btn-icon danger" title="Desactivar cliente">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
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

      {/* ── MODAL FORMULARIO ── */}
      {mostrarForm && (
        <div className="modal-backdrop">
          <div className="modal-container animate-fade-in-up" style={{ maxWidth: '480px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #ec4899, #db2777)' }} />

            <div className="modal-header">
              <span className="modal-title">
                {clienteEdit ? '✏️ Editar Cliente' : '👤 Registrar Nuevo Cliente'}
              </span>
              <button
                onClick={() => setMostrarForm(false)}
                style={{
                  background: '#f3f4f6', border: 'none', borderRadius: '8px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleGuardar}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={fieldStyle}>
                  <label className="form-label">Nombre Completo / Razón Social *</label>
                  <input
                    type="text" required value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Carlos Mendoza"
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">DNI / RUC (Opcional)</label>
                    <input
                      type="text" value={dniRuc}
                      onChange={(e) => setDniRuc(e.target.value)}
                      placeholder="Documento único"
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Teléfono (Opcional)</label>
                    <input
                      type="text" value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="999-999-999"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Dirección (Opcional)</label>
                  <input
                    type="text" value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Av. Los Tulipanes 789"
                    className="form-input"
                  />
                </div>

                <div style={fieldStyle}>
                  <label className="form-label">Enlace de Ubicación GPS (Google Maps / Waze - Opcional)</label>
                  <input
                    type="text" value={enlaceUbicacion}
                    onChange={(e) => setEnlaceUbicacion(e.target.value)}
                    placeholder="https://maps.google.com/?q=..."
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={fieldStyle}>
                    <label className="form-label">Saldo Deudor Inicial (Bs.) *</label>
                    <input
                      type="number" step="0.01" required value={saldoDeudor}
                      onChange={(e) => setSaldoDeudor(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label className="form-label">Límite de Crédito (Bs.) *</label>
                    <input
                      type="number" step="0.01" required value={limiteCredito}
                      onChange={(e) => setLimiteCredito(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={procesandoForm} className="btn-primary">
                  {procesandoForm ? 'Guardando...' : clienteEdit ? 'Actualizar Cliente' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
