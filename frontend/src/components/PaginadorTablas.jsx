/**
 * Componente: PaginadorTablas.jsx
 * Paginador premium reutilizable para tablas de datos.
 * Diseño con botones redondeados, estado activo con color primario y contador de registros.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PaginadorTablas = ({ totalItems, itemsPorPagina, paginaActual, alCambiarPagina }) => {
  const totalPaginas = Math.ceil(totalItems / itemsPorPagina);

  if (totalPaginas <= 1) return null;

  // Genera un arreglo de páginas con elipsis si hay muchas
  const generarPaginas = () => {
    const paginas = [];
    const RANGO = 2;
    for (let i = 1; i <= totalPaginas; i++) {
      if (
        i === 1 || i === totalPaginas ||
        (i >= paginaActual - RANGO && i <= paginaActual + RANGO)
      ) {
        paginas.push(i);
      } else if (paginas[paginas.length - 1] !== '...') {
        paginas.push('...');
      }
    }
    return paginas;
  };

  const paginas = generarPaginas();
  const inicio = (paginaActual - 1) * itemsPorPagina + 1;
  const fin = Math.min(paginaActual * itemsPorPagina, totalItems);

  const btnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '34px',
    height: '34px',
    borderRadius: '8px',
    border: '1px solid var(--color-border-strong)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      borderTop: '1px solid var(--color-border)',
      background: 'white',
    }}>
      {/* Contador de registros */}
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, fontWeight: 500 }}>
        Mostrando <strong style={{ color: 'var(--color-text-secondary)' }}>{inicio}–{fin}</strong> de{' '}
        <strong style={{ color: 'var(--color-text-secondary)' }}>{totalItems}</strong> registros
      </p>

      {/* Controles de página */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Anterior */}
        <button
          onClick={() => paginaActual > 1 && alCambiarPagina(paginaActual - 1)}
          disabled={paginaActual === 1}
          style={{
            ...btnBase,
            background: paginaActual === 1 ? '#f9fafb' : 'white',
            color: paginaActual === 1 ? '#d1d5db' : 'var(--color-text-secondary)',
            cursor: paginaActual === 1 ? 'not-allowed' : 'pointer',
          }}
          title="Página anterior"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Páginas */}
        {paginas.map((p, idx) =>
          p === '...' ? (
            <span key={`elipsis-${idx}`} style={{ ...btnBase, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'default' }}>
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => alCambiarPagina(p)}
              style={{
                ...btnBase,
                background: paginaActual === p
                  ? 'var(--color-primary)'
                  : 'white',
                color: paginaActual === p ? 'white' : 'var(--color-text-secondary)',
                borderColor: paginaActual === p ? 'var(--color-primary)' : 'var(--color-border-strong)',
                boxShadow: paginaActual === p ? '0 2px 8px rgba(109,40,217,.35)' : 'none',
                fontWeight: paginaActual === p ? 700 : 600,
              }}
            >
              {p}
            </button>
          )
        )}

        {/* Siguiente */}
        <button
          onClick={() => paginaActual < totalPaginas && alCambiarPagina(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          style={{
            ...btnBase,
            background: paginaActual === totalPaginas ? '#f9fafb' : 'white',
            color: paginaActual === totalPaginas ? '#d1d5db' : 'var(--color-text-secondary)',
            cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer',
          }}
          title="Página siguiente"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default PaginadorTablas;
