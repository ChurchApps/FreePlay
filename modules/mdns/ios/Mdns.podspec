Pod::Spec.new do |s|
  s.name           = 'Mdns'
  s.version        = '1.0.0'
  s.summary        = 'DNS-SD browsing for FreePlay'
  s.author         = 'ChurchApps'
  s.homepage       = 'https://freeplay.church'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
