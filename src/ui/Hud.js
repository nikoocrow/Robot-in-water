export default class Hud {
  constructor({ onToggleAnimation, onResetCamera, onToggleScenario }) {
    this.loader = document.querySelector('.loader')
    this.loaderFill = this.loader.querySelector('.loader__fill')
    this.loaderValue = this.loader.querySelector('.loader__value')
    this.loaderText = this.loader.querySelector('.loader__text')
    this.panel = document.querySelector('.hud')

    this.panel.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]')
      if (!button) return

      switch (button.dataset.action) {
        case 'toggle-animation': {
          const paused = button.getAttribute('aria-pressed') !== 'true'
          button.setAttribute('aria-pressed', String(paused))
          button.textContent = paused ? 'Reanudar' : 'Pausar'
          onToggleAnimation(!paused)
          break
        }
        case 'reset-camera':
          onResetCamera()
          break
        case 'toggle-scenario':
          onToggleScenario()
          break
      }
    })
  }

  /** El botón ofrece ir al otro escenario */
  setScenario(name) {
    const button = this.panel.querySelector('[data-action="toggle-scenario"]')
    const sea = name === 'sea'
    button.setAttribute('aria-pressed', String(sea))
    button.textContent = sea ? 'Ver el río' : 'Ver el mar'
  }

  setProgress(ratio) {
    const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
    this.loaderFill.style.transform = `scaleX(${percent / 100})`
    this.loaderValue.textContent = `${percent}%`
  }

  ready() {
    this.loader.classList.add('is-done')
    this.loader.addEventListener('transitionend', () => this.loader.remove(), { once: true })
    this.panel.hidden = false
  }

  error(message) {
    this.loader.classList.add('is-error')
    this.loaderText.textContent = message
  }
}
