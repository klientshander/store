import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type VelocitySubscriber = (velocity: number, direction: 1 | -1 | 0) => void

type SmoothScrollContextValue = {
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; immediate?: boolean }) => void
  setPaused: (paused: boolean) => void
  subscribeVelocity: (fn: VelocitySubscriber) => () => void
  progressBarRef: RefObject<HTMLDivElement | null>
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  scrollTo: (target) => {
    if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' })
    else if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
    else target.scrollIntoView({ behavior: 'smooth' })
  },
  setPaused: () => {},
  subscribeVelocity: () => () => {},
  progressBarRef: { current: null },
})

export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const subscribersRef = useRef<Set<VelocitySubscriber>>(new Set())
  const location = useLocation()

  useEffect(() => {
    if (prefersReducedMotion()) return

    const lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
      allowNestedScroll: true,
      respectReducedMotion: true,
    })

    lenisRef.current = lenis

    const unsubscribeScroll = lenis.on('scroll', (instance) => {
      ScrollTrigger.update()
      if (progressBarRef.current) {
        const clamped = Math.max(0, Math.min(1, instance.progress || 0))
        progressBarRef.current.style.transform = `scaleX(${clamped})`
      }
      subscribersRef.current.forEach((fn) => fn(instance.velocity, instance.direction))
    })

    const tick = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      unsubscribeScroll()
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true, force: true })
    } else {
      window.scrollTo(0, 0)
    }
    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 120)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, options?: { offset?: number; immediate?: boolean }) => {
      const lenis = lenisRef.current
      if (lenis) {
        lenis.scrollTo(target, {
          offset: options?.offset ?? -68,
          immediate: options?.immediate ?? false,
          duration: 1.2,
        })
        return
      }
      if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: options?.immediate ? 'auto' : 'smooth' })
      } else if (typeof target === 'string') {
        document.querySelector(target)?.scrollIntoView({ behavior: options?.immediate ? 'auto' : 'smooth' })
      } else {
        target.scrollIntoView({ behavior: options?.immediate ? 'auto' : 'smooth' })
      }
    },
    [],
  )

  const setPaused = useCallback((paused: boolean) => {
    const lenis = lenisRef.current
    if (!lenis) return
    if (paused) lenis.stop()
    else lenis.start()
  }, [])

  const subscribeVelocity = useCallback((fn: VelocitySubscriber) => {
    subscribersRef.current.add(fn)
    return () => {
      subscribersRef.current.delete(fn)
    }
  }, [])

  const value = useMemo(
    () => ({ scrollTo, setPaused, subscribeVelocity, progressBarRef }),
    [scrollTo, setPaused, subscribeVelocity],
  )

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>
}

/**
 * Tactile magnetic cursor pull for primary CTAs & interactive pills (mouse pointers only).
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.26) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' })

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const rect = el.getBoundingClientRect()
      const dx = e.clientX - (rect.left + rect.width / 2)
      const dy = e.clientY - (rect.top + rect.height / 2)
      xTo(dx * strength)
      yTo(dy * strength)
    }

    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.42)' })
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [strength])

  return ref
}

/**
 * Subtle 3D studio card tilt on mouse hover (ignored on touch devices).
 */
export function useTilt3D<T extends HTMLElement>(maxDeg = 4.5) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    gsap.set(el, { transformPerspective: 1100, transformStyle: 'preserve-3d' })
    const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.55, ease: 'power3.out' })
    const ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.55, ease: 'power3.out' })

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const rect = el.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      rxTo(-ny * maxDeg * 2)
      ryTo(nx * maxDeg * 2)
    }

    const onLeave = () => {
      rxTo(0)
      ryTo(0)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [maxDeg])

  return ref
}

/**
 * Kinetic infinite marquee band synced with Lenis scroll velocity & direction.
 */
export function KineticMarquee({ items }: { items: string[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const { subscribeVelocity } = useSmoothScroll()

  useEffect(() => {
    const track = trackRef.current
    if (!track || prefersReducedMotion()) return

    let direction = 1
    const tween = gsap.to(track, {
      xPercent: -50,
      duration: 28,
      ease: 'none',
      repeat: -1,
      modifiers: {
        xPercent: gsap.utils.wrap(-50, 0),
      },
    })

    const unsub = subscribeVelocity((velocity, dir) => {
      if (dir !== 0) direction = dir
      const boost = Math.min(Math.abs(velocity) * 0.22, 3.8)
      gsap.to(tween, {
        timeScale: direction * (1 + boost),
        duration: 0.35,
        overwrite: true,
        onComplete: () => {
          gsap.to(tween, { timeScale: direction, duration: 0.8, ease: 'power2.out' })
        },
      })
    })

    return () => {
      unsub()
      tween.kill()
    }
  }, [subscribeVelocity])

  const repeated = [...items, ...items]

  return (
    <div className="kinetic-marquee" aria-hidden="true">
      <div className="kinetic-marquee-track" ref={trackRef}>
        {[0, 1].map((copy) => (
          <div className="kinetic-marquee-group" key={copy}>
            {repeated.map((label, idx) => (
              <span className="kinetic-marquee-item" key={`${copy}-${idx}`}>
                <b>{label}</b>
                <i className="marquee-gem" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
