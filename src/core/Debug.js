import GUI from 'lil-gui'
import Stats from 'three/addons/libs/stats.module.js'

/**
 * Controles con lil-gui y Stats: solo con #debug en la URL.
 * folder() devuelve null si no está activo, así cada módulo hace `if (!folder) return`.
 * (?debug, sin almohadilla, es el panel de rendimiento de ui/DebugPanel.js)
 */
export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'
    // Al poner o quitar #debug se recarga para crear (o no) los controles
    window.addEventListener('hashchange', () => window.location.reload())
    if (!this.active) return

    this.gui = new GUI({ title: 'Debug' })
    this.stats = new Stats()
    this.stats.dom.style.left = 'auto'
    this.stats.dom.style.right = '260px'
    document.body.append(this.stats.dom)
  }

  folder(name) {
    if (!this.active) return null
    return this.gui.addFolder(name).close()
  }

  /** Vuelve a leer los valores (p. ej. tras cambiar de escenario) */
  refresh() {
    this.gui?.controllersRecursive().forEach((controller) => controller.updateDisplay())
  }

  begin() {
    this.stats?.begin()
  }

  end() {
    this.stats?.end()
  }
}
