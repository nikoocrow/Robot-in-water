export default class Sizes {
  constructor(onResize) {
    this.update()
    window.addEventListener('resize', () => {
      this.update()
      onResize(this)
    })
  }

  update() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
  }
}
