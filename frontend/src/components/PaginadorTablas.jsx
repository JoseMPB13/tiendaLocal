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

  return (
    <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-white rounded-b-2xl">
      {/* Contador de registros */}
      <p className="text-xs text-slate-500 font-medium m-0">
        Mostrando <span className="font-bold text-slate-700">{inicio}–{fin}</span> de{' '}
        <span className="font-bold text-slate-700">{totalItems}</span> registros
      </p>

      {/* Controles de página */}
      <div className="flex items-center gap-1">
        {/* Anterior */}
        <button
          onClick={() => paginaActual > 1 && alCambiarPagina(paginaActual - 1)}
          disabled={paginaActual === 1}
          className={`inline-flex items-center justify-center w-8.5 h-8.5 rounded-lg border text-xs font-semibold transition-all duration-150 focus:outline-none ${
            paginaActual === 1
              ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
          }`}
          title="Página anterior"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Páginas */}
        {paginas.map((p, idx) =>
          p === '...' ? (
            <span
              key={`elipsis-${idx}`}
              className="inline-flex items-center justify-center w-8.5 h-8.5 text-xs text-slate-400 font-medium select-none"
            >
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => alCambiarPagina(p)}
              className={`inline-flex items-center justify-center w-8.5 h-8.5 rounded-lg border text-xs font-bold transition-all duration-150 focus:outline-none ${
                paginaActual === p
                  ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Siguiente */}
        <button
          onClick={() => paginaActual < totalPaginas && alCambiarPagina(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          className={`inline-flex items-center justify-center w-8.5 h-8.5 rounded-lg border text-xs font-semibold transition-all duration-150 focus:outline-none ${
            paginaActual === totalPaginas
              ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
          }`}
          title="Página siguiente"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default PaginadorTablas;
