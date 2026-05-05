import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass' },
  { text: '29 pass', action: 'Pass' },
  { text: '8 pass', action: 'Pass' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.3,
  includeScore: true
});

console.log("Testing '28 pass':", fuse.search('28 pass'));
console.log("Testing '89 pass':", fuse.search('89 pass'));
console.log("Testing '0 pass':", fuse.search('0 pass'));
console.log("Testing 'ill pass':", fuse.search('ill pass'));
