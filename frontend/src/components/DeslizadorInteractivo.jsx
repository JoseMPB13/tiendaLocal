import React, { useState } from 'react';

/**
 * Componente para simular la acción de deslizamiento táctil/mouse para confirmar operaciones en ruta.
 * Previene clics accidentales de manera simple mediante un arrastre visual.
 */
export const DeslizadorInteractivo = ({ alDeslizar, etiqueta, colorFondo = "bg-zinc-950", deshabilitado = false }) => {
  const [progreso, setProgreso] = useState(0);
  const contenedorRef = React.useRef(null);
  const arrastrandoRef = React.useRef(false);

  const alIniciarArrastre = () => {
    if (deshabilitado) return;
    arrastrandoRef.current = true;
  };

  const alArrastrar = (e) => {
    if (!arrastrandoRef.current || deshabilitado) return;
    
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const rect = contenedor.getBoundingClientRect();
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const offset = clienteX - rect.left;
    const porcentaje = Math.min(Math.max((offset / rect.width) * 100, 0), 100);

    setProgreso(porcentaje);

    if (porcentaje >= 92) {
      arrastrandoRef.current = false;
      setProgreso(100);
      alDeslizar();
      setTimeout(() => setProgreso(0), 1500); // Restablecer después del callback
    }
  };

  const alFinalizarArrastre = () => {
    arrastrandoRef.current = false;
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
      className={`relative w-full h-12 bg-zinc-100 rounded-xl overflow-hidden select-none border border-zinc-200 ${
        deshabilitado ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Barra de progreso de arrastre */}
      <div 
        className={`absolute inset-y-0 left-0 ${colorFondo} rounded-xl transition-all duration-75`}
        style={{ width: `${Math.max(progreso, 10)}%` }}
      />

      {/* Botón interactivo a deslizar */}
      <div 
        onMouseDown={alIniciarArrastre}
        onTouchStart={alIniciarArrastre}
        className="absolute top-1 bg-white hover:bg-zinc-50 text-zinc-900 rounded-lg h-10 w-10 shadow flex items-center justify-center font-bold text-lg select-none border border-zinc-200 z-10 transition-all duration-75"
        style={{ left: `calc(${progreso}% - ${progreso > 85 ? '44px' : '0px'})` }}
      >
        →
      </div>

      {/* Texto de ayuda central */}
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-zinc-500 pointer-events-none uppercase tracking-wider">
        {progreso > 85 ? "¡Confirmado!" : etiqueta}
      </div>
    </div>
  );
};

export default DeslizadorInteractivo;
