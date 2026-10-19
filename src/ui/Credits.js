/**
 * Botón "Credits" (arriba a la derecha) con una tarjeta desplegable.
 * Se cierra con el botón, Escape o un clic fuera de la tarjeta.
 */
export default class Credits {
  constructor(root = document.querySelector('.credits')) {
    this.root = root
    this.toggle = root.querySelector('.credits__toggle')
    this.card = root.querySelector('.credits__card')

    this.toggle.addEventListener('click', () => this.setOpen(!this.isOpen))

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.setOpen(false)
        this.toggle.focus()
      }
    })

    // pointerdown: cierra antes de que OrbitControls empiece a arrastrar
    document.addEventListener('pointerdown', (event) => {
      if (this.isOpen && !this.root.contains(event.target)) this.setOpen(false)
    })
  }

  get isOpen() {
    return this.root.classList.contains('is-open')
  }

  setOpen(open) {
    this.root.classList.toggle('is-open', open)
    this.toggle.setAttribute('aria-expanded', String(open))
  }
}
