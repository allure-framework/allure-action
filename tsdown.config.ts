import * as path from 'node:path'
import license from 'rollup-plugin-license'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './dist',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  fixedExtension: false,
  hash: false,
  outputOptions: {
    codeSplitting: false,
  },
  plugins: [
    license({
      thirdParty: {
        includePrivate: false,
        includeSelf: false,
        multipleVersions: true,
        output: {
          file: path.join(process.cwd(), 'dist', 'licenses.txt'),
          encoding: 'utf-8',
        },
      },
    }),
  ],
  deps: {
    alwaysBundle: [new RegExp('^@actions\\/'), 'fast-glob', 'd3-shape', 'lodash.chunk'],
  },
  clean: true,
  checks: {
    legacyCjs: false,
  },
})