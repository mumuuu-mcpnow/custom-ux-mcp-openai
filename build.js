import { build } from 'esbuild'
import path from 'path'

await build({
  entryPoints: ['web/src/component.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: 'dist/component.js',
  alias: {
    react: path.resolve('./node_modules/react'),
    'react-dom': path.resolve('./node_modules/react-dom')
  }
})