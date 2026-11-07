import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'

type Props = {
  color?: string
  containerRef?: RefObject<HTMLElement | null> | null
  thickness?: number
  opacity?: number
  smoothing?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  gap?: number
  fade?: number
  showCoordinates?: boolean
  targetEffect?: 'lock' | 'none'
  clickPulse?: boolean
  hideCursor?: boolean
  blendMode?: 'normal' | 'difference'
  className?: string
  style?: CSSProperties
}

export default function Crosshair({ color = '#ffffff', containerRef, thickness = 1, opacity = .85, smoothing = .35, lineStyle = 'solid', gap = 0, fade = 0, showCoordinates = true, targetEffect = 'lock', clickPulse = true, hideCursor = false, blendMode = 'normal', className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = containerRef?.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !host) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0; let x = 0; let y = 0; let targetX = 0; let targetY = 0; let visible = false
    let target: Element | null = null; let pulse = 0
    const resize = () => { const rect = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    const draw = () => {
      const rect = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, rect.width, rect.height)
      if (!visible) return
      const follow = reduce ? 1 : Math.max(.08, 1 - smoothing * .7); x += (targetX - x) * follow; y += (targetY - y) * follow
      ctx.globalAlpha = opacity; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = thickness; ctx.setLineDash(lineStyle === 'dashed' ? [6, 5] : lineStyle === 'dotted' ? [1, 4] : [])
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(x - 7 - gap, y); ctx.moveTo(x + 7 + gap, y); ctx.lineTo(rect.width, y); ctx.moveTo(x, 0); ctx.lineTo(x, y - 7 - gap); ctx.moveTo(x, y + 7 + gap); ctx.lineTo(x, rect.height); ctx.stroke()
      if (targetEffect === 'lock' && target) { const box = target.getBoundingClientRect(); const root = host.getBoundingClientRect(); const bx = box.left - root.left - 5; const by = box.top - root.top - 5; const bw = box.width + 10; const bh = box.height + 10; const arm = 10; ctx.beginPath(); ctx.moveTo(bx, by + arm); ctx.lineTo(bx, by); ctx.lineTo(bx + arm, by); ctx.moveTo(bx + bw - arm, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + arm); ctx.moveTo(bx + bw, by + bh - arm); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw - arm, by + bh); ctx.moveTo(bx + arm, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx, by + bh - arm); ctx.stroke() }
      if (showCoordinates && !target) { ctx.globalAlpha = opacity * .75; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`${Math.round(x)}, ${Math.round(y)}`, Math.min(x + 12, rect.width - 52), Math.max(y - 10, 12)) }
      if (pulse > 0) { pulse -= .045; ctx.globalAlpha = Math.max(0, pulse) * opacity; ctx.beginPath(); ctx.arc(x, y, (1 - pulse) * 32, 0, Math.PI * 2); ctx.stroke() }
      if (visible || pulse > 0) frame = requestAnimationFrame(draw)
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw() }) }
    const move = (event: PointerEvent) => { const rect = host.getBoundingClientRect(); targetX = event.clientX - rect.left; targetY = event.clientY - rect.top; if (!visible) { x = targetX; y = targetY }; visible = true; target = event.target instanceof Element ? event.target.closest('a,button,[data-crosshair-target]') : null; wake() }
    const leave = () => { visible = false; target = null; host.classList.remove('crosshair-hidden') }
    const click = () => { if (clickPulse && !reduce) { pulse = 1; wake() } }
    const enter = () => { if (hideCursor) host.classList.add('crosshair-hidden') }
    const observer = new ResizeObserver(resize); observer.observe(host); resize(); host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave); host.addEventListener('pointerenter', enter); host.addEventListener('pointerdown', click)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave); host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerdown', click); host.classList.remove('crosshair-hidden') }
  }, [color, containerRef, thickness, opacity, smoothing, lineStyle, gap, fade, showCoordinates, targetEffect, clickPulse, hideCursor])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, mixBlendMode: blendMode, ...style }} />
}
