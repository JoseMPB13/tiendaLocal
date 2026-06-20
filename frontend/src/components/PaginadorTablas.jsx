import React, { useState } from 'react';

/**
 * Componente de paginación clásica reutilizable para tablas.
 */
export const PaginadorTablas = ({ totalItems, itemsPorPagina, paginaActual, alCambiarPagina }) => {
  const totalPaginas = Math.ceil(totalItems / itemsPorPagina);

  if (totalPaginas <= 1) return null;

  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => paginaActual > 1 && alCambiarPagina(paginaActual - 1)}
          disabled={paginaActual === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          onClick={() => paginaActual < totalPaginas && alCambiarPagina(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>

      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-gray-500">
            Mostrando resultados del <span className="font-medium">{(paginaActual - 1) * itemsPorPagina + 1}</span> al{' '}
            <span className="font-medium">{Math.min(paginaActual * itemsPorPagina, totalItems)}</span> de{' '}
            <span className="font-medium">{totalItems}</span> registros
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-1" aria-label="Pagination">
            <button
              onClick={() => paginaActual > 1 && alCambiarPagina(paginaActual - 1)}
              disabled={paginaActual === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            {paginas.map(p => (
              <button
                key={p}
                onClick={() => alCambiarPagina(p)}
                className={`relative inline-flex items-center px-3 py-2 border text-xs font-medium ${
                  paginaActual === p
                    ? 'z-10 bg-premium-primary border-premium-primary text-white font-bold'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => paginaActual < totalPaginas && alCambiarPagina(paginaActual + 1)}
              disabled={paginaActual === totalPaginas}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default PaginadorTablas;
