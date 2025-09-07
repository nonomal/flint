/**
 * Static-Safe React Hooks for Flint
 * Ensures reliable behavior in embedded static context
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Static-safe state hook that prevents hydration mismatches
 */
export function useStaticSafeState<T>(initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return [isClient ? value : initialValue, setValue, isClient] as const
}

/**
 * Static-safe local storage hook
 */
export function useStaticSafeLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          setValue(JSON.parse(stored))
        }
      } catch (error) {
        console.warn(`Failed to load ${key} from localStorage:`, error)
      }
    }
  }, [key])

  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const valueToStore = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(valueToStore))
        } catch (error) {
          console.warn(`Failed to save ${key} to localStorage:`, error)
        }
      }
      
      return valueToStore
    })
  }, [key])

  return [isClient ? value : defaultValue, setStoredValue, isClient] as const
}

/**
 * Static-safe interval hook
 */
export function useStaticSafeInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!isClient || delay === null) return

    const tick = () => savedCallback.current()
    const id = setInterval(tick, delay)
    return () => clearInterval(id)
  }, [delay, isClient])
}

/**
 * Static-safe media query hook
 */
export function useStaticSafeMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query)
      setMatches(mediaQuery.matches)

      const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [query])

  return [isClient ? matches : false, isClient] as const
}

/**
 * Static-safe window size hook
 */
export function useStaticSafeWindowSize() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }

      handleResize()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  return [isClient ? windowSize : { width: 1024, height: 768 }, isClient] as const
}