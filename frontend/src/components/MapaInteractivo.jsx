/**
 * Componente: MapaInteractivo.jsx
 * Propósito: Renderizar un mapa interactivo (Leaflet) para previsualizar y capturar
 * coordenadas geográficas de los clientes. Funciona de manera responsiva y 
 * autogestiona el marcador y eventos de clic y arrastre.
 * Idioma: Español
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para la ruta de imágenes de marcadores de Leaflet al empaquetar con Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export const MapaInteractivo = ({ lat, lng, onChange, soloLectura = false }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);

  // Ubicación inicial por defecto: Centro de Santa Cruz de la Sierra, Bolivia
  const defaultLat = -17.7833;
  const defaultLng = -63.1667;

  // Unificamos el ciclo de vida del mapa en un único efecto reactivo a lat, lng y soloLectura.
  // Este efecto escucha los cambios de latitud y longitud gatillados tras el evento onBlur
  // del extractor universal de coordenadas (soportando dominios como googleusercontent.com).
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Resolver coordenadas actuales válidas
    const tieneCoordenadasValidas = lat !== null && lat !== undefined && lng !== null && lng !== undefined;
    const latVal = tieneCoordenadasValidas ? parseFloat(lat) : defaultLat;
    const lngVal = tieneCoordenadasValidas ? parseFloat(lng) : defaultLng;

    // Si el mapa no ha sido inicializado aún, procedemos con su creación
    if (!mapInstanceRef.current) {
      // Inicializar instancia de Leaflet
      const map = L.map(mapContainerRef.current).setView([latVal, lngVal], 15);
      mapInstanceRef.current = map;

      // Capa de mosaicos libres de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      // Pintar y configurar el marcador
      const marker = L.marker([latVal, lngVal], { draggable: !soloLectura }).addTo(map);
      markerInstanceRef.current = marker;

      // Escuchar eventos en modo de edición/captura
      if (!soloLectura && onChange) {
        // Evento al arrastrar el marcador por el mapa
        marker.on('dragend', (e) => {
          const coords = e.target.getLatLng();
          onChange(coords.lat, coords.lng);
        });

        // Evento al hacer clic en cualquier punto libre del mapa
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          onChange(lat, lng);
        });
      }

      // Corrección de renderizado incompleto de Leaflet (problemas de tamaño de contenedor en modales React)
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
    } else {
      // Si el mapa ya existe, actualizamos su vista e indicador únicamente si cambiaron externamente
      const map = mapInstanceRef.current;
      const marker = markerInstanceRef.current;

      if (map && marker) {
        const actualLatLng = marker.getLatLng();
        
        // Usamos una tolerancia para evitar problemas con precisión decimal (punto flotante de JS)
        const diffLat = Math.abs(actualLatLng.lat - latVal);
        const diffLng = Math.abs(actualLatLng.lng - lngVal);

        if (diffLat > 0.00001 || diffLng > 0.00001) {
          marker.setLatLng([latVal, lngVal]);
          map.setView([latVal, lngVal], map.getZoom());
        }
      }
    }
  }, [lat, lng, soloLectura]); // eslint-disable-line react-hooks/exhaustive-deps

  // Efecto independiente para la limpieza atómica al desmontar el componente
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full rounded-xl border border-slate-200 shadow-inner"
      style={{ minHeight: '220px' }}
    />
  );
};

export default MapaInteractivo;
