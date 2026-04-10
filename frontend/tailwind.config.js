/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#0D1B2A',
        navy2:   '#1B2A3B',
        dark:    '#0F1923',
        section: '#162232',
        header:  '#1E3A5F',
        accent:  '#0EA5E9',
        input:   '#1155CC',
        link:    '#0B8043',
        pos:     '#137333',
        neg:     '#C0392B',
      },
    },
  },
  plugins: [],
};
