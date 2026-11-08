import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Cache every lazy route and the HLS runtime, so a cold offline launch can play downloads.
const files = (await readdir('dist/assets')).map((name) => `/assets/${name}`).sort()
const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
const template = await readFile('public/sw.js', 'utf8')
await writeFile('dist/sw.js', template.replace('__BUILD_ID__', version).replace('/* __PRECACHE__ */', files.map((file) => JSON.stringify(file)).join(',')))
