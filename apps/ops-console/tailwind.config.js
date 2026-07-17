/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fifa: {
          green: '#00af66',
          gold: '#dfaa3b',
          blue: '#0033a0',
          dark: '#0b162c',
          light: '#f4f6fa',
        },
      },
    },
  },
  plugins: [],
};
