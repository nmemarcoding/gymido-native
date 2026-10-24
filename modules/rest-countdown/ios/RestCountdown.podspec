Pod::Spec.new do |s|
  s.name           = 'RestCountdown'
  s.version        = '1.0.0'
  s.summary        = 'Gymido rest countdown (RN-SPEC-time O13)'
  s.description    = 'Live Activity rest countdown on iOS, chronometer notification on Android.'
  s.license        = 'UNLICENSED'
  s.author         = 'Gymido'
  s.homepage       = 'https://github.com/nmemarcoding'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
