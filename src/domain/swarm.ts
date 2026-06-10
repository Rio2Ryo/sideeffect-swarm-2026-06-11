import type {
  ActionId,
  ExportedSwarmSnapshot,
  ServiceId,
  ServiceNode,
  Swarm,
  SwarmKind,
  SwarmRelation,
  SwarmState,
} from './types';

const serviceLayout: Array<Omit<ServiceNode, 'health' | 'pressure' | 'symptom'>> = [
  { id: 'auth', label: 'Auth', x: 18, y: 30 },
  { id: 'queue', label: 'Queue', x: 40, y: 20 },
  { id: 'billing', label: 'Billing', x: 66, y: 30 },
  { id: 'images', label: 'Images', x: 25, y: 70 },
  { id: 'notifier', label: 'Notifier', x: 56, y: 76 },
  { id: 'ledger', label: 'Ledger', x: 82, y: 62 },
];

const kindMeta: Record<SwarmKind, { color: string; note: string }> = {
  'retry-larvae': { color: '#ffb86b', note: '再試行ログを食べ、失敗の温度で繁殖する幼虫。' },
  'cache-moths': { color: '#bd93f9', note: '古いキャッシュに産卵し、正しい修復も粉にする蛾。' },
  'token-aphids': { color: '#50fa7b', note: 'Auth tokenに群がり、正常な認証を甘い蜜に変えるアブラムシ。' },
  'rollback-spores': { color: '#8be9fd', note: 'ロールバック痕から眠る胞子。根絶すると別サービスへ飛ぶ。' },
  'canary-wasps': { color: '#f1fa8c', note: '群れの意思を刺して可視化する観測蜂。少し攻撃性も上げる。' },
  'ledger-snails': { color: '#ff79c6', note: '台帳に修復痕をゆっくり刻むカタツムリ。遅いが忘れない。' },
};

const actionLabels: Record<ActionId, string> = {
  'seal-queue': 'Queueを封じる',
  'compost-tokens': 'Tokenを堆肥化',
  'release-canary-wasps': '観測蜂を放つ',
  'throttle-billing': 'Billingを絞る',
  'salt-cache': 'Cacheに塩を撒く',
  'open-migration-corridor': '移住路を開く',
  'negotiate-with-swarm': '群れと交渉',
};

export const actions: ActionId[] = [
  'release-canary-wasps',
  'seal-queue',
  'compost-tokens',
  'throttle-billing',
  'salt-cache',
  'open-migration-corridor',
  'negotiate-with-swarm',
];

export function getActionLabel(action: ActionId): string {
  return actionLabels[action];
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pick<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length) % list.length];
}

function safeLog(text: string): string {
  return sanitizeWeirdInput(text).slice(0, 220);
}

export function sanitizeSeed(raw: string | null | undefined): string {
  const clean = sanitizeWeirdInput(raw || 'morning-ryo')
    .toLowerCase()
    .replace(/[^a-z0-9\-_:]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
  return clean || 'morning-ryo';
}

export function sanitizeWeirdInput(input: string): string {
  return String(input)
    .replace(/[<>]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/javascript:/gi, 'javascript-blocked:')
    .replace(/on\w+=/gi, 'event=')
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : char;
    })
    .join('')
    .trim()
    .slice(0, 160);
}

function makeSwarm(kind: SwarmKind, idSalt: string, from: ServiceId, to: ServiceId, population: number, aggression: number, mutation: number, intent?: Swarm['intent']): Swarm {
  const meta = kindMeta[kind];
  const intents: Swarm['intent'][] = ['breed', 'migrate', 'compete', 'hide', 'repair', 'feed'];
  return {
    id: `${kind}-${idSalt}`,
    kind,
    population: clamp(population, 0, 180),
    from,
    to,
    intent: intent || intents[hashSeed(`${kind}-${idSalt}`) % intents.length],
    aggression: clamp(aggression),
    mutation: clamp(mutation),
    color: meta.color,
    note: meta.note,
  };
}

function serviceById(state: SwarmState, id: ServiceId): ServiceNode {
  const found = state.services.find((service) => service.id === id);
  if (!found) throw new Error(`missing service ${id}`);
  return found;
}

function updateService(state: SwarmState, id: ServiceId, update: Partial<ServiceNode>): SwarmState {
  return {
    ...state,
    services: state.services.map((service) => (service.id === id ? { ...service, ...update } : service)),
  };
}

function addLog(state: SwarmState, message: string): SwarmState {
  return { ...state, logs: [`t${state.tick}: ${safeLog(message)}`, ...state.logs].slice(0, 24) };
}

