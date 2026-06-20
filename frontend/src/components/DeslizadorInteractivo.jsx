import React, { useState } from 'react';

/**
 * Componente para simular la acción de deslizamiento táctil/mouse para confirmar operaciones en ruta.
 * Previene clics accidentales de manera simple mediante un arrastre visual.
 */
export const DeslizadorInteractivo = ({ alDeslizar, etiqueta, colorFondo = "bg-premium-primary", deshabilitado = false }) => {
  const [progreso, setProgreso] = useState(0);
  const contenedorRef = React.useRef(null);
  const arrastrandoRef = React.useRef(false);

  const alIniciarArrastre = () => {
    if (deshabilitado) return;
    arrastrandoRef.value = true;
  };

  const alArrastrar = (e) => {
    if (!arrastrandoRef.value || deshabilitado) return;
    
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const rect = contenedor.getBoundingClientRect();
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const offset = clienteX - rect.left;
    const porcentaje = Math.min(Math.max((offset / rect.width) * 100, 0), 100);

    setProgreso(porcentaje);

    if (porcentaje >= 92) {
      arrastrandoRef.value = false;
      setProgreso(100);
      alDeslizar();
      setTimeout(() => setProgreso(0), 1500); // Restablecer después del callback
    }
  };

  const alFinalizarArrastre = () => {
    arrastrandoRef.value = false;
    if (progreso < 92) {
      setProgreso(0); // Restablecer si no se completó
    }
  };

  return (
    <div 
      ref={contenedorRef}
      onMouseMove={alArrastrar}
      onMouseUp={alFinalizarArrastre}
      onMouseLeave={alFinalizarArrastre}
      onTouchMove={alArrastrar}
      onTouchEnd={alFinalizarArrastre}
      className={`relative w-full h-14 bg-gray-200 rounded-full overflow-hidden select-none border border-gray-300 ${
        deshabilitado ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Barra de progreso de arrastre */}
      <div 
        className={`absolute inset-y-0 left-0 ${colorFondo} rounded-full transition-all duration-75`}
        style={{ width: `${Math.max(progreso, 12)}%` }}
      />

      {/* Botón interactivo a deslizar */}
      <div 
        onMouseDown={alIniciarArrastre}
        onTouchStart={alIniciarArrastre}
        className="absolute top-1 bg-white hover:bg-gray-50 text-gray-800 rounded-full h-12 w-12 shadow flex items-center justify-center font-bold text-lg select-none border border-gray-300 z-10 transition-all duration-75"
        style={{ left: `calc(${progreso}% - ${progreso > 85 ? '50px' : '0px'})` }}
      >
        →
      </div>

      {/* Texto de ayuda central */}
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-500 pointer-events-none uppercase tracking-wider">
        {progreso > 85 ? "¡Confirmado!" : etiqueta}
      </div>
    </div>
  );
};

export default DeslizadorInteractivo;
