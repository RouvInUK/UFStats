import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass' },
  { text: '28 pass', action: 'Pass' },
  { text: '0 score', action: 'Score' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.2,
  includeScore: true
});

console.log("Testing '0':", fuse.search('0'));
console.log("Testing '28':", fuse.search('28'));
