countries = [
  'us',
  'gb',
  'fr',
  'de',
  'ca',
  'no',
  'es',
  'it',
  'se',
  'fi'
]

(1..25000).each do |index|
  puts [index, countries[Random.rand(countries.size)]].join(', ')
end
