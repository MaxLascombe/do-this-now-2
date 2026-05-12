/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrainsMono_400Regular', 'Menlo', 'monospace'],
        'mono-bold': ['JetBrainsMono_700Bold', 'Menlo', 'monospace'],
        serif: ['InstrumentSerif_400Regular', 'Georgia', 'serif'],
        'serif-italic': ['InstrumentSerif_400Regular_Italic', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
