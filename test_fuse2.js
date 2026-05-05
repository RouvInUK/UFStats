import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass' },
  { text: '29 pass', action: 'Pass' },
  { text: '8 pass', action: 'Pass' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.4,
  includeScore: true
});

console.log("Testing '2 9 pass':", fuse.search('2 9 pass'));
console.log("Testing 'twenty-nine pass':", fuse.search('twenty-nine pass'));
console.log("Testing '29 paths':", fuse.search('29 paths'));
console.log("Testing '89 pass':", fuse.search('89 pass'));
