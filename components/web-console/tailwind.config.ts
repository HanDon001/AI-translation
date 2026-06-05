import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        subtitle: ['"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      colors: {
        'subtitle-temp': '#9CA3AF',
        'subtitle-final': '#FFFFFF',
        'subtitle-bg': 'rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-dot': 'pulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
