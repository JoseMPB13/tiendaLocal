/**
 * Vista: DashboardAdmin.jsx
 * Panel de control ejecutivo con métricas financieras, gráficos analíticos
 * y exportación de cierre de caja en PDF autenticado.
 * Diseño premium con cards de gradiente y animaciones suaves.
 */

import { useState, useEffect } from 'react';
import reportesService from '../services/reportesService';
import toast, { Toaster } from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Truck, Calendar, Printer, DollarSign,
  RefreshCw, ArrowUpRight, ArrowDownRight
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
    ventas_por_categoria: []
  });

  const [fechaCierre, setFechaCierre] = useState(new Date().toISOString().split('T')[0]);
  const [cargando, setCargando] = useState(true);

  /* Paleta de colores para los gráficos */
  const COLORES = ['#6d28d9', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

  const cargarMetricas = async () => {
    try {
      setCargando(true);
      const res = await reportesService.obtenerDashboard();
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

  useEffect(() => {
    // Evita actualizaciones síncronas de estado en el render inicial de React
    const inicializar = async () => {
      await Promise.resolve();
      cargarMetricas();
    };
    inicializar();
  }, []);

  /**
   * Exportar Cierre de Caja como PDF:
   * Descarga autenticada usando axios con responseType: 'blob'
   * para evitar el error 401 que ocurría con window.open directo.
   */
  const handleExportarCierrePdfClick = async () => {
    if (!fechaCierre) {
      toast.error('Seleccione una fecha de cierre válida.');
      return;
    }

    try {
      const loadToast = toast.loading('Generando y descargando PDF...');
      const blob = await reportesService.obtenerCierrePdfBlob(fechaCierre);
      toast.dismiss(loadToast);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cierre_caja_${fechaCierre}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
      toast.success('PDF descargado correctamente.');
    } catch (ex) {
      console.error(ex);
      toast.dismiss();
      toast.error('Error al generar el PDF de cierre de caja.');
    }
  };

  /* Datos de las tarjetas estadísticas */
  const statsCards = [
    {
      label: 'Ventas Totales',
      valor: `Bs. ${metricas.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      sub: `${metricas.cantidad_transacciones} transacciones`,
      icono: <TrendingUp size={22} />,
      gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)',
      glow: 'rgba(109,40,217,.3)',
      tendencia: metricas.tendencia_ventas !== undefined 
        ? `${metricas.tendencia_ventas >= 0 ? '+' : ''}${metricas.tendencia_ventas.toFixed(1)}%` 
        : '0.0%',
      tendenciaValor: metricas.tendencia_ventas || 0,
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
      label: 'Efectividad Delivery',
      valor: `${metricas.efectividad_delivery_porcentaje.toFixed(1)}%`,
      sub: 'Despachos completados',
      icono: <Truck size={22} />,
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      glow: 'rgba(5,150,105,.3)',
      tendencia: null,
    },
    {
      label: 'Clientes Activos',
      valor: String(metricas.clientes_activos || 0),
      sub: 'Registrados en la tienda',
      icono: <Users size={22} />,
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
          {/* Input de fecha */}
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', pointerEvents: 'none',
            }} />
            <input
              type="date"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '30px', fontSize: '0.78rem', minWidth: '155px' }}
            />
          </div>

          {/* Botón Actualizar */}
          <button
            onClick={cargarMetricas}
            className="btn-secondary"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={14} />
            Actualizar
          </button>

          {/* Botón PDF */}
          <button
            onClick={handleExportarCierrePdfClick}
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
