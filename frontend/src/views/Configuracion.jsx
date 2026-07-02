// =============================================================================
// VISTA: Configuracion.jsx
// Propósito: Panel de configuración del sistema para Administradores.
//            - Sección 1: Ubicación del Kiosco (origen de rutas de delivery)
//              con mapa interactivo y captura de GPS del dispositivo actual.
//            - Sección 2: Imagen QR de cobro (se almacena como URL en Supabase
//              Storage o como base64 en configuracion_sistema).
//            - Sección 3: Logotipo de la tienda (PNG subido al servidor).
// Acceso: Solo Administrador
// Idioma: Español
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { MapPin, QrCode, Save, LocateFixed, Upload, X, CheckCircle, Settings, Image } from 'lucide-react';
import MapaInteractivo from '../components/MapaInteractivo';
import deliveryService from '../services/deliveryService';
import clienteApi from '../services/api';
import useAuthStore from '../store/authStore';

/** Resuelve la URL completa de una imagen almacenada en el servidor backend. */
const obtenerUrlImagenCompleta = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseURL = clienteApi.defaults.baseURL || 'http://localhost:8000';
  return `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const Configuracion = () => {
  const setLogoUrl = useAuthStore((state) => state.setLogoUrl);
  const logoUrlGlobal = useAuthStore((state) => state.logoUrl);

  // ──────────────────────────────────────────────────────────────────────────
  // ESTADO: Ubicación del Kiosco
  // ──────────────────────────────────────────────────────────────────────────
  const [kioscoLat, setKioscoLat] = useState(-17.7833);
  const [kioscoLng, setKioscoLng] = useState(-63.1667);
  const [kioscoNombre, setKioscoNombre] = useState('Tienda Margarita');
  const [guardandoKiosco, setGuardandoKiosco] = useState(false);
  const [cargandoKiosco, setCargandoKiosco] = useState(true);
  const [localizandoGPS, setLocalizandoGPS] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // ESTADO: Imagen QR de cobro
  // ──────────────────────────────────────────────────────────────────────────
  const [qrImagen, setQrImagen] = useState(null);      // URL o base64 actual
  const [qrPreview, setQrPreview] = useState(null);    // Preview local antes de guardar
  const [qrNuevoBase64, setQrNuevoBase64] = useState(null); // base64 del archivo nuevo
  const [guardandoQr, setGuardandoQr] = useState(false);
  const inputArchivoRef = useRef(null);

  // ──────────────────────────────────────────────────────────────────────────
  // ESTADO: Logotipo de la tienda (PNG)
  // ──────────────────────────────────────────────────────────────────────────
  const [logoPreview, setLogoPreview] = useState(null);
  const [archivoLogo, setArchivoLogo] = useState(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const inputLogoRef = useRef(null);

  // ──────────────────────────────────────────────────────────────────────────
  // CARGA INICIAL: Leer la configuración actual desde la BD
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cargarConfiguracion = async () => {
      setCargandoKiosco(true);
      try {
        const [resLat, resLng, resNombre, resQr] = await Promise.allSettled([
          deliveryService.obtenerConfiguracion('kiosco_latitud'),
          deliveryService.obtenerConfiguracion('kiosco_longitud'),
          deliveryService.obtenerConfiguracion('kiosco_nombre'),
          deliveryService.obtenerConfiguracion('qr_pago_imagen'),
        ]);

        if (resLat.status === 'fulfilled' && resLat.value.ok) {
          setKioscoLat(parseFloat(resLat.value.data.valor));
        }
        if (resLng.status === 'fulfilled' && resLng.value.ok) {
          setKioscoLng(parseFloat(resLng.value.data.valor));
        }
        if (resNombre.status === 'fulfilled' && resNombre.value.ok) {
          setKioscoNombre(resNombre.value.data.valor);
        }
        if (resQr.status === 'fulfilled' && resQr.value.ok) {
          setQrImagen(resQr.value.data.valor);
        }

        const resLogo = await deliveryService.obtenerConfiguracionPublica('logo_url');
        if (resLogo?.ok && resLogo.data?.valor) {
          setLogoUrl(resLogo.data.valor);
        }
      } catch (err) {
        console.error('Error al cargar configuración:', err);
        toast.error('No se pudo cargar la configuración actual.');
      } finally {
        setCargandoKiosco(false);
      }
    };
    cargarConfiguracion();
  }, [setLogoUrl]);

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Capturar ubicación GPS actual del dispositivo para el kiosco
  // ──────────────────────────────────────────────────────────────────────────
  const usarMiUbicacionActual = () => {
    if (!navigator.geolocation) {
      toast.error('Este dispositivo no soporta geolocalización.');
      return;
    }
    setLocalizandoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setKioscoLat(parseFloat(lat.toFixed(8)));
        setKioscoLng(parseFloat(lng.toFixed(8)));
        setLocalizandoGPS(false);
        toast.success(
          `📍 Ubicación capturada: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          { duration: 4000 }
        );
      },
      (error) => {
        setLocalizandoGPS(false);
        if (error.code === 1) {
          toast.error('Permiso de ubicación denegado. Habilítalo en el navegador.');
        } else {
          toast.error(`Error GPS (código ${error.code}): ${error.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Guardar ubicación del kiosco en la BD
  // ──────────────────────────────────────────────────────────────────────────
  const guardarUbicacionKiosco = async (e) => {
    e.preventDefault();
    setGuardandoKiosco(true);
    try {
      await Promise.all([
        deliveryService.guardarConfiguracion('kiosco_latitud', kioscoLat),
        deliveryService.guardarConfiguracion('kiosco_longitud', kioscoLng),
        deliveryService.guardarConfiguracion('kiosco_nombre', kioscoNombre),
      ]);
      toast.success('✅ Ubicación del kiosco guardada correctamente.');
    } catch (err) {
      console.error('Error al guardar kiosco:', err);
      toast.error('No se pudo guardar la ubicación. Revisá la consola.');
    } finally {
      setGuardandoKiosco(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Selección de archivo QR (convierte a base64 para preview)
  // ──────────────────────────────────────────────────────────────────────────
  const handleSeleccionarQr = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    // Validar tipo de archivo
    if (!archivo.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen (JPG, PNG, WebP).');
      return;
    }

    // Validar tamaño (max 2 MB)
    if (archivo.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setQrPreview(reader.result);
      setQrNuevoBase64(reader.result); // Guardar base64 completo para persistir
    };
    reader.readAsDataURL(archivo);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Guardar imagen QR en configuracion_sistema como base64
  // ──────────────────────────────────────────────────────────────────────────
  const guardarQr = async () => {
    if (!qrNuevoBase64) {
      toast.error('Primero seleccioná una imagen QR.');
      return;
    }
    setGuardandoQr(true);
    try {
      await deliveryService.guardarConfiguracion('qr_pago_imagen', qrNuevoBase64);
      setQrImagen(qrNuevoBase64);
      setQrPreview(null);
      setQrNuevoBase64(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
      toast.success('✅ Imagen QR guardada correctamente.');
    } catch (err) {
      console.error('Error al guardar QR:', err);
      toast.error('No se pudo guardar el QR. Revisá la consola.');
    } finally {
      setGuardandoQr(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Eliminar imagen QR
  // ──────────────────────────────────────────────────────────────────────────
  const eliminarQr = async () => {
    if (!window.confirm('¿Confirmar eliminación de la imagen QR?')) return;
    try {
      await deliveryService.guardarConfiguracion('qr_pago_imagen', '');
      setQrImagen(null);
      setQrPreview(null);
      setQrNuevoBase64(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
      toast.success('Imagen QR eliminada.');
    } catch (err) {
      toast.error('No se pudo eliminar el QR.');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Selección de archivo de logotipo (solo PNG)
  // ──────────────────────────────────────────────────────────────────────────
  const handleSeleccionarLogo = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    if (archivo.type !== 'image/png' || !archivo.name.toLowerCase().endsWith('.png')) {
      toast.error('Solo se permiten archivos PNG (image/png).');
      if (inputLogoRef.current) inputLogoRef.current.value = '';
      return;
    }

    if (archivo.size > 2 * 1024 * 1024) {
      toast.error('El logotipo no puede superar los 2 MB.');
      if (inputLogoRef.current) inputLogoRef.current.value = '';
      return;
    }

    setArchivoLogo(archivo);
    setLogoPreview(URL.createObjectURL(archivo));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Subir logotipo PNG al servidor
  // ──────────────────────────────────────────────────────────────────────────
  const subirLogo = async () => {
    if (!archivoLogo) {
      toast.error('Primero seleccioná un archivo PNG.');
      return;
    }
    setSubiendoLogo(true);
    try {
      const respuesta = await deliveryService.subirLogo(archivoLogo);
      if (respuesta?.ok && respuesta.logo_url) {
        setLogoUrl(respuesta.logo_url);
        setLogoPreview(null);
        setArchivoLogo(null);
        if (inputLogoRef.current) inputLogoRef.current.value = '';
        toast.success('✅ Logotipo subido correctamente.');
      }
    } catch (err) {
      console.error('Error al subir logotipo:', err);
      const detalle = err.response?.data?.detail || 'No se pudo subir el logotipo.';
      toast.error(detalle);
    } finally {
      setSubiendoLogo(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Eliminar logotipo del sistema
  // ──────────────────────────────────────────────────────────────────────────
  const eliminarLogo = async () => {
    if (!window.confirm('¿Confirmar eliminación del logotipo de la tienda?')) return;
    try {
      await deliveryService.guardarConfiguracion('logo_url', '');
      setLogoUrl(null);
      setLogoPreview(null);
      setArchivoLogo(null);
      if (inputLogoRef.current) inputLogoRef.current.value = '';
      toast.success('Logotipo eliminado.');
    } catch (err) {
      toast.error('No se pudo eliminar el logotipo.');
    }
  };

  const logoActivo = logoUrlGlobal;
  const logoMostrar = logoPreview || (logoActivo ? obtenerUrlImagenCompleta(logoActivo) : null);

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Toaster position="top-right" />

      {/* ── Encabezado ── */}
      <div className="flex items-center gap-3 pb-1">
        <div className="bg-violet-600 rounded-xl p-2.5 shadow-lg shadow-violet-200">
          <Settings size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Configuración del Sistema</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Ajustá los parámetros globales de la tienda desde este panel.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 1: UBICACIÓN DEL KIOSCO
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header de sección */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-sky-50 rounded-lg p-2">
            <MapPin size={18} className="text-sky-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Ubicación del Kiosco (Origen de Rutas)</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Este punto se usa como origen al trazar las rutas de delivery en el mapa.
            </p>
          </div>
        </div>

        <form onSubmit={guardarUbicacionKiosco} className="p-6 space-y-5">
          {/* Nombre del kiosco */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nombre del establecimiento
            </label>
            <input
              type="text"
              value={kioscoNombre}
              onChange={(e) => setKioscoNombre(e.target.value)}
              placeholder="Ej: Tienda Margarita"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-800"
            />
          </div>

          {/* Coordenadas manuales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Latitud
              </label>
              <input
                type="number"
                step="0.00000001"
                value={kioscoLat}
                onChange={(e) => setKioscoLat(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-mono font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Longitud
              </label>
              <input
                type="number"
                step="0.00000001"
                value={kioscoLng}
                onChange={(e) => setKioscoLng(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-mono font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Botón: Usar mi ubicación GPS actual */}
          <button
            type="button"
            onClick={usarMiUbicacionActual}
            disabled={localizandoGPS}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl font-bold text-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            <LocateFixed size={16} className={localizandoGPS ? 'animate-pulse' : ''} />
            {localizandoGPS ? 'Obteniendo ubicación GPS...' : '📍 Usar mi ubicación GPS actual'}
          </button>

          {/* Mapa interactivo para ajuste visual */}
          {!cargandoKiosco && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ajuste Visual en el Mapa <span className="font-normal text-slate-400">(arrastrá el marcador)</span>
              </label>
              <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                <MapaInteractivo
                  lat={kioscoLat}
                  lng={kioscoLng}
                  soloLectura={false}
                  onChange={(lat, lng) => {
                    setKioscoLat(parseFloat(lat.toFixed(8)));
                    setKioscoLng(parseFloat(lng.toFixed(8)));
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                📌 Coordenadas actuales: {kioscoLat.toFixed(6)}, {kioscoLng.toFixed(6)}
              </p>
            </div>
          )}
          {cargandoKiosco && (
            <div className="w-full h-64 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-sm font-medium">
              Cargando mapa...
            </div>
          )}

          {/* Botón guardar */}
          <button
            type="submit"
            disabled={guardandoKiosco}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            <Save size={16} />
            {guardandoKiosco ? 'Guardando...' : 'Guardar Ubicación del Kiosco'}
          </button>
        </form>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 2: IMAGEN QR DE COBRO
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header de sección */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-indigo-50 rounded-lg p-2">
            <QrCode size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Imagen QR de Cobro</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Esta imagen se muestra en el Punto de Venta cuando el cliente elige pagar con QR.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Vista previa del QR actual */}
          {(qrImagen || qrPreview) && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-start">
                {qrPreview ? 'Vista previa (sin guardar)' : 'QR actual activo'}
              </p>
              <div className="relative">
                <img
                  src={qrPreview || qrImagen}
                  alt="QR de cobro"
                  className="w-52 h-52 object-contain rounded-xl border-2 border-dashed border-indigo-300 bg-white p-2 shadow-sm"
                />
                {qrPreview && (
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                    Sin guardar
                  </div>
                )}
                {qrImagen && !qrPreview && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                    <CheckCircle size={10} /> Activo
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sin QR configurado */}
          {!qrImagen && !qrPreview && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
              <QrCode size={40} className="text-slate-300" />
              <p className="text-xs text-slate-500 font-medium text-center">
                No hay imagen QR configurada.<br />
                Subí una imagen para que aparezca en el cobro.
              </p>
            </div>
          )}

          {/* Input de archivo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Seleccionar imagen QR <span className="font-normal text-slate-400">(JPG, PNG, WebP — máx. 2 MB)</span>
            </label>
            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleSeleccionarQr}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl py-1.5"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            {qrPreview && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setQrPreview(null);
                    setQrNuevoBase64(null);
                    if (inputArchivoRef.current) inputArchivoRef.current.value = '';
                  }}
                  className="flex items-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all cursor-pointer"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarQr}
                  disabled={guardandoQr}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 cursor-pointer shadow-sm"
                >
                  <Save size={16} />
                  {guardandoQr ? 'Guardando...' : 'Guardar imagen QR'}
                </button>
              </>
            )}

            {qrImagen && !qrPreview && (
              <button
                type="button"
                onClick={eliminarQr}
                className="flex items-center gap-1.5 py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                <X size={13} /> Eliminar QR actual
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECCIÓN 3: LOGOTIPO DE LA TIENDA (PNG)
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-violet-50 rounded-lg p-2">
            <Image size={18} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Logotipo de la Tienda (PNG)</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Se muestra en la pantalla de inicio de sesión y en la barra lateral del sistema.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {logoMostrar ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-start">
                {logoPreview ? 'Vista previa (sin guardar)' : 'Logotipo actual activo'}
              </p>
              <div className="relative">
                <img
                  src={logoMostrar}
                  alt="Logotipo de la tienda"
                  className="w-40 h-40 object-contain rounded-xl border-2 border-dashed border-violet-300 bg-white p-3 shadow-sm"
                />
                {logoPreview && (
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                    Sin guardar
                  </div>
                )}
                {logoActivo && !logoPreview && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                    <CheckCircle size={10} /> Activo
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white text-2xl font-extrabold">M</span>
              </div>
              <p className="text-xs text-slate-500 font-medium text-center">
                No hay logotipo configurado.<br />
                Subí un archivo PNG para personalizar la marca.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Seleccionar logotipo <span className="font-normal text-slate-400">(solo PNG — máx. 2 MB)</span>
            </label>
            <input
              ref={inputLogoRef}
              type="file"
              accept="image/png,.png"
              onChange={handleSeleccionarLogo}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer border border-slate-200 rounded-xl py-1.5"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            {archivoLogo && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                    setArchivoLogo(null);
                    if (inputLogoRef.current) inputLogoRef.current.value = '';
                  }}
                  className="flex items-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all cursor-pointer"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={subirLogo}
                  disabled={subiendoLogo}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 cursor-pointer shadow-sm"
                >
                  <Upload size={16} />
                  {subiendoLogo ? 'Subiendo...' : 'Subir Logotipo'}
                </button>
              </>
            )}

            {logoActivo && !archivoLogo && (
              <button
                type="button"
                onClick={eliminarLogo}
                className="flex items-center gap-1.5 py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                <X size={13} /> Eliminar logotipo
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Configuracion;