function withMetrics(state: SwarmState): SwarmState {
  const ecosystemStability = calculateEcosystemStability(state);
  const repairProgress = calculateRepairProgress(state);
  const swarmWill = summarizeSwarmWill({ ...state, ecosystemStability, repairProgress });
  const ending = ecosystemStability > 75 && repairProgress > 70
    ? 'repair accepted, ecosystem negotiated'
    : ecosystemStability < 40
      ? 'repair succeeded locally, swarm ecology is now unstable'
      : 'serviceable, with swarms still voting under the floorboards';
  return { ...state, ecosystemStability, repairProgress, swarmWill, ending };
}

export function createSwarmBox(seedInput = 'morning-ryo'): SwarmState {
  const seed = sanitizeSeed(seedInput);
  const random = rng(seed);
  const symptoms = [
    '正常に見えるが再試行が甘く発酵している',
    '緑のメトリクスの裏で群れが投票している',
    '修復痕が夜だけ別サービスへ移住する',
    'ログが食べられ、原因が一行ずつ薄くなる',
  ];
  const services = serviceLayout.map((service, index) => ({
    ...service,
    health: clamp(58 + random() * 28 - index * 2),
    pressure: clamp(28 + random() * 52 + (service.id === 'queue' ? 18 : 0)),
    symptom: pick(symptoms, random),
  }));
  const swarms: Swarm[] = [
    makeSwarm('retry-larvae', 'q-b', 'queue', 'billing', 42 + random() * 30, 58, 32, 'breed'),
    makeSwarm('token-aphids', 'a-q', 'auth', 'queue', 28 + random() * 20, 35, 44, 'feed'),
    makeSwarm('cache-moths', 'i-n', 'images', 'notifier', 23 + random() * 24, 64, 61, 'hide'),
    makeSwarm('ledger-snails', 'l-a', 'ledger', 'auth', 12 + random() * 16, 12, 18, 'repair'),
  ];
  const relations: SwarmRelation[] = [
    { a: 'canary-wasps', b: 'cache-moths', relation: 'predates' },
    { a: 'retry-larvae', b: 'ledger-snails', relation: 'competes' },
    { a: 'rollback-spores', b: 'cache-moths', relation: 'symbiosis' },
    { a: 'token-aphids', b: 'retry-larvae', relation: 'symbiosis' },
  ];
  return withMetrics({
    seed,
    tick: 0,
    services,
    swarms,
    relations,
    actions: [],
    logs: [
      't0: repair garden export imported; four side-effect species survived the night',
      't0: swarm consensus unreadable until canary wasps are released',
    ],
    ecosystemStability: 0,
    repairProgress: 0,
    swarmWill: '',
    ending: '',
    weirdInputs: [],
  });
}

