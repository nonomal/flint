/**
 * UI/UX Constants for consistent design across Flint
 * Ensures bulletproof static site experience
 */

// Animation and transition constants
export const TRANSITIONS = {
  fast: 'transition-all duration-150 ease-out',
  normal: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
  hover: 'hover:scale-[1.02] active:scale-[0.98]',
  fadeIn: 'animate-in fade-in duration-200',
  slideUp: 'animate-in slide-in-from-bottom-4 duration-300',
} as const

// Consistent spacing
export const SPACING = {
  page: 'p-6 sm:p-8 lg:p-10',
  section: 'space-y-6',
  card: 'p-6',
  cardCompact: 'p-4',
  grid: 'gap-6',
  gridCompact: 'gap-4',
} as const

// Color scheme for consistent theming
export const COLORS = {
  status: {
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  vm: {
    running: 'text-green-600',
    stopped: 'text-red-600',
    paused: 'text-yellow-600',
    unknown: 'text-gray-600',
  },
  metrics: {
    cpu: 'bg-blue-500',
    memory: 'bg-green-500',
    storage: 'bg-purple-500',
    network: 'bg-orange-500',
  }
} as const

// Typography scale
export const TYPOGRAPHY = {
  pageTitle: 'text-3xl font-bold tracking-tight',
  sectionTitle: 'text-2xl font-bold tracking-tight',
  cardTitle: 'text-lg font-semibold',
  label: 'text-sm font-medium',
  body: 'text-sm',
  caption: 'text-xs text-muted-foreground',
} as const

// Component sizes
export const SIZES = {
  button: {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-8 text-base',
  },
  input: {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-11 text-base',
  },
  card: {
    sm: 'min-h-[120px]',
    md: 'min-h-[160px]',
    lg: 'min-h-[200px]',
  }
} as const

// Consistent shadows and borders
export const EFFECTS = {
  shadow: {
    sm: 'shadow-sm hover:shadow-md',
    md: 'shadow-md hover:shadow-lg',
    lg: 'shadow-lg hover:shadow-xl',
  },
  border: {
    light: 'border border-border/50',
    normal: 'border border-border',
    heavy: 'border-2 border-border',
  },
  rounded: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
  }
} as const

// Loading states
export const LOADING = {
  spinner: 'animate-spin',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
  skeleton: 'bg-muted animate-pulse rounded',
} as const

// Responsive breakpoints (for consistent responsive design)
export const BREAKPOINTS = {
  sm: 'sm:',
  md: 'md:',
  lg: 'lg:',
  xl: 'xl:',
  '2xl': '2xl:',
} as const

// Grid layouts
export const GRIDS = {
  auto: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  autoLarge: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  twoCol: 'grid grid-cols-1 lg:grid-cols-2',
  threeCol: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  fourCol: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
} as const