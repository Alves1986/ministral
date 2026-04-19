/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        ministral: {
          50: '#F8FAFC',
          100: '#E5E7EB',
          500: '#1E3A5F', // Primary Blue
          600: '#2A4E7A', // Secondary Blue
          gold: '#D6B25E', // Accent Gold
          dark: '#0F172A', // Background Dark
          text: '#0B1220', // Text Primary
          muted: '#6B7280', // Text Secondary
        },
        accent: '#D6B25E',
        primary: '#1E3A5F',
        secondary: '#14B8A6',
        secondaryHover: '#0D9488',
      },
      animation: {
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease-out',
        'shimmer': 'shimmer 2.5s infinite linear',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    }
  },
  plugins: [],
}
