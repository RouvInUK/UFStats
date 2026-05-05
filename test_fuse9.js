const transcript = "0";
const validActions = ['pass', 'score', 'drop', 'throwaway', 'defence', 'stall out', 'point'];
const hasAction = validActions.some(action => transcript.includes(action));

console.log("hasAction for '0':", hasAction);

const transcript2 = "0 score";
const hasAction2 = validActions.some(action => transcript2.includes(action));
console.log("hasAction for '0 score':", hasAction2);
