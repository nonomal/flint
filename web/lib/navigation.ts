/**
 * Static-safe navigation utilities for embedded Flint
 * Replaces Next.js router with reliable static site navigation
 */

export interface NavigationOptions {
  replace?: boolean
  preserveHash?: boolean
}

/**
 * Static-safe navigation function
 * Works reliably in embedded static sites
 */
export function navigateTo(path: string, options: NavigationOptions = {}) {
  if (typeof window === 'undefined') return

  const { replace = false, preserveHash = false } = options
  
  // Handle hash-based navigation for same-page routing
  if (path.startsWith('#')) {
    window.location.hash = path
    return
  }

  // Construct full URL for static site
  const currentHash = preserveHash ? window.location.hash : ''
  
  // For static sites, append .html if not root and doesn't already have extension
  let staticPath = path
  if (path !== '/' && !path.includes('.')) {
    // Split path and query/hash
    const [basePath, ...rest] = path.split(/[?#]/)
    const queryHash = rest.length > 0 ? path.substring(basePath.length) : ''
    
    // Add .html to base path only
    staticPath = basePath + '.html' + queryHash
  }
  
  const fullPath = staticPath + currentHash

  if (replace) {
    window.location.replace(fullPath)
  } else {
    window.location.href = fullPath
  }
}

/**
 * Get current route information
 */
export function getCurrentRoute() {
  if (typeof window === 'undefined') return { pathname: '/', search: '', hash: '' }
  
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash
  }
}

/**
 * Get URL parameters in static-safe way
 */
export function getUrlParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

/**
 * Update URL without navigation (for state management)
 */
export function updateUrl(path: string, replace = true) {
  if (typeof window === 'undefined') return
  
  if (replace) {
    window.history.replaceState(null, '', path)
  } else {
    window.history.pushState(null, '', path)
  }
}

/**
 * Refresh current page
 */
export function refreshPage() {
  if (typeof window === 'undefined') return
  window.location.reload()
}

/**
 * Go back in history
 */
export function goBack() {
  if (typeof window === 'undefined') return
  
  // Check if there's history to go back to
  if (window.history.length > 1) {
    window.history.back()
  } else {
    // Fallback to home page
    navigateTo('/')
  }
}

/**
 * Common navigation paths for Flint
 */
export const routes = {
  home: '/',
  vms: '/vms',
  vmDetail: (id: string) => `/vms/detail?id=${id}`,
  vmCreate: '/vms/create',
  vmConsole: (id: string) => `/vms/console?id=${id}`,
  images: '/images',
  imagesRepository: '/images#repository',
  storage: '/storage',
  networking: '/networking',
  analytics: '/analytics',
  settings: '/settings'
} as const