export function applyAction(input: SwarmState, action: ActionId): SwarmState {
  let state = { ...input, actions: [...input.actions, action], tick: input.tick + 1 };
  switch (action) {
    case 'release-canary-wasps':
      state = {
        ...state,
        swarms: [...state.swarms, makeSwarm('canary-wasps', `t${state.tick}`, 'ledger', 'queue', 18, 28, 20, 'repair')].map((swarm) =>
          swarm.kind === 'cache-moths' ? { ...swarm, aggression: clamp(swarm.aggression + 8), population: clamp(swarm.population - 7, 0, 180) } : swarm,
        ),
      };
      state = addLog(state, 'Canary wasps released: the swarm vote becomes legible, but cache moths panic and bite logs.');
      break;
    case 'seal-queue': {
      const queue = serviceById(state, 'queue');
      const billing = serviceById(state, 'billing');
      state = updateService(state, 'queue', { health: clamp(queue.health + 20), pressure: clamp(queue.pressure - 34) });
      state = updateService(state, 'billing', { pressure: clamp(billing.pressure + 20), symptom: 'Queueを封じたため、再試行幼虫が請求系で孵化している' });
      state = { ...state, swarms: state.swarms.map((swarm) => swarm.kind === 'retry-larvae' ? { ...swarm, from: 'queue', to: 'billing', population: clamp(swarm.population + 22, 0, 180), intent: 'breed' } : swarm) };
      state = addLog(state, 'Queue sealed: retry larvae did not die; they learned the warm path into Billing.');
      break;
    }
    case 'compost-tokens': {
      const auth = serviceById(state, 'auth');
      state = updateService(state, 'auth', { health: clamp(auth.health + 24), pressure: clamp(auth.pressure - 20), symptom: 'Token aphids are composted into traceable repair soil' });
      state = {
        ...state,
        swarms: [
          ...state.swarms.map((swarm) => swarm.kind === 'token-aphids' ? { ...swarm, population: clamp(swarm.population - 28, 0, 180), intent: 'hide' as const } : swarm),
          makeSwarm('rollback-spores', `auth-${state.tick}`, 'auth', 'notifier', 24, 18, 66, 'migrate'),
        ],
      };
      state = addLog(state, 'Token composted: Auth breathes, but rollback spores drift toward Notifier like pollen.');
      break;
    }
    case 'throttle-billing': {
      const billing = serviceById(state, 'billing');
      const ledger = serviceById(state, 'ledger');
      state = updateService(state, 'billing', { health: clamp(billing.health + 16), pressure: clamp(billing.pressure - 31) });
      state = updateService(state, 'ledger', { pressure: clamp(ledger.pressure + 13), symptom: 'Ledger snails are archiving the throttle scar too slowly' });
      state = { ...state, swarms: [...state.swarms, makeSwarm('ledger-snails', `b-${state.tick}`, 'billing', 'ledger', 19, 9, 14, 'repair')] };
      state = addLog(state, 'Billing throttled: ledger snails start writing a scar map nobody asked for.');
      break;
    }
    case 'salt-cache':
      state = {
        ...state,
        swarms: state.swarms.map((swarm) =>
          swarm.kind === 'cache-moths'
            ? { ...swarm, population: clamp(swarm.population - 18, 0, 180), mutation: clamp(swarm.mutation + 19), to: 'images' }
            : swarm,
        ),
      };
      state = addLog(state, 'Cache salted: moth population shrinks, but survivors mutate glassy wings and hide inside Images.');
      break;
    case 'open-migration-corridor':
      state = {
        ...state,
        services: state.services.map((service) => ({ ...service, pressure: clamp(service.pressure - 9) })),
        swarms: state.swarms.map((swarm, index) => ({ ...swarm, from: swarm.to, to: serviceLayout[(index + state.tick) % serviceLayout.length].id, intent: 'migrate' })),
      };
      state = addLog(state, 'Migration corridor opened: pressure drops, and the swarm learns that roads are a kind of memory.');
      break;
    case 'negotiate-with-swarm':
      state = {
        ...state,
        swarms: state.swarms.map((swarm) => ({ ...swarm, aggression: clamp(swarm.aggression - 17), mutation: clamp(swarm.mutation - 6), intent: swarm.kind === 'ledger-snails' ? 'repair' : 'feed' })),
        relations: [...state.relations, { a: 'canary-wasps', b: 'ledger-snails', relation: 'symbiosis' }],
      };
      state = addLog(state, 'Negotiated instead of exterminating: two species agree to leave readable scars.');
      break;
  }
  return withMetrics(resolveCompetition(breedSwarms(migrateSwarms(state))));
}

export function advanceTick(input: SwarmState): SwarmState {
  let state = { ...input, tick: input.tick + 1 };
  state = migrateSwarms(breedSwarms(resolveCompetition(state)));
  const biggest = [...state.swarms].sort((a, b) => b.population - a.population)[0];
  state = addLog(state, `${biggest.kind} pulse: ${biggest.population} bodies vote to ${biggest.intent} from ${biggest.from} to ${biggest.to}.`);
  return withMetrics(state);
}

export function migrateSwarms(input: SwarmState): SwarmState {
  const ids = serviceLayout.map((service) => service.id);
  const swarms = input.swarms.map((swarm) => {
    if (swarm.intent !== 'migrate' && input.tick % 2 !== 0) return swarm;
    const current = ids.indexOf(swarm.to);
    const step = swarm.mutation > 55 ? 2 : 1;
    return { ...swarm, from: swarm.to, to: ids[(current + step) % ids.length] };
  });
  const services = input.services.map((service) => {
    const visitors = swarms.filter((swarm) => swarm.to === service.id).reduce((sum, swarm) => sum + swarm.population, 0);
    return { ...service, pressure: clamp(service.pressure + visitors / 22 - 2) };
  });
  return { ...input, swarms, services };
}

export function breedSwarms(input: SwarmState): SwarmState {
  const swarms = input.swarms.map((swarm) => {
    const growth = swarm.intent === 'breed' ? 9 : swarm.intent === 'feed' ? 5 : swarm.intent === 'repair' ? 1 : -1;
    const mutationBoost = swarm.population > 60 ? 3 : 0;
    return { ...swarm, population: clamp(swarm.population + growth, 0, 180), mutation: clamp(swarm.mutation + mutationBoost) };
  });
  return { ...input, swarms };
}

