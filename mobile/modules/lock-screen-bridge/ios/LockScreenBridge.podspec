Pod::Spec.new do |s|
  s.name           = 'LockScreenBridge'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit push tokens + shared widget config for the Lock Screen Timer'
  s.description    = 'Feeds ActivityKit push-to-start and per-activity update tokens to JS, and parks the API base URL + device token in the shared App Group for the widget extension.'
  s.author         = 'Max Lascombe'
  s.homepage       = 'https://github.com/MaxLascombe/do-this-now-2'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end
