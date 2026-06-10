import { actions, applyAction, createSwarmBox, exportSnapshot, injectWeird, runScenario, sanitizeWeirdInput } from '../domain/swarm';

const args = process.argv.slice(2);
const getArg = (name: string, fallback?: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const has = (name: string) => args.includes(name);

const seed = getArg('--seed', 'morning-ryo') || 'morning-ryo';
const requestedActions = args
  .flatMap((arg, index) => (arg === '--action' ? [args[index + 1]] : []))
  .filter(Boolean);
const weird = getArg('--weird');
const sequence = requestedActions.length
  ? requestedActions.filter((value): value is (typeof actions)[number] => actions.includes(value as (typeof actions)[number]))
  : undefined;

let state = sequence ? sequence.reduce((next, action) => applyAction(next, action), createSwarmBox(seed)) : runScenario(seed);
if (weird !== undefined) state = injectWeird(state, weird);
const snapshot = exportSnapshot(state);

if (has('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(`Sideeffect Swarm seed=${snapshot.seed}`);
  console.log(`actions=${snapshot.actions.join(' -> ')}`);
  console.log(`ecosystemStability=${snapshot.ecosystemStability} repairProgress=${snapshot.repairProgress}`);
  console.log(`swarmWill=${snapshot.swarmWill}`);
  console.log(`ending=${snapshot.ending}`);
  console.log(`topLog=${snapshot.logs[0]}`);
  console.log(`swarms=${snapshot.swarms.map((swarm) => `${swarm.kind}:${swarm.from}->${swarm.to} pop=${swarm.population}`).join(', ')}`);
  if (weird !== undefined) console.log(`weird=${sanitizeWeirdInput(weird)}`);
}
