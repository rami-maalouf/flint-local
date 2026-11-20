Pod::Spec.new do |s|
  s.name           = 'TipJar'
  s.version        = '1.0.0'
  s.summary        = 'Optional support for Flint Local'
  s.description    = 'A one-time, restorable developer tip using StoreKit 2.'
  s.author         = 'Rami Maalouf'
  s.homepage       = 'https://github.com/rami-maalouf/flint-local'
  s.platforms      = { :ios => '18.6' }
  s.source         = { git: 'https://github.com/rami-maalouf/flint-local.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # the storekit tests run in their own app host (scripts/run-storekit-tests.mjs)
  s.source_files = '*.swift'
end
