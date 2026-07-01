/**
 * Componente: PanelFiltroBusqueda.jsx
 * Filtro de búsqueda reusable para listados del sistema.
 * Permite buscar por texto libre y filtrar por categorías.
 * Idioma: Español
 */

import { Search } from 'lucide-react';

export const PanelFiltroBusqueda = ({
  buscarTexto,
  alCambiarBuscarTexto,
  categoriaSeleccionada,
  alCambiarCategoria,
  categorias = [],
  placeholder = "Buscar...",
  etiquetaCategoria = "Categoría",
  estadoSeleccionado,
  alCambiarEstado,
  deudaSeleccionada,
  alCambiarDeuda,
  opcionesEstado
}) => {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '15px',
      background: 'white',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* Entrada de Texto */}
      <div style={{ flex: '1 1 300px', position: 'relative' }}>
        <input
          type="text"
          value={buscarTexto}
          onChange={(e) => alCambiarBuscarTexto(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.8125rem',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s',
          }}
          className="focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
        />
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8'
          }}
        />
      </div>

      {/* Selector de Categorías */}
      {alCambiarCategoria && categorias && categorias.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', fontFamily: 'Inter, sans-serif' }}>
            {etiquetaCategoria}:
          </span>
          <select
            value={categoriaSeleccionada}
            onChange={(e) => alCambiarCategoria(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8125rem',
              background: 'white',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}
            className="focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
          >
            <option value="">Todas</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selector de Estado */}
      {alCambiarEstado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', fontFamily: 'Inter, sans-serif' }}>
            Estado:
          </span>
          <select
            value={estadoSeleccionado}
            onChange={(e) => alCambiarEstado(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8125rem',
              background: 'white',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}
            className="focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
          >
            {opcionesEstado ? (
              opcionesEstado.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            ) : (
              <>
                <option value="">Todos</option>
                <option value="Activo">Activos</option>
                <option value="Inactivo">Inactivos</option>
              </>
            )}
          </select>
        </div>
      )}

      {/* Selector de Deuda */}
      {alCambiarDeuda && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', fontFamily: 'Inter, sans-serif' }}>
            Deuda:
          </span>
          <select
            value={deudaSeleccionada}
            onChange={(e) => alCambiarDeuda(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8125rem',
              background: 'white',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}
            className="focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
          >
            <option value="">Todos</option>
            <option value="con_deuda">Con Saldo Pendiente</option>
            <option value="sin_deuda">Sin Deuda</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default PanelFiltroBusqueda;
