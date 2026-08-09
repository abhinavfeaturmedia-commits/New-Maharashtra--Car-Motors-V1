/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0F172A',
                'primary-light': '#1E293B',
                accent: '#FACC15',
                'accent-hover': '#EAB308',
                'background-light': '#F8FAFC',
                border: '#E2E8F0',
            },
            screens: {
                'xs': '420px',
            },
        },
    },
    plugins: [],
}
