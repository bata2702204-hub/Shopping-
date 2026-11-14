/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Heebo', 'Assistant', 'system-ui', 'sans-serif'] },
      keyframes: {
        'slide-in': { '0%': { opacity: 0, transform: 'translateY(-8px) scale(.98)' }, '100%': { opacity: 1, transform: 'none' } },
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.6)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        'toast-in': { '0%': { opacity: 0, transform: 'translate(-50%, 16px)' }, '100%': { opacity: 1, transform: 'translate(-50%, 0)' } },
      },
      animation: {
        'slide-in': 'slide-in .28s cubic-bezier(.2,.8,.2,1) both',
        'fade-up': 'fade-up .35s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .3s ease-out both',
        'toast-in': 'toast-in .25s ease-out both',
      },
    },
  },
  plugins: [],
};
