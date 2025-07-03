/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            colors: {
                // Palette personalizzata migliorata
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554'
                },
                secondary: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617'
                },
                success: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d',
                    950: '#052e16'
                },
                warning: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f',
                    950: '#451a03'
                },
                danger: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                    950: '#450a0a'
                },
                // Nuovi colori per gradients
                gradient: {
                    from: {
                        blue: '#667eea',
                        purple: '#764ba2',
                        green: '#f093fb',
                        pink: '#f5576c',
                        cyan: '#4facfe',
                        teal: '#00f2fe'
                    },
                    to: {
                        blue: '#764ba2',
                        purple: '#667eea',
                        green: '#f5576c',
                        pink: '#f093fb',
                        cyan: '#00f2fe',
                        teal: '#4facfe'
                    }
                }
            },
            fontFamily: {
                sans: [
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'Roboto',
                    '"Helvetica Neue"',
                    'Arial',
                    'sans-serif',
                    '"Apple Color Emoji"',
                    '"Segoe UI Emoji"',
                    '"Segoe UI Symbol"'
                ],
                mono: [
                    'ui-monospace',
                    'SFMono-Regular',
                    '"SF Mono"',
                    'Consolas',
                    '"Liberation Mono"',
                    'Menlo',
                    'monospace'
                ]
            },
            fontSize: {
                '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['1rem', { lineHeight: '1.5rem' }],
                'lg': ['1.125rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
                '5xl': ['3rem', { lineHeight: '1' }],
                '6xl': ['3.75rem', { lineHeight: '1' }],
                '7xl': ['4.5rem', { lineHeight: '1' }],
                '8xl': ['6rem', { lineHeight: '1' }],
                '9xl': ['8rem', { lineHeight: '1' }],
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '92': '23rem',
                '96': '24rem',
                '128': '32rem',
                '144': '36rem'
            },
            maxWidth: {
                '8xl': '88rem',
                '9xl': '96rem'
            },
            minHeight: {
                '12': '3rem',
                '16': '4rem',
                '20': '5rem',
                '24': '6rem',
                'screen-sm': '640px',
                'screen-md': '768px',
                'screen-lg': '1024px',
                'screen-xl': '1280px'
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '3rem'
            },
            boxShadow: {
                'soft': '0 2px 15px 0 rgba(0, 0, 0, 0.08)',
                'medium': '0 4px 25px 0 rgba(0, 0, 0, 0.1)',
                'strong': '0 10px 40px 0 rgba(0, 0, 0, 0.15)',
                'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
                'colored': '0 10px 40px 0 rgba(59, 130, 246, 0.15)',
                'colored-lg': '0 20px 60px 0 rgba(59, 130, 246, 0.2)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'fade-out': 'fadeOut 0.3s ease-in-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'slide-in-left': 'slideInLeft 0.3s ease-out',
                'slide-in-up': 'slideInUp 0.3s ease-out',
                'slide-in-down': 'slideInDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'scale-out': 'scaleOut 0.2s ease-in',
                'bounce-soft': 'bounceSoft 0.6s ease-out',
                'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'pulse-notification': 'pulse-notification 2s infinite',
                'pulse-online': 'pulse-online 2s infinite',
                'spin-slow': 'spin 3s linear infinite',
                'wiggle': 'wiggle 1s ease-in-out infinite',
                'skeleton': 'skeleton-loading 1.5s ease-in-out infinite'
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                fadeOut: {
                    '0%': { opacity: '1' },
                    '100%': { opacity: '0' }
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' }
                },
                slideInLeft: {
                    '0%': { transform: 'translateX(-100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' }
                },
                slideInUp: {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                slideInDown: {
                    '0%': { transform: 'translateY(-100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.9)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' }
                },
                scaleOut: {
                    '0%': { transform: 'scale(1)', opacity: '1' },
                    '100%': { transform: 'scale(0.9)', opacity: '0' }
                },
                bounceSoft: {
                    '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
                    '40%, 43%': { transform: 'translate3d(0, -15px, 0)' },
                    '70%': { transform: 'translate3d(0, -7px, 0)' },
                    '90%': { transform: 'translate3d(0, -2px, 0)' }
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' }
                },
                'pulse-notification': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '1' },
                    '50%': { transform: 'scale(1.1)', opacity: '0.8' }
                },
                'pulse-online': {
                    '0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
                    '70%': { boxShadow: '0 0 0 10px rgba(16, 185, 129, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' }
                },
                wiggle: {
                    '0%, 100%': { transform: 'rotate(-3deg)' },
                    '50%': { transform: 'rotate(3deg)' }
                },
                'skeleton-loading': {
                    '0%': { opacity: '1' },
                    '50%': { opacity: '0.4' },
                    '100%': { opacity: '1' }
                }
            },
            backdropBlur: {
                xs: '2px'
            },
            transitionProperty: {
                'height': 'height',
                'spacing': 'margin, padding',
                'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
                'all': 'all'
            },
            transitionDuration: {
                '250': '250ms',
                '350': '350ms',
                '400': '400ms'
            },
            scale: {
                '102': '1.02',
                '103': '1.03',
                '105': '1.05'
            },
            zIndex: {
                '60': '60',
                '70': '70',
                '80': '80',
                '90': '90',
                '100': '100'
            },
            gridTemplateColumns: {
                'auto-fit': 'repeat(auto-fit, minmax(250px, 1fr))',
                'auto-fill': 'repeat(auto-fill, minmax(200px, 1fr))'
            },
            aspectRatio: {
                '4/3': '4 / 3',
                '3/2': '3 / 2',
                '2/3': '2 / 3',
                '9/16': '9 / 16'
            }
        }
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class'
        }),
        require('@tailwindcss/typography'),
        require('@tailwindcss/aspect-ratio'),
        require('@tailwindcss/line-clamp'),

        // Plugin personalizzato per utilità aggiuntive
        function({ addUtilities, addComponents, theme }) {
            const newUtilities = {
                // Utility per scrollbar personalizzata
                '.scrollbar-thin': {
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${theme('colors.gray.400')} ${theme('colors.gray.200')}`
                },
                '.scrollbar-webkit': {
                    '&::-webkit-scrollbar': {
                        width: '8px'
                    },
                    '&::-webkit-scrollbar-track': {
                        background: theme('colors.gray.100')
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: theme('colors.gray.400'),
                        borderRadius: '20px',
                        border: `1px solid ${theme('colors.gray.200')}`
                    }
                },

                // Utility per glassmorphism
                '.glass': {
                    background: 'rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255, 255, 255, 0.18)'
                },
                '.glass-dark': {
                    background: 'rgba(0, 0, 0, 0.25)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255, 255, 255, 0.18)'
                },

                // Utility per gradiente di testo
                '.text-gradient': {
                    background: `linear-gradient(135deg, ${theme('colors.blue.600')}, ${theme('colors.purple.600')})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                },
                '.text-gradient-blue': {
                    background: `linear-gradient(135deg, ${theme('colors.blue.500')}, ${theme('colors.blue.700')})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                },
                '.text-gradient-green': {
                    background: `linear-gradient(135deg, ${theme('colors.green.500')}, ${theme('colors.green.700')})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                },

                // Utility per link con animazione
                '.link-animated': {
                    position: 'relative',
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        width: '0',
                        height: '2px',
                        bottom: '-2px',
                        left: '0',
                        backgroundColor: theme('colors.primary.600'),
                        transition: 'width 0.3s ease-in-out'
                    },
                    '&:hover::after': {
                        width: '100%'
                    }
                },

                // Utility per safe area (per mobile PWA)
                '.safe-top': {
                    paddingTop: 'env(safe-area-inset-top)'
                },
                '.safe-bottom': {
                    paddingBottom: 'env(safe-area-inset-bottom)'
                },
                '.safe-left': {
                    paddingLeft: 'env(safe-area-inset-left)'
                },
                '.safe-right': {
                    paddingRight: 'env(safe-area-inset-right)'
                },

                // Utility per hover effects
                '.hover-lift': {
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
                    }
                },
                '.hover-glow': {
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        boxShadow: `0 0 20px ${theme('colors.blue.400')}40`
                    }
                },

                // Backgrounds gradients
                '.bg-gradient-blue': {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                },
                '.bg-gradient-green': {
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                },
                '.bg-gradient-purple': {
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                },
                '.bg-gradient-orange': {
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                },

                // Responsive utilities
                '.container-fluid': {
                    width: '100%',
                    paddingLeft: theme('spacing.4'),
                    paddingRight: theme('spacing.4'),
                    marginLeft: 'auto',
                    marginRight: 'auto'
                }
            }

            const newComponents = {
                // Componente per card con elevazione migliorata
                '.card': {
                    backgroundColor: theme('colors.white'),
                    borderRadius: theme('borderRadius.xl'),
                    boxShadow: theme('boxShadow.soft'),
                    padding: theme('spacing.6'),
                    border: `1px solid ${theme('colors.gray.200')}`
                },
                '.card-hover': {
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        boxShadow: theme('boxShadow.medium'),
                        transform: 'translateY(-2px)'
                    }
                },
                '.card-interactive': {
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        boxShadow: theme('boxShadow.strong'),
                        transform: 'translateY(-4px)',
                        borderColor: theme('colors.blue.300')
                    }
                },

                // Componenti per pulsanti migliorati
                '.btn': {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: theme('borderRadius.lg'),
                    fontWeight: theme('fontWeight.medium'),
                    fontSize: theme('fontSize.sm'),
                    padding: `${theme('spacing.3')} ${theme('spacing.6')}`,
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    border: 'none',
                    textDecoration: 'none',
                    '&:focus': {
                        outline: 'none',
                        boxShadow: `0 0 0 3px ${theme('colors.primary.200')}`
                    },
                    '&:disabled': {
                        opacity: '0.5',
                        cursor: 'not-allowed'
                    }
                },
                '.btn-primary': {
                    backgroundColor: theme('colors.primary.600'),
                    color: theme('colors.white'),
                    boxShadow: theme('boxShadow.sm'),
                    '&:hover:not(:disabled)': {
                        backgroundColor: theme('colors.primary.700'),
                        boxShadow: theme('boxShadow.md')
                    }
                },
                '.btn-secondary': {
                    backgroundColor: theme('colors.gray.100'),
                    color: theme('colors.gray.900'),
                    border: `1px solid ${theme('colors.gray.300')}`,
                    '&:hover:not(:disabled)': {
                        backgroundColor: theme('colors.gray.200'),
                        borderColor: theme('colors.gray.400')
                    }
                },
                '.btn-success': {
                    backgroundColor: theme('colors.success.600'),
                    color: theme('colors.white'),
                    '&:hover:not(:disabled)': {
                        backgroundColor: theme('colors.success.700')
                    }
                },
                '.btn-danger': {
                    backgroundColor: theme('colors.danger.600'),
                    color: theme('colors.white'),
                    '&:hover:not(:disabled)': {
                        backgroundColor: theme('colors.danger.700')
                    }
                },

                // Form components migliorati
                '.form-input': {
                    appearance: 'none',
                    backgroundColor: theme('colors.white'),
                    borderColor: theme('colors.gray.300'),
                    borderWidth: '1px',
                    borderRadius: theme('borderRadius.lg'),
                    paddingLeft: theme('spacing.4'),
                    paddingRight: theme('spacing.4'),
                    paddingTop: theme('spacing.3'),
                    paddingBottom: theme('spacing.3'),
                    fontSize: theme('fontSize.sm'),
                    lineHeight: theme('lineHeight.5'),
                    transition: 'all 0.2s ease',
                    '&:focus': {
                        outline: 'none',
                        borderColor: theme('colors.primary.500'),
                        boxShadow: `0 0 0 3px ${theme('colors.primary.200')}`,
                        backgroundColor: theme('colors.primary.50')
                    },
                    '&:hover': {
                        borderColor: theme('colors.gray.400')
                    }
                },

                // Badge components
                '.badge': {
                    display: 'inline-flex',
                    alignItems: 'center',
                    paddingLeft: theme('spacing.3'),
                    paddingRight: theme('spacing.3'),
                    paddingTop: theme('spacing.1'),
                    paddingBottom: theme('spacing.1'),
                    fontSize: theme('fontSize.xs'),
                    fontWeight: theme('fontWeight.medium'),
                    borderRadius: theme('borderRadius.full'),
                    border: '1px solid transparent'
                },
                '.badge-primary': {
                    backgroundColor: theme('colors.primary.100'),
                    color: theme('colors.primary.800'),
                    borderColor: theme('colors.primary.200')
                },
                '.badge-success': {
                    backgroundColor: theme('colors.success.100'),
                    color: theme('colors.success.800'),
                    borderColor: theme('colors.success.200')
                },
                '.badge-warning': {
                    backgroundColor: theme('colors.warning.100'),
                    color: theme('colors.warning.800'),
                    borderColor: theme('colors.warning.200')
                },
                '.badge-danger': {
                    backgroundColor: theme('colors.danger.100'),
                    color: theme('colors.danger.800'),
                    borderColor: theme('colors.danger.200')
                },

                // Navigation components
                '.nav-link': {
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: theme('spacing.3'),
                    paddingRight: theme('spacing.3'),
                    paddingTop: theme('spacing.2'),
                    paddingBottom: theme('spacing.2'),
                    fontSize: theme('fontSize.sm'),
                    fontWeight: theme('fontWeight.medium'),
                    borderRadius: theme('borderRadius.lg'),
                    transition: 'all 0.2s ease',
                    textDecoration: 'none'
                },
                '.nav-link-active': {
                    backgroundColor: theme('colors.primary.100'),
                    color: theme('colors.primary.700'),
                    boxShadow: theme('boxShadow.sm')
                },
                '.nav-link-inactive': {
                    color: theme('colors.gray.600'),
                    '&:hover': {
                        backgroundColor: theme('colors.gray.100'),
                        color: theme('colors.gray.900')
                    }
                }
            }

            addUtilities(newUtilities)
            addComponents(newComponents)
        }
    ],
    darkMode: 'class',
    future: {
        hoverOnlyWhenSupported: true,
    }
}
