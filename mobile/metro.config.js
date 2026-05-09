const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch the workspace root for changes (so /shared updates trigger rebuild)
config.watchFolders = [workspaceRoot]
// Resolve modules from both the app's node_modules and the workspace root's
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

// Inject polyfills before any other module loads. Hermes doesn't expose
// SharedArrayBuffer, and Clerk Expo (via @clerk/clerk-js/headless) references
// it as a bare identifier, throwing ReferenceError at boot.
const baseGetPolyfills = config.serializer?.getPolyfills
config.serializer = {
  ...config.serializer,
  getPolyfills: (opts) => [
    ...(baseGetPolyfills ? baseGetPolyfills(opts) : []),
    path.resolve(projectRoot, 'polyfills/sab.js'),
  ],
}

module.exports = withNativeWind(config, { input: './global.css' })
