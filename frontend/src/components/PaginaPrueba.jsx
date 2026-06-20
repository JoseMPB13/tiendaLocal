import React from 'react';

export const PaginaPrueba = ({ modulo }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-premium-dark mb-2">{modulo}</h3>
      <p className="text-gray-600 text-sm">
        Esqueleto inicial para la vista del módulo. Las funcionalidades de CRUD e interfaz interactiva serán incorporadas en las siguientes fases.
      </p>
    </div>
  );
};
