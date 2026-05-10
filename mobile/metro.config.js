const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch the workspace root so /shared updates trigger rebuilds.
config.watchFolders = [workspaceRoot]

// Inject a Hermes polyfill before any user module loads. Some packages
// (Clerk Expo via @clerk/clerk-js/headless) reference SharedArrayBuffer as
// a bare identifier; Hermes throws ReferenceError without this stub.
const baseGetPolyfills = config.serializer?.getPolyfills
config.serializer = {
  ...config.serializer,
  getPolyfills: (opts) => [
    ...(baseGetPolyfills ? baseGetPolyfills(opts) : []),
    path.resolve(projectRoot, 'polyfills/sab.js'),
  ],
}

module.exports = withNativeWind(config, { input: './global.css' })
