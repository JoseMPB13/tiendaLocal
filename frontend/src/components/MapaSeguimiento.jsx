/**
 * Componente: MapaSeguimiento.jsx
 * Propósito: Mapa interactivo de seguimiento de ruta en tiempo real para el módulo
 * de delivery. Muestra tres marcadores simultáneos:
 *   🏠 Kiosco (origen fijo, color verde)
 *   🚴 Repartidor (posición en tiempo real, color azul)
 *   📍 Destino del cliente (coordenadas del envío, color rojo)
 * Dibuja la ruta entre los puntos usando el motor de enrutamiento libre OSRM.
 * Se actualiza automáticamente cuando cambian las coordenadas del repartidor.
 * Idioma: Español
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para íconos de Leaflet al empaquetar con Vite/Webpack
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Íconos personalizados con colores diferenciados por rol en la ruta
const crearIconoPersonalizado = (color, etiqueta) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="36">
    <path d="M12 0C5.383 0 0 5.383 0 12c0 8.435 10.5 22.5 12 24 1.5-1.5 12-15.565 12-24 0-6.617-5.383-12-12-12z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
    <text x="12" y="16" text-anchor="middle" font-size="8" font-weight="bold" fill="${color}">${etiqueta}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    className: ''
  });
};

// Definición de íconos por tipo de marcador
const ICONO_KIOSCO   = crearIconoPersonalizado('#16a34a', 'K');  // verde
const ICONO_DESTINO  = crearIconoPersonalizado('#dc2626', 'D');  // rojo
const ICONO_REPARTIDOR = crearIconoPersonalizado('#2563eb', 'R'); // azul

/**
 * Traza la ruta entre dos o más puntos geográficos usando la API pública de OSRM.
 * @param {Array<[number,number]>} puntos - Lista de coordenadas [lat, lng] en orden de ruta.
 * @returns {Promise<L.LatLng[]>} - Lista de puntos para el polígono de la ruta.
 */
