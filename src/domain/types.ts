export type ServiceId = 'auth' | 'queue' | 'billing' | 'images' | 'notifier' | 'ledger';

export type SwarmKind =
  | 'retry-larvae'
  | 'cache-moths'
  | 'token-aphids'
  | 'rollback-spores'
  | 'canary-wasps'
  | 'ledger-snails';

export type SwarmIntent = 'breed' | 'migrate' | 'compete' | 'hide' | 'repair' | 'feed';

export type ActionId =
  | 'seal-queue'
  | 'compost-tokens'
  | 'release-canary-wasps'
  | 'throttle-billing'
  | 'salt-cache'
  | 'open-migration-corridor'
  | 'negotiate-with-swarm';

export interface ServiceNode {
  id: ServiceId;
  label: string;
  health: number;
  pressure: number;
  x: number;
  y: number;
  symptom: string;
}

export interface Swarm {
  id: string;
  kind: SwarmKind;
  population: number;
  from: ServiceId;
  to: ServiceId;
  intent: SwarmIntent;
  aggression: number;
  mutation: number;
  color: string;
  note: string;
}

export interface SwarmRelation {
  a: SwarmKind;
  b: SwarmKind;
  relation: 'predates' | 'competes' | 'symbiosis' | 'ignores';
}

export interface SwarmState {
  seed: string;
  tick: number;
  services: ServiceNode[];
  swarms: Swarm[];
  relations: SwarmRelation[];
  actions: ActionId[];
  logs: string[];
  ecosystemStability: number;
  repairProgress: number;
  swarmWill: string;
  ending: string;
  weirdInputs: string[];
}

export interface ExportedSwarmSnapshot {
  seed: string;
  tick: number;
  actions: ActionId[];
  ecosystemStability: number;
  repairProgress: number;
  swarmWill: string;
  ending: string;
  services: Array<Pick<ServiceNode, 'id' | 'health' | 'pressure' | 'symptom'>>;
  swarms: Array<Omit<Swarm, 'color'>>;
  relations: SwarmRelation[];
  logs: string[];
  weirdInputs: string[];
}
