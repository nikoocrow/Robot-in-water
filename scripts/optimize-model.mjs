// Comprime el modelo exportado de Blender con EXT_meshopt_compression, sin pérdida:
//   assets-src/escena.glb  ->  src/assets/models/escena.glb
//
// No se cuantiza (el CLI de gltf-transform sí lo hace): la cuantización cambia las
// coordenadas locales de las mallas, y los shaders de Blender dependen de ellas.
// Solo se reordenan vértices e índices para que el codificador comprima mejor.
//
// Uso: npm run optimize:model
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { reorder } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const INPUT = 'assets-src/escena.glb'
const OUTPUT = 'src/assets/models/escena.glb'

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

const document = await io.read(INPUT)
await document.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }))

document
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE }) // sin filtros: sin pérdida

await io.write(OUTPUT, document)
console.log(`${INPUT} -> ${OUTPUT}`)
