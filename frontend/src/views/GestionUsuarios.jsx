import React, { useState, useEffect } from 'react';
import usuarioService from '../services/usuarioService';
import PaginadorTablas from '../components/PaginadorTablas';
import ModalDesactivar from '../components/ModalDesactivar';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Edit3, Trash2, X, Eye, EyeOff, ShieldAlert } from 'lucide-react';

export const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 5;

  // Estados del modal de formulario
  const [mostrarForm, setMostrarForm] = useState(false);
  const [usuarioEdit, setUsuarioEdit] = useState(null);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('Cajero');
  const [verPassword, setVerPassword] = useState(false);
  const [procesandoForm, setProcesandoForm] = useState(false);

  // Estados del modal de baja lógica
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [usuarioEliminarId, setUsuarioEliminarId] = useState(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState(false);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const res = await usuarioService.obtenerTodos();
      // El backend retorna un array directamente en respuesta.data
      if (Array.isArray(res)) {
        setUsuarios(res);
      } else if (res && Array.isArray(res.data)) {
        setUsuarios(res.data);
      }
    } catch (ex) {
      toast.error("Error al cargar los usuarios del sistema.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const abrirCrear = () => {
    setUsuarioEdit(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setRol('Cajero');
    setVerPassword(false);
    setMostrarForm(true);
  };

  const abrirEditar = (usr) => {
    setUsuarioEdit(usr);
    setNombre(usr.nombre);
    setUsername(usr.username);
    setPassword(''); // Opcional, vacío por defecto
    setRol(usr.rol);
    setVerPassword(false);
    setMostrarForm(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();

    if (!nombre.trim() || !username.trim()) {
      toast.error("Todos los campos obligatorios deben completarse.");
      return;
    }

    if (!usuarioEdit && password.length < 6) {
      toast.error("La contraseña debe tener un mínimo de 6 caracteres.");
      return;
    }

    if (usuarioEdit && password.trim() && password.length < 6) {
      toast.error("La nueva contraseña debe tener un mínimo de 6 caracteres.");
      return;
    }

    setProcesandoForm(true);
    try {
      const payload = {
        nombre,
        username,
        rol,
      };

      if (!usuarioEdit) {
        payload.password = password;
        payload.estado = 'Activo';
        const res = await usuarioService.crear(payload);
        toast.success("Usuario creado correctamente.");
        setMostrarForm(false);
        cargarUsuarios();
      } else {
        if (password.trim()) {
          payload.password = password;
        }
        // Conservar el estado actual al editar en este modal
        payload.estado = usuarioEdit.estado;
        const res = await usuarioService.actualizar(usuarioEdit.id, payload);
        toast.success("Usuario actualizado correctamente.");
        setMostrarForm(false);
        cargarUsuarios();
      }
    } catch (ex) {
      const errorMsg = ex.response?.data?.detail || "Error al procesar el formulario de usuario.";
      toast.error(errorMsg);
    } finally {
      setProcesandoForm(false);
    }
  };

  const abrirDesactivar = (id) => {
    setUsuarioEliminarId(id);
    setMostrarEliminar(true);
  };

  const handleConfirmarDesactivar = async () => {
    setProcesandoEliminar(true);
    try {
      // Para la baja lógica, mandamos un PUT con estado 'Inactivo'
      const usr = usuarios.find(u => u.id === usuarioEliminarId);
      if (usr) {
        const payload = {
          nombre: usr.nombre,
          username: usr.username,
          rol: usr.rol,
          estado: 'Inactivo'
        };
        await usuarioService.actualizar(usr.id, payload);
        toast.success("Usuario desactivado (baja lógica).");
        setMostrarEliminar(false);
        cargarUsuarios();
      }
    } catch (ex) {
      toast.error("No se pudo desactivar el usuario.");
    } finally {
      setProcesandoEliminar(false);
    }
  };

  // Lógica de Paginación
  const totalItems = usuarios.length;
  const indiceUltimoItem = pagina * itemsPorPagina;
  const indicePrimerItem = indiceUltimoItem - itemsPorPagina;
  const usuariosPaginados = usuarios.slice(indicePrimerItem, indiceUltimoItem);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <Toaster position="top-right" reverseOrder={false} />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Gestión de Personal y Cuentas</h2>
          <p className="text-xs text-slate-500 mt-1">Administra los accesos, roles y permisos de los operadores de la tienda.</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 bg-premium-primary hover:bg-opacity-90 text-white text-xs font-semibold py-2 px-4 rounded shadow-lg transition-all"
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre de Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rol de Acceso</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-xs text-slate-500 font-medium">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : usuariosPaginados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-xs text-slate-500 font-medium">
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              ) : (
                usuariosPaginados.map((usr) => (
                  <tr key={usr.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-800">{usr.nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-mono">{usr.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide ${
                        usr.rol === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                        usr.rol === 'Cajero' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {usr.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        usr.estado === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {usr.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                      <button
                        onClick={() => abrirEditar(usr)}
                        className="text-premium-primary hover:text-opacity-80 inline-flex items-center gap-1"
                        title="Editar"
                      >
                        <Edit3 size={14} />
                        <span>Editar</span>
                      </button>
                      {usr.estado === 'Activo' && (
                        <button
                          onClick={() => abrirDesactivar(usr.id)}
                          className="text-premium-danger hover:text-opacity-80 inline-flex items-center gap-1 ml-3"
                          title="Desactivar"
                        >
                          <Trash2 size={14} />
                          <span>Baja</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginadorTablas
          totalItems={totalItems}
          itemsPorPagina={itemsPorPagina}
          paginaActual={pagina}
          alCambiarPagina={setPagina}
        />
      </div>

      {/* MODAL DE FORMULARIO (CREAR/EDITAR) */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                {usuarioEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setMostrarForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-premium-primary"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre de Usuario (Username) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-premium-primary font-mono"
                  placeholder="Ej. jperez"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Rol de Acceso *</label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-premium-primary"
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Cajero">Cajero</option>
                  <option value="Repartidor">Repartidor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  {usuarioEdit ? 'Nueva Contraseña (Opcional)' : 'Contraseña *'}
                </label>
                <div className="relative">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-premium-primary pr-10"
                    placeholder={usuarioEdit ? 'Dejar en blanco para no modificar' : 'Mínimo 6 caracteres'}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  disabled={procesandoForm}
                  className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoForm}
                  className="py-1.5 px-4 bg-premium-primary hover:bg-opacity-90 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {procesandoForm ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BAJA LÓGICA */}
      <ModalDesactivar
        mostrar={mostrarEliminar}
        titulo="Confirmar Desactivación de Usuario"
        mensaje="Al desactivar este usuario, este ya no podrá iniciar sesión en la aplicación ni realizar operaciones en el sistema. Sus datos y registros históricos de venta o reparto se conservarán intactos."
        alConfirmar={handleConfirmarDesactivar}
        alCancelar={() => setMostrarEliminar(false)}
        procesando={procesandoEliminar}
      />
    </div>
  );
};

export default GestionUsuarios;
