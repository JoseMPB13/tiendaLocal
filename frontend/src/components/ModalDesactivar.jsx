/**
 * Componente: ModalDesactivar.jsx
 * Modal premium de confirmación para bajas lógicas.
 * Incluye backdrop con blur, animación de entrada y diseño actualizado.
 */

import { AlertTriangle, X } from 'lucide-react';

export const ModalDesactivar = ({ mostrar, titulo, mensaje, alConfirmar, alCancelar, procesando = false }) => {
  if (!mostrar) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-container animate-fade-in-up"
        style={{ maxWidth: '420px' }}
      >
        {/* Franja superior de color peligro */}
        <div style={{
          height: '4px',
          background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)',
          borderRadius: '20px 20px 0 0',
        }} />

        {/* Cabecera */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', flexShrink: 0,
            background: '#fee2e2',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={22} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ flex: 1, paddingTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: '#1e1b4b',
                margin: 0,
              }}>
                {titulo}
              </h4>
              <button
                onClick={alCancelar}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  width: '28px', height: '28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Mensaje */}
        <div style={{ padding: '12px 24px 20px 82px' }}>
          <p style={{
            fontSize: '0.8125rem',
            color: '#6b7280',
            lineHeight: 1.6,
            margin: 0,
          }}>
            {mensaje}
          </p>
        </div>

        {/* Acciones */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '14px 24px 20px',
          borderTop: '1px solid #f3f4f6',
        }}>
          <button
            onClick={alCancelar}
            disabled={procesando}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={alConfirmar}
            disabled={procesando}
            className="btn-danger"
          >
            {procesando ? 'Procesando...' : 'Confirmar Desactivación'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDesactivar;
