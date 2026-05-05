import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass' },
  { text: '0 score', action: 'Score' },
  { text: '29 pass', action: 'Pass' },
  { text: '29 score', action: 'Score' },
  { text: '8 pass', action: 'Pass' },
  { text: '8 score', action: 'Score' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.4,
  includeScore: true
});

console.log("Testing '29':", fuse.search('29'));
console.log("Testing '0':", fuse.search('0'));
console.log("Testing 'null' (maps to 0):", fuse.search('0'));
