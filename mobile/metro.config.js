const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch the workspace root so /shared updates trigger rebuilds.
config.watchFolders = [workspaceRoot]

// Force every consumer (including packages that pnpm gave a different
// react peer — @expo-google-fonts/* ended up pinned to 19.2.6 while
// mobile uses 19.1.0) to resolve `react` and `react-native` from
// mobile's package root. Without this, two React module instances end up
// in the bundle and any hook explodes with "Cannot read property
// 'useState' of null". `extraNodeModules` only fills resolution misses;
// since the alternate react was findable through pnpm's tree, we need a
// resolveRequest hook that re-anchors the origin to mobile/.
const baseResolveRequest = config.resolver.resolveRequest
const mobilePackageJson = path.join(projectRoot, 'package.json')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/') ||
    moduleName === '@tanstack/react-query' ||
    moduleName.startsWith('@tanstack/react-query/') ||
    moduleName === '@tanstack/react-query-persist-client' ||
    moduleName.startsWith('@tanstack/react-query-persist-client/')
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: mobilePackageJson },
      moduleName,
      platform,
    )
  }
  return baseResolveRequest
    ? baseResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

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