const obtenerRutaOSRM = async (puntos) => {
  if (puntos.length < 2) return null;
  // Formato OSRM: longitud,latitud;longitud,latitud (ojo: invertido respecto a Leaflet)
  const coordenadasStr = puntos.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson`;
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    if (!datos.routes || datos.routes.length === 0) return null;
    // Convertir GeoJSON [lng, lat] a formato Leaflet [lat, lng]
    return datos.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  }
};

/**
 * Props:
 * @param {number|null} latKiosco - Latitud del kiosco (origen). Por defecto Santa Cruz, Bolivia.
 * @param {number|null} lngKiosco - Longitud del kiosco.
 * @param {number|null} latRepartidor - Latitud actual del repartidor (se actualiza en tiempo real).
 * @param {number|null} lngRepartidor - Longitud actual del repartidor.
 * @param {number|null} latDestino - Latitud del destino del cliente.
 * @param {number|null} lngDestino - Longitud del destino del cliente.
 * @param {string} nombreDestino - Nombre del cliente para el popup del marcador.
 * @param {string} estadoEnvio - Estado actual del envío para mostrar en la info.
 */
export const MapaSeguimiento = ({
  latKiosco    = -17.7833,
  lngKiosco    = -63.1667,
  latRepartidor = null,
  lngRepartidor = null,
  latDestino,
  lngDestino,
  nombreDestino = 'Destino',
  estadoEnvio = 'En Camino'
}) => {
  const contenedorRef  = useRef(null);
  const mapaRef        = useRef(null);
  const marcadorKioscoRef      = useRef(null);
  const marcadorRepartidorRef  = useRef(null);
  const marcadorDestinoRef     = useRef(null);
  const polylineKioscoRef      = useRef(null);
  const polylineDestinoRef     = useRef(null);

  const [distanciaKm, setDistanciaKm] = useState(null);
  const [errorRuta, setErrorRuta] = useState(false);

  // Coordenadas numéricas seguras
  const latK = parseFloat(latKiosco)   || -17.7833;
  const lngK = parseFloat(lngKiosco)   || -63.1667;
  const latD = parseFloat(latDestino);
  const lngD = parseFloat(lngDestino);
  const latR = latRepartidor !== null ? parseFloat(latRepartidor) : null;
  const lngR = lngRepartidor !== null ? parseFloat(lngRepartidor) : null;

  const tieneDestino     = !isNaN(latD) && !isNaN(lngD);
  const tieneRepartidor  = latR !== null && !isNaN(latR) && lngR !== null && !isNaN(lngR);

  // ──────────────────────────────────────────────────────────────────────────
  // EFECTO 1: Inicialización del mapa (ejecuta una sola vez al montar)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    // Centro inicial del mapa: destino o kiosco si no hay destino
    const centroInicial = tieneDestino ? [latD, lngD] : [latK, lngK];
    const mapa = L.map(contenedorRef.current, { zoomControl: true }).setView(centroInicial, 13);
    mapaRef.current = mapa;

    // Capa de mosaicos OpenStreetMap (libre y sin llave de API)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapa);

    // Marcador del Kiosco (origen fijo)
    const mkKiosco = L.marker([latK, lngK], { icon: ICONO_KIOSCO, zIndexOffset: 10 })
      .addTo(mapa)
      .bindPopup('<b>🏠 Kiosco (Origen)</b><br/>Punto de recogida del pedido');
    marcadorKioscoRef.current = mkKiosco;

    // Marcador del Destino (coordenadas del cliente)
    if (tieneDestino) {
      const mkDestino = L.marker([latD, lngD], { icon: ICONO_DESTINO, zIndexOffset: 10 })
        .addTo(mapa)
        .bindPopup(`<b>📍 Destino</b><br/>${nombreDestino}`);
      marcadorDestinoRef.current = mkDestino;
    }

    // Marcador del Repartidor (posición en tiempo real)
    if (tieneRepartidor) {
      const mkRepartidor = L.marker([latR, lngR], { icon: ICONO_REPARTIDOR, zIndexOffset: 20 })
        .addTo(mapa)
        .bindPopup('<b>🚴 Repartidor</b><br/>Tu ubicación actual');
      marcadorRepartidorRef.current = mkRepartidor;
    }

    // Corrección de renderizado incompleto de Leaflet en contenedores dinámicos
    setTimeout(() => mapa.invalidateSize(), 150);

    return () => {
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
        marcadorKioscoRef.current     = null;
        marcadorRepartidorRef.current = null;
        marcadorDestinoRef.current    = null;
        if (polylineKioscoRef.current) polylineKioscoRef.current.remove();
        if (polylineDestinoRef.current) polylineDestinoRef.current.remove();
        polylineKioscoRef.current = null;
        polylineDestinoRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────────────────────────────────
  // EFECTO 2: Actualización de la posición del repartidor y recálculo de ruta
  // Se dispara cada vez que cambian las coordenadas del repartidor.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    // Actualizar o crear el marcador del repartidor
    if (tieneRepartidor) {
      if (marcadorRepartidorRef.current) {
        marcadorRepartidorRef.current.setLatLng([latR, lngR]);
      } else {
        const mkRepartidor = L.marker([latR, lngR], { icon: ICONO_REPARTIDOR, zIndexOffset: 20 })
          .addTo(mapa)
          .bindPopup('<b>🚴 Repartidor</b><br/>Tu ubicación actual');
        marcadorRepartidorRef.current = mkRepartidor;
      }
    }

    // Trazar la ruta OSRM en 2 tramos diferenciados
    const calcularYDibujarRuta = async () => {
      if (!tieneDestino) return;
      setErrorRuta(false);

      // Limpiar polylines anteriores si existen
      if (polylineKioscoRef.current) {
        polylineKioscoRef.current.remove();
        polylineKioscoRef.current = null;
      }
      if (polylineDestinoRef.current) {
        polylineDestinoRef.current.remove();
        polylineDestinoRef.current = null;
      }

      // Obtener ruta del Kiosco al Destino del cliente (Tramo 2)
      const promesaDestino = obtenerRutaOSRM([[latK, lngK], [latD, lngD]]);

      // Obtener ruta del Repartidor al Kiosco (Tramo 1)
      const promesaKiosco = tieneRepartidor
        ? obtenerRutaOSRM([[latR, lngR], [latK, lngK]])
        : Promise.resolve(null);

      const [coordsDestino, coordsKiosco] = await Promise.all([promesaDestino, promesaKiosco]);

      if (!mapaRef.current) return; // El mapa puede haberse desmontado durante el await

      let distTotalMetros = 0;

      // Dibujar Tramo 1 (Repartidor -> Kiosco) en Naranja/Amber
      if (coordsKiosco && tieneRepartidor) {
        const polyKiosco = L.polyline(coordsKiosco, {
          color: '#f59e0b', // Amber
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(mapaRef.current);
        polylineKioscoRef.current = polyKiosco;

        // Sumar distancia
        for (let i = 1; i < coordsKiosco.length; i++) {
          distTotalMetros += mapaRef.current.distance(coordsKiosco[i - 1], coordsKiosco[i]);
        }
      }

      // Dibujar Tramo 2 (Kiosco -> Destino) en Violeta/Púrpura
      if (coordsDestino) {
        const polyDestino = L.polyline(coordsDestino, {
          color: '#6d28d9', // Violeta
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(mapaRef.current);
        polylineDestinoRef.current = polyDestino;

        // Sumar distancia
        for (let i = 1; i < coordsDestino.length; i++) {
          distTotalMetros += mapaRef.current.distance(coordsDestino[i - 1], coordsDestino[i]);
        }
      }

      // Si fallaron ambas llamadas OSRM, dibujar líneas rectas como fallback visual
      if (!coordsKiosco && !coordsDestino) {
        setErrorRuta(true);
        const puntos = [[latK, lngK]];
        if (tieneRepartidor) puntos.unshift([latR, lngR]);
        puntos.push([latD, lngD]);

        const lineaRecta = L.polyline(puntos, {
          color: '#9ca3af',
          weight: 3,
          opacity: 0.6,
          dashArray: '8, 8'
        }).addTo(mapaRef.current);
        polylineDestinoRef.current = lineaRecta;
        mapaRef.current.fitBounds(lineaRecta.getBounds(), { padding: [40, 40] });
      } else {
        // Ajustar límites del mapa con fitBounds combinando ambas rutas
        const bounds = [];
        if (polylineKioscoRef.current) bounds.push(polylineKioscoRef.current.getBounds());
        if (polylineDestinoRef.current) bounds.push(polylineDestinoRef.current.getBounds());

        if (bounds.length > 0) {
          const combinedBounds = bounds[0];
          if (bounds[1]) {
            combinedBounds.extend(bounds[1]);
          }
          mapaRef.current.fitBounds(combinedBounds, { padding: [40, 40] });
        }
        setDistanciaKm((distTotalMetros / 1000).toFixed(1));
      }
    };

    calcularYDibujarRuta();
  }, [latRepartidor, lngRepartidor, latDestino, lngDestino]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full" style={{ height: '300px' }}>
      {/* Contenedor del mapa Leaflet */}
      <div
        ref={contenedorRef}
        className="w-full h-full rounded-xl overflow-hidden"
        style={{ zIndex: 0 }}
      />

      {/* Panel de información superpuesto (parte superior derecha) */}
      <div className="absolute top-2 left-2 z-[400] flex flex-col gap-1.5 pointer-events-none">
        {/* Badge: estado del envío */}
        <div className={`
          text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md border pointer-events-none
          ${estadoEnvio === 'En Camino'
            ? 'bg-sky-600 text-white border-sky-700'
            : 'bg-zinc-700 text-white border-zinc-800'}
        `}>
          🚴 {estadoEnvio}
        </div>

        {/* Badge: distancia calculada */}
        {distanciaKm && (
          <div className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/90 text-violet-700 border border-violet-200 shadow-sm">
            📏 ~{distanciaKm} km
          </div>
        )}

        {/* Aviso de ruta en línea recta si OSRM falló */}
        {errorRuta && (
          <div className="text-[10px] font-medium px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            ⚠️ Ruta aproximada
          </div>
        )}
      </div>

      {/* Leyenda de marcadores (esquina inferior izquierda) */}
      <div className="absolute bottom-2 right-2 z-[400] bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-zinc-200 p-2.5 space-y-1.5 pointer-events-none text-[9px] text-zinc-700">
        <div className="font-extrabold text-[8px] text-zinc-400 uppercase tracking-wider mb-1">Leyenda de Ruta</div>
        
        {/* Marcadores */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 flex-shrink-0 shadow-sm" />
          <span>Kiosco (Origen)</span>
        </div>
        {tieneRepartidor && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 shadow-sm" />
            <span>Repartidor (Tú)</span>
          </div>
        )}
        {tieneDestino && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 flex-shrink-0 shadow-sm" />
            <span>Cliente (Destino)</span>
          </div>
        )}
        
        {/* Líneas de Ruta */}
        <hr className="border-zinc-200 my-1" />
        {tieneRepartidor && (
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-4 h-1 rounded bg-[#f59e0b] inline-block" />
            <span>Tramo 1: Recogida</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-4 h-1 rounded bg-[#6d28d9] inline-block" />
          <span>Tramo 2: Entrega</span>
        </div>
      </div>
    </div>
  );
};

export default MapaSeguimiento;
