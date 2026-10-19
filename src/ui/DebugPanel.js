/**
 * Panel de rendimiento: se activa con ?debug en la URL.
 * Muestra fps, ms por frame, tiempo de GPU (si el navegador expone
 * EXT_disjoint_timer_query_webgl2), nivel de calidad y coste del frame.
 */
export default class DebugPanel {
  static fromUrl(renderer, quality) {
    return new URLSearchParams(window.location.search).has('debug') ? new DebugPanel(renderer, quality) : null
  }

  constructor(renderer, quality) {
    this.renderer = renderer
    this.quality = quality
    this.gl = renderer.instance.getContext()
    this.timer = this.gl.getExtension('EXT_disjoint_timer_query_webgl2')
    this.pending = []
    this.gpuSamples = []

    // El composer hace varios render(): se acumula todo el frame
    renderer.instance.info.autoReset = false

    this.frames = 0
    this.time = 0

    this.root = document.createElement('div')
    this.root.className = 'debug'
    this.root.innerHTML = `
      <pre class="debug__stats">midiendo…</pre>
      <label class="debug__level">calidad
        <select>
          <option value="auto">auto</option>
          ${[0, 1, 2, 3, 4].map((l) => `<option value="${l}">nivel ${l}</option>`).join('')}
        </select>
      </label>`
    document.body.append(this.root)
    this.stats = this.root.querySelector('.debug__stats')

    const select = this.root.querySelector('select')
    select.value = quality.auto ? 'auto' : String(quality.level)
    select.addEventListener('change', () => {
      quality.auto = select.value === 'auto'
      if (!quality.auto) quality.setLevel(Number(select.value))
    })
  }

  begin() {
    this.renderer.instance.info.reset()
    if (!this.timer) return
    const query = this.gl.createQuery()
    this.gl.beginQuery(this.timer.TIME_ELAPSED_EXT, query)
    this.pending.push(query)
  }

  end(delta) {
    const gl = this.gl
    if (this.timer) {
      gl.endQuery(this.timer.TIME_ELAPSED_EXT)
      const disjoint = gl.getParameter(this.timer.GPU_DISJOINT_EXT)
      while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = this.pending.shift()
        if (!disjoint) this.gpuSamples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6)
        gl.deleteQuery(query)
      }
    }

    this.frames++
    this.time += delta
    if (this.time < 0.5) return

    const info = this.renderer.instance.info.render
    const canvas = this.renderer.instance.domElement
    const s = this.quality.settings
    const gpu = this.gpuSamples.length
      ? (this.gpuSamples.reduce((a, b) => a + b, 0) / this.gpuSamples.length).toFixed(2) + ' ms'
      : this.timer ? '…' : 'n/d'

    this.stats.textContent = [
      `fps      ${(this.frames / this.time).toFixed(0)}`,
      `frame    ${((this.time / this.frames) * 1000).toFixed(2)} ms`,
      `gpu      ${gpu}`,
      `nivel    ${s.level}${s.auto ? ' (auto)' : ''}`,
      `densidad ${s.pixelRatio}x · ${canvas.width}×${canvas.height}`,
      `msaa     ${s.samples}x`,
      `sombra   ${s.shadowMapSize}`,
      `draws    ${info.calls}`,
      `tris     ${(info.triangles / 1000).toFixed(0)}k`
    ].join('\n')

    this.frames = 0
    this.time = 0
    this.gpuSamples.length = 0
    const select = this.root.querySelector('select')
    if (this.quality.auto) select.value = 'auto'
  }
}
