/**
 * Componente: MapaInteractivo.jsx
 * Propósito: Renderizar un mapa interactivo (Leaflet) para previsualizar y capturar
 * coordenadas geográficas de los clientes. Funciona de manera responsiva y 
 * autogestiona el marcador y eventos de clic y arrastre.
 * Idioma: Español
 */

import React, { useEffect, useRef } from 'react';
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

  // Ubicación inicial por defecto: Centro de La Paz, Bolivia
  const defaultLat = -16.5000;
  const defaultLng = -68.1500;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const latVal = lat !== null && lat !== undefined ? parseFloat(lat) : defaultLat;
    const lngVal = lng !== null && lng !== undefined ? parseFloat(lng) : defaultLng;

    // Inicializar mapa
    const map = L.map(mapContainerRef.current).setView([latVal, lngVal], 15);
    mapInstanceRef.current = map;

    // Capa de mosaicos libres de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Pintar marcador
    const marker = L.marker([latVal, lngVal], { draggable: !soloLectura }).addTo(map);
    markerInstanceRef.current = marker;

    if (!soloLectura && onChange) {
      // Evento al terminar de arrastrar el marcador
      marker.on('dragend', (e) => {
        const coords = e.target.getLatLng();
        onChange(coords.lat, coords.lng);
      });

      // Evento al hacer clic en cualquier punto del mapa
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        onChange(lat, lng);
      });
    }

    // Limpieza al desmontar el componente para evitar duplicidad de contenedores Leaflet
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Escuchar actualizaciones externas de coordenadas (ej. al pegar enlace en input)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerInstanceRef.current;

    if (!map || !marker) return;

    const tieneCoordenadasValidas = lat !== null && lat !== undefined && lng !== null && lng !== undefined;
    const latVal = tieneCoordenadasValidas ? parseFloat(lat) : defaultLat;
    const lngVal = tieneCoordenadasValidas ? parseFloat(lng) : defaultLng;

    // Evitar bucles infinitos si la posición ya es la misma
    const actualLatLng = marker.getLatLng();
    if (actualLatLng.lat !== latVal || actualLatLng.lng !== lngVal) {
      marker.setLatLng([latVal, lngVal]);
      map.setView([latVal, lngVal], map.getZoom());
    }
  }, [lat, lng]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full rounded-xl border border-slate-200 shadow-inner"
      style={{ minHeight: '220px' }}
    />
  );
};

export default MapaInteractivo;
