const data = require('./vet_kb_data.json');

const garbageStarters = [
  'Many','While','They','Most','From','There','During','Although','England','Unlike',
  'However','This','These','When','Because','Since','Some','Other','After','Before',
  'Which','Where','Though','Both','Among','Between','Within','Through','Under','Over',
  'Such','Several','Its','Their','The','An','A','In','On','At','By','For','With','As'
];

const garbage = data.filter(function(r) {
  if (!r.title) return false;
  var firstWord = r.title.trim().split(' ')[0];
  return garbageStarters.includes(firstWord);
});

console.log('Total records: ' + data.length);
console.log('Garbage count: ' + garbage.length);
console.log('Garbage percentage: ' + ((garbage.length / data.length) * 100).toFixed(1) + '%');
console.log('');
garbage.forEach(function(r) {
  console.log('  - "' + r.title + '"');
});

// Also show all unique first words
var firstWords = {};
data.forEach(function(r) {
  if (r.title) {
    var w = r.title.trim().split(' ')[0];
    firstWords[w] = (firstWords[w] || 0) + 1;
  }
});
console.log('\nAll first words with frequency:');
Object.keys(firstWords).sort().forEach(function(w) {
  console.log('  ' + w + ': ' + firstWords[w]);
});
