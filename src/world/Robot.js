import * as THREE from 'three'
import { ROBOT_LOOP } from '../config/scene.js'

/**
 * La acción de Blender no termina en la misma pose en la que empieza, así que
 * al repetirse salta. Se rehace el clip fundiendo su último tramo con el inicio:
 * el ciclo dura `blend` segundos menos, pero el final enlaza con el principio
 * en pose y en velocidad.
 */
function makeSeamlessLoop(clip, fps, blendSeconds) {
  const start = Math.min(...clip.tracks.map((t) => t.times[0]))
  const end = Math.max(...clip.tracks.map((t) => t.times[t.times.length - 1]))
  const blend = Math.min(blendSeconds, (end - start) / 2)
  const period = end - start - blend
  const frames = Math.max(1, Math.round(period * fps))

  const tracks = clip.tracks.map((track) => {
    const interpolant = track.createInterpolant()
    const sample = (t) => interpolant.evaluate(t).slice()
    const size = track.getValueSize()
    const isQuaternion = track instanceof THREE.QuaternionKeyframeTrack

    const times = new Float32Array(frames + 1)
    const values = new Float32Array((frames + 1) * size)

    for (let i = 0; i <= frames; i++) {
      const local = (i / frames) * period
      let value = sample(start + local)

      // Al principio del ciclo se parte del tramo final y se funde hacia el original
      if (local < blend) {
        const tail = sample(start + local + period)
        const x = local / blend
        const w = x * x * (3 - 2 * x)
        if (isQuaternion) {
          THREE.Quaternion.slerpFlat(value, 0, tail, 0, value, 0, w)
        } else {
          value = tail.map((v, k) => v + (value[k] - v) * w)
        }
      }

      times[i] = local
      values.set(value, i * size)
    }

    return new track.constructor(track.name, times, values)
  })

  return new THREE.AnimationClip(clip.name, period, tracks)
}

/** Reproduce la acción "RobotAction" exportada desde Blender, en bucle continuo */
export default class Robot {
  constructor(model, animations, fps = 24) {
    this.root = model.getObjectByName('Robot') ?? model
    this.mixer = new THREE.AnimationMixer(model)
    this.playing = true

    const clip = THREE.AnimationClip.findByName(animations, 'RobotAction') ?? animations[0]
    if (clip) {
      this.action = this.mixer.clipAction(makeSeamlessLoop(clip, fps, ROBOT_LOOP.blend))
      this.action.setLoop(THREE.LoopRepeat, Infinity)
      this.action.play()
    }
  }

  /** Centro del robot, usado para encuadrar la cámara */
  getFocusPoint() {
    const box = new THREE.Box3().setFromObject(this.root)
    return box.isEmpty() ? new THREE.Vector3(0, 1, 0) : box.getCenter(new THREE.Vector3())
  }

  setPlaying(playing) {
    this.playing = playing
  }

  update(delta) {
    if (this.playing) this.mixer.update(delta)
  }
}
