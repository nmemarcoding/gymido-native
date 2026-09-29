# O13 (RN-SPEC-time): the live rest countdown. See modules/rest-countdown/index.js.
Pod::Spec.new do |s|
  s.name           = 'RestCountdown'
  s.version        = '1.0.0'
  s.summary        = 'The live rest countdown: a self-ending Lock Screen Live Activity.'
  s.author         = 'gymido'
  s.homepage       = 'https://gymido.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
