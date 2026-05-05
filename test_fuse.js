import Fuse from 'fuse.js';

const expectedCommands = [
  { text: '0 pass', action: 'Pass', player: 'Player 0' },
  { text: '29 pass', action: 'Pass', player: 'Player 29' },
  { text: '8 pass', action: 'Pass', player: 'Player 8' }
];

const fuse = new Fuse(expectedCommands, {
  keys: ['text'],
  threshold: 0.4,
  includeScore: true
});

console.log("Testing 'null pass':", fuse.search('null pass'));
console.log("Testing 'nil pass':", fuse.search('nil pass'));
console.log("Testing '0 pass':", fuse.search('0 pass'));
console.log("Testing '29 pass':", fuse.search('29 pass'));
console.log("Testing 'twenty nine pass':", fuse.search('twenty nine pass'));
console.log("Testing 'twenty 9 pass':", fuse.search('twenty 9 pass'));
console.log("Testing 'tonight pass':", fuse.search('tonight pass'));
