const { withXcodeProject, IOSConfig } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// Copies assets/silence.caf into the app bundle. iOS plays the system chime
// for any Live Activity push that carries an alert (mandatory on
// push-to-start) unless the alert names a bundled sound — so the server
// points it at this silent file.
module.exports = function withSilentSound(config) {
  return withXcodeProject(config, (config) => {
    const projectName = config.modRequest.projectName
    const src = path.join(config.modRequest.projectRoot, 'assets/silence.caf')
    const dest = path.join(
      config.modRequest.platformProjectRoot,
      projectName,
      'silence.caf',
    )
    fs.copyFileSync(src, dest)
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: `${projectName}/silence.caf`,
      groupName: projectName,
      project: config.modResults,
      isBuildFile: true,
    })
    return config
  })
}
