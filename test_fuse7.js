import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass' },
  { text: '28 pass', action: 'Pass' },
  { text: '10 score', action: 'Score' },
  { text: '10 stall out', action: 'Stall Out' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.3,
  includeScore: true
});

console.log("Testing 'pass 28 pass':", fuse.search('pass 28 pass'));
console.log("Testing 'pass 10 score':", fuse.search('pass 10 score'));
console.log("Testing '0 pass 10 stall out':", fuse.search('pass 10 stall out'));
console.log("Testing 'pass opponent score':", fuse.search('pass opponent score'));
