/**
 * Vista: DashboardAdmin.jsx
 * Propósito: Panel de control ejecutivo con métricas financieras, gráficos analíticos,
 *            exportación de cierre de caja en PDF y KPIs en tiempo real para la Tienda Margarita.
 * Dependencias: reportesService, react-hot-toast, recharts, lucide-react, jspdf, html2canvas.
 * Módulo: Dashboard de Administración
 */

import { useState, useEffect } from 'react';
import reportesService from '../services/reportesService';
import toast, { Toaster } from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Truck, Calendar, Printer, DollarSign,
  RefreshCw, ArrowUpRight, ArrowDownRight, Package
} from 'lucide-react';

/* Componente de Tooltip personalizado para los gráficos */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1e1b4b',
        border: '1px solid rgba(196,181,253,.2)',
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.75rem',
        color: 'white',
        boxShadow: '0 8px 24px rgba(30,27,75,.4)',
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#c4b5fd' }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Bs. {Number(payload[0]?.value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export const DashboardAdmin = () => {
  const [metricas, setMetricas] = useState({
    total_ventas: 0.00,
    cantidad_transacciones: 0,
    deudas_activas_calle: 0.00,
    efectividad_delivery_porcentaje: 0.00,
    clientes_activos: 0,
    pedidos_delivery: 0,
    productos_vendidos: 0,
    ventas_por_categoria: []
  });

  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [cargando, setCargando] = useState(true);
  const [errorFechas, setErrorFechas] = useState(null); // Control de visualización de advertencia por rango incorrecto

  /* Paleta de colores para los gráficos */
  const COLORES = ['#6d28d9', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

  /**
   * Carga los indicadores agregados del negocio desde el backend en el rango de fechas especificado.
   * 
   * @param {string|null} fInicio - Fecha de inicio del rango (YYYY-MM-DD).
   * @param {string|null} fFin - Fecha de fin del rango (YYYY-MM-DD).
   * @returns {Promise<void>} Promesa sin valor de retorno que actualiza el estado local de métricas.
   */
  const cargarMetricas = async (fInicio = null, fFin = null) => {
    try {
      setCargando(true);
      const res = await reportesService.obtenerDashboard(fInicio, fFin);
      if (res.ok) {
        setMetricas(res.data);
      }
    } catch (ex) {
      console.error(ex);
      toast.error('Error al conectar con la API de reportes.');
    } finally {
      setCargando(false);
    }
  };

  /**
   * Valida de manera reactiva la consistencia del rango de fechas.
   * Evita consultas inválidas al backend si la fecha de inicio es posterior a la fecha de fin.
   * 
   * @param {string} inicio - Fecha de inicio en formato YYYY-MM-DD.
   * @param {string} fin - Fecha de fin en formato YYYY-MM-DD.
   * @returns {boolean} Retorna true si el rango es válido y lógico; false si es inconsistente.
   */
  const validarRangoFechas = (inicio, fin) => {
    if (inicio && fin && inicio > fin) {
      setErrorFechas('La fecha de Inicio no puede ser posterior a la fecha de Fin.');
      return false;
    }
    setErrorFechas(null);
    return true;
  };

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      if (validarRangoFechas(fechaInicio, fechaFin)) {
        cargarMetricas(fechaInicio, fechaFin);
      }
    };
    inicializar();
  }, [fechaInicio, fechaFin]);

  /**
   * Genera de forma programática un reporte en PDF a partir de una plantilla estructurada
   * en escala de grises y lo descarga en el cliente.
   * 
   * @returns {Promise<void>}
   */
  const handleGenerarPdfCierre = async () => {
    try {
      const loadToast = toast.loading('Generando documento PDF de cierre...');

      // 1. Determinar título y nombre del archivo según fechas
      const esDiaUnico = fechaInicio === fechaFin;
      let tituloReporte = '';
      let nombreArchivo = '';

      if (esDiaUnico) {
        tituloReporte = `REPORTE DE CIERRE DIARIO - ${fechaInicio}`;
        nombreArchivo = `cierre_diario_${fechaInicio}.pdf`;
      } else {
        tituloReporte = `REPORTE DE CIERRE GENERAL - PERIODO ${fechaInicio} AL ${fechaFin}`;
        nombreArchivo = `cierre_diario_${fechaInicio}_a_${fechaFin}.pdf`;
      }

      // 2. Crear el elemento HTML temporal para el reporte (escala de grises / corporativo)
      const element = document.createElement('div');
      // Dimensiones específicas para el render de html2canvas (800px)
      element.style.width = '800px';
      element.style.padding = '32px';
      element.style.backgroundColor = '#ffffff';
      element.style.color = '#000000';
      element.style.fontFamily = 'Inter, system-ui, sans-serif';
      element.style.fontSize = '12px';
      element.style.lineHeight = '1.5';

      // Construir el desglose de categorías en HTML
      let filasCategorias = '';
      if (metricas.ventas_por_categoria && metricas.ventas_por_categoria.length > 0) {
        metricas.ventas_por_categoria.forEach((cat) => {
          const totalVentasVal = metricas.total_ventas || 1;
          const porcentaje = ((cat.valor / totalVentasVal) * 100).toFixed(1);
          filasCategorias += `
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 10px; border: 1px solid #9ca3af;">${cat.name}</td>
              <td style="padding: 10px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">
                Bs. ${cat.valor.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </td>
              <td style="padding: 10px; border: 1px solid #9ca3af; text-align: right;">${porcentaje}%</td>
            </tr>
          `;
        });
      } else {
        filasCategorias = `
          <tr>
            <td colspan="3" style="padding: 16px; text-align: center; color: #6b7280; font-style: italic; border: 1px solid #9ca3af;">
              No se registraron ventas en este período.
            </td>
          </tr>
        `;
      }

      element.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1px;">TIENDA MARGARITA</h1>
          <h2 style="font-size: 13px; font-weight: 700; color: #374151; margin: 6px 0 0 0; letter-spacing: 0.5px;">${tituloReporte}</h2>
          <p style="font-size: 10px; color: #6b7280; margin: 4px 0 0 0; font-style: italic;">Hoja Oficial de Auditoría y Control de Operaciones</p>
        </div>

        <div style="display: flex; justify-content: space-between; border: 1px solid #000000; padding: 14px; border-radius: 6px; margin-bottom: 24px; background-color: #f9fafb; font-size: 11px;">
          <div>
            <p style="font-weight: bold; text-transform: uppercase; color: #4b5563; margin: 0 0 4px 0;">Rango de Fechas Auditado</p>
            <p style="margin: 0;">Fecha de Inicio: <strong>${fechaInicio}</strong></p>
            <p style="margin: 2px 0 0 0;">Fecha de Fin: <strong>${fechaFin}</strong></p>
          </div>
          <div style="text-align: right;">
            <p style="font-weight: bold; text-transform: uppercase; color: #4b5563; margin: 0 0 4px 0;">Fecha y Hora de Emisión</p>
            <p style="margin: 0; font-weight: bold;">
              ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              - 
              ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p style="font-size: 9px; color: #6b7280; margin: 2px 0 0 0; font-style: italic;">Generado digitalmente por el Sistema</p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000000; padding-bottom: 4px; margin: 0 0 12px 0; letter-spacing: 0.5px;">
            I. RESUMEN DE MÉTRICAS CLAVE
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="border: 1px solid #d1d5db; padding: 12px; border-radius: 4px;">
              <p style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 9px; margin: 0;">Ventas Totales</p>
              <p style="font-size: 16px; font-weight: bold; margin: 4px 0 0 0;">Bs. ${metricas.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              <p style="font-size: 9px; color: #6b7280; margin: 2px 0 0 0;">${metricas.cantidad_transacciones} transacciones completadas</p>
            </div>
            <div style="border: 1px solid #d1d5db; padding: 12px; border-radius: 4px;">
              <p style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 9px; margin: 0;">Deudas en la Calle</p>
              <p style="font-size: 16px; font-weight: bold; margin: 4px 0 0 0;">Bs. ${metricas.deudas_activas_calle.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              <p style="font-size: 9px; color: #6b7280; margin: 2px 0 0 0;">Total fiado en cuentas corrientes</p>
            </div>
            <div style="border: 1px solid #d1d5db; padding: 12px; border-radius: 4px;">
              <p style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 9px; margin: 0;">Pedidos por Delivery</p>
              <p style="font-size: 16px; font-weight: bold; margin: 4px 0 0 0;">${metricas.pedidos_delivery || 0} pedidos</p>
              <p style="font-size: 9px; color: #6b7280; margin: 2px 0 0 0;">Solicitudes absolutas de reparto</p>
            </div>
            <div style="border: 1px solid #d1d5db; padding: 12px; border-radius: 4px;">
              <p style="font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 9px; margin: 0;">Total de Productos Vendidos</p>
              <p style="font-size: 16px; font-weight: bold; margin: 4px 0 0 0;">${metricas.productos_vendidos || 0} unidades</p>
              <p style="font-size: 9px; color: #6b7280; margin: 2px 0 0 0;">Cantidad física de unidades vendidas</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 32px;">
          <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000000; padding-bottom: 4px; margin: 0 0 12px 0; letter-spacing: 0.5px;">
            II. DISTRIBUCIÓN DE VENTAS POR CATEGORÍA
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #9ca3af;">
            <thead>
              <tr style="background-color: #f3f4f6; border-bottom: 2px solid #9ca3af;">
                <th style="padding: 8px 10px; border: 1px solid #9ca3af; font-weight: bold; text-align: left; text-transform: uppercase; font-size: 9px;">Nombre de Categoría</th>
                <th style="padding: 8px 10px; border: 1px solid #9ca3af; font-weight: bold; text-align: right; text-transform: uppercase; font-size: 9px;">Monto Recaudado (Bs.)</th>
                <th style="padding: 8px 10px; border: 1px solid #9ca3af; font-weight: bold; text-align: right; text-transform: uppercase; font-size: 9px;">Participación (%)</th>
              </tr>
            </thead>
            <tbody>
              ${filasCategorias}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 60px; padding-top: 24px; border-top: 1px dashed #9ca3af;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; text-align: center; font-size: 11px;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 160px; border-bottom: 1px solid #000000; margin-bottom: 6px;"></div>
              <p style="font-weight: bold; text-transform: uppercase; font-size: 9px; margin: 0;">Administrador Principal</p>
              <p style="font-size: 8px; color: #6b7280; margin: 2px 0 0 0;">Firma y Sello de Autorización</p>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 160px; border-bottom: 1px solid #000000; margin-bottom: 6px;"></div>
              <p style="font-weight: bold; text-transform: uppercase; font-size: 9px; margin: 0;">Auditor de Caja</p>
              <p style="font-size: 8px; color: #6b7280; margin: 2px 0 0 0;">Firma de Validación de Saldos</p>
            </div>
          </div>
        </div>
      `;

      // 4. Renderizar a Canvas y descargar PDF
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.top = '0';
      document.body.appendChild(element);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // Ancho A4 en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(nombreArchivo);

      document.body.removeChild(element);
      toast.dismiss(loadToast);
      toast.success('Documento PDF descargado correctamente.');
    } catch (ex) {
      console.error(ex);
      toast.dismiss();
      toast.error('Error al generar el documento PDF.');
    }
  };

  /* Datos de las tarjetas estadísticas reestructuradas según requerimiento (sin badge de tendencia) */
  const statsCards = [
    {
      label: 'Ventas Totales',
      valor: `Bs. ${metricas.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      sub: `${metricas.cantidad_transacciones} transacciones`,
      icono: <TrendingUp size={22} />,
      gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)',
      glow: 'rgba(109,40,217,.3)',
      tendencia: null, // Eliminado por requerimiento para quitar badge verde de la tarjeta de ventas
    },
    {
      label: 'Deudas en la Calle',
      valor: `Bs. ${metricas.deudas_activas_calle.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      sub: 'Cuentas corrientes fiadas',
      icono: <DollarSign size={22} />,
      gradient: 'linear-gradient(135deg, #dc2626, #ef4444)',
      glow: 'rgba(220,38,38,.3)',
      tendencia: null,
    },
    {
      label: 'Pedidos Delivery',
      valor: String(metricas.pedidos_delivery || 0),
      sub: 'Solicitados por delivery',
      icono: <Truck size={22} />,
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      glow: 'rgba(5,150,105,.3)',
      tendencia: null,
    },
    {
      label: 'Productos Vendidos',
      valor: String(metricas.productos_vendidos || 0),
      sub: 'Unidades vendidas',
      icono: <Package size={22} />,
      gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      glow: 'rgba(37,99,235,.3)',
      tendencia: null,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.8125rem',
            fontWeight: 500,
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(30,27,75,.15)',
          },
          success: { iconTheme: { primary: '#059669', secondary: 'white' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: 'white' } },
        }}
      />

      {/* Banner flotante de error para la validación de consistencia de fechas */}
      {errorFechas && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-lg animate-fade-in-down max-w-md w-[90%] md:w-auto transition-all duration-300">
          <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          <span className="text-xs font-semibold">{errorFechas}</span>
          <button 
            onClick={() => setErrorFechas(null)} 
            className="ml-auto text-red-400 hover:text-red-600 transition-colors text-sm font-bold pl-2 focus:outline-none"
          >
            ×
          </button>
        </div>
      )}

      {/* ── CONTROLES: EXPORTAR CIERRE ── */}
      <div style={{
        background: 'white',
        borderRadius: '14px',
        padding: '20px 24px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <div>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>
            Resumen Ejecutivo &amp; Reportes
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '3px', marginBottom: 0 }}>
            Control financiero y logístico en tiempo real
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Fecha Inicio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 650, color: '#4b5563' }}>Inicio:</span>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  const valor = e.target.value;
                  setFechaInicio(valor);
                  validarRangoFechas(valor, fechaFin);
                }}
                className="form-input"
                style={{ paddingLeft: '30px', fontSize: '0.78rem', minWidth: '135px' }}
              />
            </div>
          </div>

          {/* Fecha Fin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 650, color: '#4b5563' }}>Fin:</span>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  const valor = e.target.value;
                  setFechaFin(valor);
                  validarRangoFechas(fechaInicio, valor);
                }}
                className="form-input"
                style={{ paddingLeft: '30px', fontSize: '0.78rem', minWidth: '135px' }}
              />
            </div>
          </div>

          {/* Botón Actualizar */}
          <button
            onClick={() => {
              if (validarRangoFechas(fechaInicio, fechaFin)) {
                cargarMetricas(fechaInicio, fechaFin);
              }
            }}
            className="btn-secondary"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={14} />
            Actualizar
          </button>

          {/* Botón Descargar Cierre en PDF (Manejador Directo html2pdf/jspdf) */}
          <button
            onClick={handleGenerarPdfCierre}
            className="btn-primary"
            style={{ gap: '6px' }}
          >
            <Printer size={14} />
            Imprimir Cierre Diario
          </button>
        </div>
      </div>

      {/* ── CARDS DE MÉTRICAS ── */}
      {cargando ? (
        <div style={{
          textAlign: 'center', padding: '48px',
          background: 'white', borderRadius: '14px',
          border: '1px solid var(--color-border)',
          color: '#9ca3af', fontSize: '0.85rem', fontWeight: 500,
        }}>
          Cargando indicadores de negocio...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {statsCards.map((card, i) => (
            <div
              key={i}
              className="animate-fade-in-up"
              style={{
                background: 'white',
                borderRadius: '14px',
                padding: '20px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                animationDelay: `${i * 0.07}s`,
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{
                  width: '46px', height: '46px',
                  background: card.gradient,
                  borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white',
                  boxShadow: `0 6px 20px ${card.glow}`,
                }}>
                  {card.icono}
                </div>
                {card.tendencia && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '2px',
                    fontSize: '0.7rem', fontWeight: 700,
                    color: card.tendenciaValor >= 0 ? '#059669' : '#dc2626', 
                    background: card.tendenciaValor >= 0 ? '#d1fae5' : '#fee2e2',
                    padding: '3px 8px', borderRadius: '9999px',
                  }}>
                    {card.tendenciaValor >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {card.tendencia}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', margin: '0 0 4px' }}>
                {card.label}
              </p>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.375rem', fontWeight: 800, color: '#1e1b4b', margin: '0 0 4px' }}>
                {card.valor}
              </p>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, fontWeight: 500 }}>
                {card.sub}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── GRÁFICOS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

        {/* Gráfico de Barras: Ventas por Categoría */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '22px',
          border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>
              Distribución de Ventas (Bs.)
            </h4>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', marginBottom: 0 }}>
              Total recaudado por categoría de inventario
            </p>
          </div>
          <div style={{ height: '300px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metricas.ventas_por_categoria} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(109,40,217,.05)' }} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {metricas.ventas_por_categoria.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Torta: Participación de Ventas */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '22px',
          border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>
              Participación de Mercado
            </h4>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', marginBottom: 0 }}>
              Porcentaje de ventas según tipo de producto
            </p>
          </div>
          <div style={{ height: '300px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metricas.ventas_por_categoria}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="valor"
                >
                  {metricas.ventas_por_categoria.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`Bs. ${Number(value).toFixed(2)}`, 'Ventas']} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '0.72rem', fontFamily: 'Inter' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAdmin;
