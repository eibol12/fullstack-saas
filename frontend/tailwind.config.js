/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Blueprint & Steel brand palette
        blueprint: {
          50: '#f4f7f9',
          100: '#e6edf3',
          200: '#cbd9e4',
          300: '#9eb6c8',
          400: '#6d8da7',
          500: '#4a6e8a',
          600: '#365771',
          700: '#2a455c',
          800: '#1f3447',
          900: '#142231',
          950: '#0a1521',
        },
        steel: {
          50: '#f5f7fa',
          100: '#e8edf2',
          200: '#cdd7e0',
          300: '#a7b6c4',
          400: '#7a8da0',
          500: '#586d82',
          600: '#465769',
          700: '#384554',
          800: '#2a3543',
          900: '#1d2530',
        },
        amber_safety: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        cyan_data: {
          DEFAULT: '#22d3ee',
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
      backgroundImage: {
        // Faint drafting-board dot grid (light mode)
        'dot-grid':
          'radial-gradient(circle, rgba(20, 34, 49, 0.08) 1px, transparent 1px)',
        // Dot grid for dark mode
        'dot-grid-dark':
          'radial-gradient(circle, rgba(148, 163, 184, 0.10) 1px, transparent 1px)',
        // Millimeter-paper grid
        'mm-grid':
          'linear-gradient(rgba(20, 34, 49, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(20, 34, 49, 0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '20px 20px',
        'mm-grid': '20px 20px',
      },
      boxShadow: {
        'inset-soft': 'inset 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'glow-cyan': '0 0 0 1px rgba(34, 211, 238, 0.30), 0 0 12px rgba(34, 211, 238, 0.25)',
        'glow-amber': '0 0 0 1px rgba(245, 158, 11, 0.35), 0 0 12px rgba(245, 158, 11, 0.25)',
        'paper': '0 10px 30px -10px rgba(15, 23, 42, 0.30), 0 4px 12px -4px rgba(15, 23, 42, 0.20)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)"}
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)"},
          to: { height: 0 }
        },
        "pulse-dot": {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.6, transform: 'scale(0.92)' },
        },
        "shimmer": {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        "shimmer": "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
}

