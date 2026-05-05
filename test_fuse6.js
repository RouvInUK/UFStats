import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass' },
  { text: '29 pass', action: 'Pass' },
  { text: '8 pass', action: 'Pass' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.2,
  includeScore: true
});

console.log("Testing '28 pass':", fuse.search('28 pass'));
console.log("Testing '29 pass':", fuse.search('29 pass'));
console.log("Testing '0 pass':", fuse.search('0 pass'));
console.log("Testing '8 pass':", fuse.search('8 pass'));