export function resolveCompetition(input: SwarmState): SwarmState {
  const countsByTarget = input.swarms.reduce<Record<string, number>>((acc, swarm) => {
    acc[swarm.to] = (acc[swarm.to] || 0) + 1;
    return acc;
  }, {});
  const swarms = input.swarms.map((swarm) => {
    const crowded = (countsByTarget[swarm.to] || 0) > 1;
    if (!crowded) return swarm;
    const canaryPredation = input.relations.some((rel) => rel.a === 'canary-wasps' && rel.b === swarm.kind && rel.relation === 'predates');
    return {
      ...swarm,
      aggression: clamp(swarm.aggression + (canaryPredation ? -9 : 7)),
      population: clamp(swarm.population + (swarm.intent === 'compete' ? 4 : -3), 0, 180),
    };
  });
  return { ...input, swarms };
}

export function calculateEcosystemStability(state: SwarmState): number {
  const averageHealth = state.services.reduce((sum, service) => sum + service.health, 0) / state.services.length;
  const averagePressure = state.services.reduce((sum, service) => sum + service.pressure, 0) / state.services.length;
  const aggression = state.swarms.reduce((sum, swarm) => sum + swarm.aggression * (swarm.population / 100), 0) / Math.max(1, state.swarms.length);
  const symbiosis = state.relations.filter((rel) => rel.relation === 'symbiosis').length * 5;
  return clamp(averageHealth - averagePressure * 0.45 - aggression * 0.32 + symbiosis + 30);
}

export function calculateRepairProgress(state: SwarmState): number {
  const actionsScore = new Set(state.actions).size * 8;
  const repairSwarms = state.swarms.filter((swarm) => swarm.intent === 'repair').reduce((sum, swarm) => sum + swarm.population, 0) / 5;
  const pressurePenalty = state.services.reduce((sum, service) => sum + service.pressure, 0) / state.services.length / 3;
  return clamp(24 + actionsScore + repairSwarms - pressurePenalty);
}

export function summarizeSwarmWill(state: SwarmState): string {
  const leader = [...state.swarms].sort((a, b) => b.population - a.population || b.aggression - a.aggression)[0];
  const target = serviceById(state, leader.to).label;
  const canary = state.swarms.some((swarm) => swarm.kind === 'canary-wasps');
  const verb = leader.intent === 'breed'
    ? '繁殖しようとしている'
    : leader.intent === 'migrate'
      ? '移住路を覚えようとしている'
      : leader.intent === 'compete'
        ? '他種を押し退けようとしている'
        : leader.intent === 'repair'
          ? '修復痕を読める形で残そうとしている'
          : 'ログを餌にして隠れようとしている';
  if (!canary) return `群れの意思はまだ霧の中。最大群 ${leader.kind} が ${target} 付近でざわめく。`;
  return `観測蜂の刺し跡から読むと、${leader.kind} は ${target} で${verb}。`;
}

export function injectWeird(input: SwarmState, raw: string): SwarmState {
  const clean = sanitizeWeirdInput(raw);
  let state: SwarmState = {
    ...input,
    tick: input.tick + 1,
    weirdInputs: [clean, ...input.weirdInputs].slice(0, 6),
    swarms: [...input.swarms, makeSwarm('cache-moths', `weird-${input.tick}`, 'images', 'notifier', clean.length > 80 ? 19 : 7, 22, 52, 'hide')],
  };
  state = addLog(state, `Weird input quarantined as inert specimen: "${clean || 'empty'}". Cache moths inspect it; no script executes.`);
  return withMetrics(state);
}

export function runScenario(seed = 'morning-ryo', sequence: ActionId[] = ['release-canary-wasps', 'seal-queue', 'compost-tokens', 'open-migration-corridor', 'negotiate-with-swarm']): SwarmState {
  return sequence.reduce((state, action) => applyAction(state, action), createSwarmBox(seed));
}

export function exportSnapshot(state: SwarmState): ExportedSwarmSnapshot {
  return {
    seed: state.seed,
    tick: state.tick,
    actions: state.actions,
    ecosystemStability: state.ecosystemStability,
    repairProgress: state.repairProgress,
    swarmWill: state.swarmWill,
    ending: state.ending,
    services: state.services.map(({ id, health, pressure, symptom }) => ({ id, health, pressure, symptom })),
    swarms: state.swarms.map(({ id, kind, population, from, to, intent, aggression, mutation, note }) => ({ id, kind, population, from, to, intent, aggression, mutation, note })),
    relations: state.relations,
    logs: state.logs.slice(0, 14),
    weirdInputs: state.weirdInputs,
  };
}

export function isActionId(value: string): value is ActionId {
  return actions.includes(value as ActionId);
}
