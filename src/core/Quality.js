import { QUALITY } from '../config/scene.js'

/**
 * Calidad adaptativa: si el equipo no llega a ~60 fps baja un nivel
 * (menos resolución en pantallas de alta densidad y sombra de 2048),
 * y si va holgado durante un rato vuelve a subir.
 *
 * ?quality=0..4 en la URL fija un nivel y desactiva el ajuste automático.
 */
export default class Quality {
  constructor({ maxPixelRatio, onChange }) {
    this.maxPixelRatio = maxPixelRatio
    this.onChange = onChange

    const forced = new URLSearchParams(window.location.search).get('quality')
    this.auto = forced === null
    this.level = this.auto ? 0 : Math.min(Math.max(Number(forced) || 0, 0), QUALITY.levels.length - 1)

    this.resetWindow()
    this.warmup = QUALITY.warmup
    this.cooldown = 0
    this.calmTime = 0
    // Nivel más alto que se puede recuperar: si uno ya fue lento, no se vuelve a él
    this.best = 0
  }

  get settings() {
    const level = QUALITY.levels[this.level]
    const pixelRatio = Math.min(this.maxPixelRatio, level.pixelRatio)
    return {
      level: this.level,
      auto: this.auto,
      pixelRatio,
      // En alta densidad los bordes ya son finos: 2 muestras bastan
      samples: pixelRatio >= 1.75 ? 2 : 4,
      shadowMapSize: level.shadowMapSize
    }
  }

  setMaxPixelRatio(maxPixelRatio) {
    this.maxPixelRatio = maxPixelRatio
  }

  resetWindow() {
    this.frames = 0
    this.time = 0
  }

  /** delta en segundos del frame anterior */
  update(delta) {
    if (!this.auto) return

    // Pestaña oculta, pausa del depurador, etc.: no cuenta
    if (delta > 0.25) return this.resetWindow()

    if (this.warmup > 0) {
      this.warmup -= delta
      return
    }
    if (this.cooldown > 0) {
      this.cooldown -= delta
      return
    }

    this.frames++
    this.time += delta
    if (this.time < QUALITY.window) return

    const frameMs = (this.time / this.frames) * 1000
    this.resetWindow()

    if (frameMs > QUALITY.slowFrameMs && this.level < QUALITY.levels.length - 1) {
      this.best = Math.max(this.best, this.level + 1)
      this.setLevel(this.level + 1)
      this.calmTime = 0
    } else if (frameMs < QUALITY.fastFrameMs && this.level > this.best) {
      // Subir solo tras un rato holgado, para no oscilar
      this.calmTime += QUALITY.window
      if (this.calmTime >= QUALITY.upgradeAfter) {
        this.setLevel(this.level - 1)
        this.calmTime = 0
      }
    } else {
      this.calmTime = 0
    }
  }

  setLevel(level) {
    if (level === this.level) return
    this.level = level
    this.cooldown = QUALITY.cooldown
    this.onChange(this.settings)
  }
}
