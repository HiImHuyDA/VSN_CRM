/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
      extend: {
          "colors": {
              "on-secondary-container": "#fffbff",
              "surface-container-lowest": "#ffffff",
              "inverse-surface": "#2f3031",
              "secondary-fixed": "#dce1ff",
              "on-surface-variant": "#414755",
              "on-secondary-fixed": "#00164f",
              "outline": "#727786",
              "on-primary-fixed": "#001a43",
              "tertiary-container": "#6f757e",
              "surface-container-high": "#e9e8e8",
              "surface": "#faf9f9",
              "on-error": "#ffffff",
              "on-background": "#1b1c1c",
              "secondary-fixed-dim": "#b6c4ff",
              "error-container": "#ffdad6",
              "outline-variant": "#c1c6d7",
              "secondary-container": "#466ce4",
              "inverse-on-surface": "#f2f0f0",
              "surface-tint": "#0059c7",
              "on-primary-fixed-variant": "#004398",
              "on-tertiary": "#ffffff",
              "surface-container-low": "#f4f3f3",
              "on-primary-container": "#fefcff",
              "on-error-container": "#93000a",
              "on-secondary-fixed-variant": "#003bb0",
              "background": "#faf9f9",
              "on-tertiary-container": "#fdfcff",
              "surface-bright": "#faf9f9",
              "tertiary-fixed-dim": "#c1c7d0",
              "on-secondary": "#ffffff",
              "primary-fixed-dim": "#afc6ff",
              "on-tertiary-fixed-variant": "#41474f",
              "surface-container-highest": "#e3e2e2",
              "surface-variant": "#e3e2e2",
              "on-surface": "#1b1c1c",
              "on-tertiary-fixed": "#161c23",
              "primary-container": "#006ef2",
              "primary": "#0057c2",
              "inverse-primary": "#afc6ff",
              "tertiary": "#575c65",
              "secondary": "#2752ca",
              "tertiary-fixed": "#dee3ed",
              "on-primary": "#ffffff",
              "surface-dim": "#dbdad9",
              "primary-fixed": "#d9e2ff",
              "error": "#ba1a1a",
              "surface-container": "#efeded"
          },
          "borderRadius": {
              "DEFAULT": "0.25rem",
              "lg": "0.5rem",
              "xl": "0.75rem",
              "full": "9999px"
          },
          "spacing": {
              "unit": "4px",
              "stack-md": "16px",
              "sidebar-width": "260px",
              "gutter": "24px",
              "container-padding-mobile": "16px",
              "stack-lg": "24px",
              "container-padding-desktop": "32px",
              "stack-sm": "8px"
          },
          "fontFamily": {
              "body-md": ["Inter", "sans-serif"],
              "body-lg": ["Inter", "sans-serif"],
              "headline-lg": ["Inter", "sans-serif"],
              "label-md": ["Inter", "sans-serif"],
              "label-sm": ["Inter", "sans-serif"],
              "body-sm": ["Inter", "sans-serif"],
              "headline-md": ["Inter", "sans-serif"],
              "headline-sm": ["Inter", "sans-serif"]
          }
      }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
