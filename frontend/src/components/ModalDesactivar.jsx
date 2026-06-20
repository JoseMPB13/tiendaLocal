import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Modal personalizado para confirmación de bajas lógicas (Desactivaciones) en Tailwind CSS.
 */
export const ModalDesactivar = ({ mostrar, titulo, mensaje, alConfirmar, alCancelar, procesando = false }) => {
  if (!mostrar) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 border border-gray-200 animate-fade-in">
        <div className="flex items-start">
          <div className="p-2 bg-red-100 text-premium-danger rounded-full flex-shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">{titulo}</h4>
              <button onClick={alCancelar} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{mensaje}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={alCancelar}
            disabled={procesando}
            className="py-1.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={alConfirmar}
            disabled={procesando}
            className="py-1.5 px-4 bg-premium-danger hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50"
          >
            {procesando ? 'Desactivando...' : 'Confirmar Desactivación'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDesactivar;
