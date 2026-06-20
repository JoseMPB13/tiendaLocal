/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta premium de alto contraste para visibilidad óptima
        premium: {
          dark: "#1A365D",    // Azul marino oscuro para cabeceras y Sidebar
          primary: "#2B6CB0", // Azul principal
          light: "#EDF2F7",   // Fondo gris muy claro para Light Mode
          success: "#2F855A", // Verde para transacciones exitosas
          warning: "#C05621", // Naranja para advertencias de crédito/stock
          danger: "#9B2C2C",  // Rojo para mermas o anulaciones
        }
      }
    },
  },
  plugins: [],
}
