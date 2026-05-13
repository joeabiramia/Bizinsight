/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // prefix prevents collisions with existing newstyles.css classes
  prefix: "tw-",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        surface: {
          DEFAULT: "#0f172a",
          1: "#131c2e",
          2: "#1a2540",
          3: "#1e293b",
          4: "#243044",
          card: "#16213a",
        },
        critical: { DEFAULT: "#ef4444", muted: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)" },
        warning:  { DEFAULT: "#f97316", muted: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)" },
        caution:  { DEFAULT: "#eab308", muted: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.35)"  },
        info:     { DEFAULT: "#3b82f6", muted: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)" },
        success:  { DEFAULT: "#22c55e", muted: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)"  },
      },
      boxShadow: {
        "glow":        "0 0 20px 2px rgba(99,102,241,0.3)",
        "glow-red":    "0 0 16px 1px rgba(239,68,68,0.25)",
        "glow-amber":  "0 0 16px 1px rgba(249,115,22,0.25)",
        "glow-green":  "0 0 16px 1px rgba(34,197,94,0.25)",
        "card":        "0 1px 3px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3)",
        "card-hover":  "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.3)",
      },
      backgroundImage: {
        "gradient-brand":    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        "gradient-critical": "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        "gradient-warning":  "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        "gradient-success":  "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        "gradient-card":     "linear-gradient(145deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)",
        "gradient-glass":    "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out both",
        "slide-up":   "slideUp 0.4s ease-out both",
        "slide-in-r": "slideInRight 0.35s ease-out both",
        "scale-in":   "scaleIn 0.25s ease-out both",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
        "shimmer":    "shimmer 1.6s ease-in-out infinite",
        "spin-slow":  "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn:      { from: { opacity: "0" },                              to: { opacity: "1" } },
        slideUp:     { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideInRight:{ from: { opacity: "0", transform: "translateX(20px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        scaleIn:     { from: { opacity: "0", transform: "scale(0.95)" },    to: { opacity: "1", transform: "scale(1)" } },
        pulseGlow:   {
          "0%, 100%": { boxShadow: "0 0 8px 0 rgba(99,102,241,0.15)" },
          "50%":      { boxShadow: "0 0 28px 4px rgba(99,102,241,0.4)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
};
