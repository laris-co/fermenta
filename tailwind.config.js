/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The continuum. Procedurally banded charcoal, never flat black.
        ash: { 900: "#0b0c0e", 800: "#121418", 700: "#181b20", 600: "#1f232a", 500: "#2a2f38" },
        bone: { DEFAULT: "#e6e3dc", dim: "#9a978f", faint: "#5d5b56" },
        // Colour survives ONLY as emission hairlines, at real spectral wavelengths.
        em: {
          405: "#8b5cf6", // violet   — pH
          436: "#4f7dff", // blue     — target band edge
          486: "#22d3ee", // cyan     — gravity
          546: "#4ade80", // green    — temperature, the dense trace
          589: "#fbbf24", // sodium   — the doubled line: what outranks its neighbours
          615: "#fb7185", // orange   — warning
          656: "#ef4444", // red      — excursion
        },
      },
      fontFamily: {
        // One grotesque, one size, ranked by tracking and ink.
        grot: ["'Roboto Condensed'", "'Helvetica Neue'", "Arial", "sans-serif"],
        num: ["'Roboto Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: { rail: "0.18em", plate: "0.08em" },
    },
  },
  plugins: [],
};
