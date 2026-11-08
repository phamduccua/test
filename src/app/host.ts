import { Engine } from '../vendor/lab3d/engine/Engine'
import { createSimSession, type SimSession } from '../vendor/lab3d/sim/createContext'
import { useSim } from '../vendor/lab3d/sim/simStore'
import type { SimModule } from '../vendor/lab3d/sim/types'

/**
 * Thay khung SimHost (React) của kit: một Engine + một phiên SimContext cho module đang chạy.
 * Trình tự giống SimHost.tsx: prepareStage → createSimSession → await create(ctx) → attach → engine.setStage.
 */
export interface Host {
  engine: Engine
  readonly session: SimSession | null
  run(mod: SimModule): Promise<void>
  /** "Làm lại từ đầu": đặt lại đồng hồ + sim.reset(). */
  reset(): void
  /** Góc nhìn: 'home' = tư thế lúc vào, 'close' = lại gần tâm quay. */
  view(kind: 'home' | 'close'): void
  dispose(): void
}

export function createHost(root: HTMLElement): Host {
  root.classList.add('simhost')
  const viewport = document.createElement('div')
  viewport.className = 'simhost__viewport'
  const guiHost = document.createElement('div')
  guiHost.className = 'simhost__gui'
  root.append(viewport, guiHost)

  const engine = new Engine(viewport)
  if (import.meta.env.DEV) Object.assign(window, { __engine: engine })
  const applyPlayback = () => {
    const s = useSim.getState()
    engine.setPlayback(s.playing, s.speed)
  }
  applyPlayback()
  const unsubPlayback = useSim.subscribe(applyPlayback)

  let session: SimSession | null = null
  let token = 0

  const stop = () => {
    engine.setStage(null)
    session?.dispose()
    session = null
  }

  return {
    engine,
    get session() {
      return session
    },
    async run(mod) {
      const mine = ++token
      stop()
      useSim.setState({ status: 'loading', loadStage: 1, error: null, playing: true, warning: null, caption: '' })
      const s = createSimSession(engine, guiHost, mod.meta.stage ?? 'lab')
      session = s
      try {
        const sim = await mod.create(s.ctx)
        if (mine !== token) {
          sim.dispose?.()
          return
        }
        s.attach(sim)
        engine.setStage(s.stage)
        useSim.setState({ status: 'ready' })
      } catch (err) {
        console.error('[host] load failed', err)
        stop()
        useSim.setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      }
    },
    reset() {
      engine.resetClock()
      session?.sim?.reset?.()
    },
    view(kind) {
      session?.view(kind)
    },
    dispose() {
      token++
      stop()
      unsubPlayback()
      engine.dispose()
    },
  }
}
