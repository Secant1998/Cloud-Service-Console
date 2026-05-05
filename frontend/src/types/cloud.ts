export type LoginRequest = {
  host: string;
  username: string;
  password: string;
  remember_password: boolean;
  auto_login: boolean;
};

export type SettingsRequest = {
  host: string;
  username: string;
  password?: string;
  remember_password: boolean;
  auto_login: boolean;
};

export type ApiResponse = {
  success: boolean;
  message: string;
};

export type IngestModeSwitchRequest = {
  target_mode: string;
};

export type LocalSetupRunRequest = {
  password: string;
};

export type IngestModeResult = {
  ingest_mode: string;
  changed: boolean;
  message: string;
};

export type ControlSessionDescription = {
  sdp: string;
  type: string;
};

export type ControlMonitorConfig = {
  session: string;
  poll_interval_sec: number;
  turn_urls: string[];
  turn_username: string;
  turn_credential: string;
};

export type ControlMonitorOffer = {
  ok: boolean;
  session: string;
  offerId: string;
  createdAt: string;
  offer: ControlSessionDescription;
};

export type TankTroubleRoomRequest = {
  room: string;
  player_id: string;
  country_code?: string;
  preferred_color?: string;
};

export type TankTroubleRoomStatusRequest = {
  room: string;
};

export type TankTroublePageUrlResponse = {
  ok: boolean;
  room: string;
  url: string;
};

export type TankTroubleRoomPlayerState = {
  player_id: string;
  country_code: string;
  color: string;
  score: number;
  hits: number;
  deaths: number;
  latency_ms?: number;
  connected: boolean;
  voted: boolean;
};

export type TankTroubleVoteMarker = {
  player_id: string;
  country_code: string;
  color: string;
};

export type TankTroubleRoomState = {
  ok: boolean;
  room: string;
  map_seed: number;
  map_id: string;
  active_player_ids: string[];
  active_player_count: number;
  voted_player_ids: string[];
  vote_count: number;
  vote_required: number;
  countdown_seconds: number;
  countdown_active: boolean;
  countdown_deadline_ms: number;
  local_player_voted: boolean;
  local_player_color: string;
  local_player_present: boolean;
  active_players: TankTroubleRoomPlayerState[];
  voters: TankTroubleVoteMarker[];
  occupied_colors: string[];
  available_colors: string[];
  room_full: boolean;
  updated_at_ms: number;
};

export type TankTroubleMatchInputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fire_seq: number;
  fire_held?: boolean;
};

export type TankTroubleMatchLocalPlayerSyncState = {
  x: number;
  y: number;
  angle: number;
  radius: number;
};

export type TankTroubleMatchRequest = {
  room: string;
  player_id: string;
  country_code?: string;
  preferred_color?: string;
  input_seq: number;
  map_seed?: number;
  latency_ms?: number;
  input: TankTroubleMatchInputState;
  local_player?: TankTroubleMatchLocalPlayerSyncState;
};

export type TankTroubleMatchPlayerState = {
  player_id: string;
  country_code: string;
  color: string;
  weapon?: string;
  shotgun_ammo?: number;
  minigun_ammo?: number;
  double_barrel_ammo?: number;
  weapon_reload_ms?: number;
  shield_active_ms?: number;
  shield_visible_ms?: number;
  shield_elapsed_ms?: number;
  shield_radius?: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  flash: number;
  score: number;
  hits: number;
  deaths: number;
  shots: number;
  alive: boolean;
  respawn_in_ms: number;
  latency_ms?: number;
  input?: TankTroubleMatchInputState;
  server_time_ms?: number;
};

export type TankTroubleMatchBulletState = {
  id: number;
  owner_id: string;
  color: string;
  projectile_type?: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  life: number;
  age?: number;
  bounces_left?: number;
  has_bounced?: boolean;
  owner_shield_released?: boolean;
  path_segments?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  distance_travelled?: number;
  segments?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  server_time_ms?: number;
};

export type TankTroubleMatchTargetState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export type TankTroubleTankExplosionState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  seed?: number;
  created_at_ms?: number;
  killer_id?: string;
  victim_id?: string;
  killer_color?: string;
  victim_color?: string;
  weapon?: "bullet" | "suicide" | string;
  bullet_id?: number;
  suicide?: boolean;
};

export type TankTroublePowerupState = {
  id: number;
  kind: string;
  color: string;
  symbol: string;
  effect: string;
  score_delta: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export type TankTroublePowerupEffectState = {
  id: number;
  powerup_id: number;
  player_id: string;
  kind: string;
  color: string;
  symbol: string;
  effect?: string;
  score_delta: number;
  x: number;
  y: number;
  radius: number;
  created_at_ms: number;
};

export type TankTroubleMatchLocalState = {
  player_id: string;
  country_code: string;
  color: string;
  weapon?: string;
  shotgun_ammo?: number;
  minigun_ammo?: number;
  double_barrel_ammo?: number;
  weapon_reload_ms?: number;
  shield_active_ms?: number;
  shield_visible_ms?: number;
  shield_elapsed_ms?: number;
  shield_radius?: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  flash: number;
  score: number;
  hits: number;
  deaths: number;
  shots: number;
  fire_ack_seq?: number;
  alive: boolean;
  respawn_in_ms: number;
  latency_ms?: number;
  server_time_ms?: number;
};

export type TankTroubleMatchState = {
  ok: boolean;
  room: string;
  map_seed: number;
  map_id: string;
  snapshot_seq: number;
  ack_input_seq: number;
  local_player_color: string;
  local_state: TankTroubleMatchLocalState | null;
  local_player_voted: boolean;
  active_player_ids: string[];
  active_player_count: number;
  active_players: TankTroubleRoomPlayerState[];
  players: TankTroubleMatchPlayerState[];
  bullets: TankTroubleMatchBulletState[];
  targets: TankTroubleMatchTargetState[];
  tank_explosions?: TankTroubleTankExplosionState[];
  powerups?: TankTroublePowerupState[];
  powerup_effects?: TankTroublePowerupEffectState[];
  voters: TankTroubleVoteMarker[];
  vote_count: number;
  vote_required: number;
  countdown_seconds: number;
  countdown_active: boolean;
  countdown_deadline_ms: number;
  occupied_colors: string[];
  available_colors: string[];
  room_full: boolean;
  updated_at_ms: number;
};

export type TankTroubleLatencyInputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fire_seq: number;
  clone_hit_seq: number;
};

export type TankTroubleLatencyPlayerState = {
  x: number;
  y: number;
  angle: number;
  radius: number;
};

export type TankTroubleLatencyTargetState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export type TankTroubleLatencyRequest = {
  room: string;
  player_id: string;
  country_code?: string;
  map_seed: number;
  local_color: string;
  input_seq: number;
  local_player: TankTroubleLatencyPlayerState;
  targets: TankTroubleLatencyTargetState[];
  input: TankTroubleLatencyInputState;
};

export type TankTroubleLatencyBulletState = {
  id: number;
  x: number;
  y: number;
  radius: number;
};

export type TankTroubleLatencyFireEvent = {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  radius: number;
};

export type TankTroubleLatencyCloneState = {
  player_id: string;
  country_code: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  radius: number;
  flash: number;
};

export type TankTroubleLatencyTargetRespawn = {
  id: number;
  x: number;
  y: number;
  phase: number;
};

export type TankTroubleLatencyState = {
  ok: boolean;
  room: string;
  ack_input_seq: number;
  snapshot_seq: number;
  clone: TankTroubleLatencyCloneState;
  clone_input: TankTroubleLatencyInputState;
  fire_events: TankTroubleLatencyFireEvent[];
  clone_reset_seq: number;
  bullets: TankTroubleLatencyBulletState[];
  target_respawns: TankTroubleLatencyTargetRespawn[];
  local_player_hit_seq: number;
  clone_hit_ack_seq: number;
  updated_at_ms: number;
};

export type TankTroublePreviewRow = {
  rank: number;
  player_id: string;
  country_code: string;
  score: number;
  latency_ms?: number;
  active: boolean;
};

export type TankTroublePreviewRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TankTroublePreviewTankState = {
  id: string;
  color: string;
  weapon?: string;
  shotgun_ammo?: number;
  minigun_ammo?: number;
  double_barrel_ammo?: number;
  weapon_reload_ms?: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  flash: number;
};

export type TankTroublePreviewBulletState = {
  id: number;
  color: string;
  projectile_type?: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  bounces_left?: number;
  has_bounced?: boolean;
  path_segments?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  distance_travelled?: number;
  segments?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
};

export type TankTroublePreviewTargetState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export type TankTroublePreviewRippleState = {
  id: number;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  wall: TankTroublePreviewRect;
};

export type TankTroublePreviewFadeState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
};

export type TankTroublePreviewSceneState = {
  theme: "light" | "dark";
  mapTag: string;
  elapsedMs: number;
  walls: TankTroublePreviewRect[];
  tanks: TankTroublePreviewTankState[];
  bullets: TankTroublePreviewBulletState[];
  targets: TankTroublePreviewTargetState[];
  tankExplosions: TankTroubleTankExplosionState[];
  wallRipples: TankTroublePreviewRippleState[];
  bulletFades: TankTroublePreviewFadeState[];
};

export type TankTroublePreviewPlayerSnapshot = {
  color: string;
  weapon?: string;
  shotgun_ammo?: number;
  minigun_ammo?: number;
  double_barrel_ammo?: number;
  weapon_reload_ms?: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  flash: number;
  shots: number;
  score: number;
  hits: number;
};

export type TankTroublePreviewPushRequest = {
  session_id: string;
  room: string;
  player_id: string;
  country_code?: string;
  latency_ms?: number;
  snapshot_seq: number;
  authoritative_scene: boolean;
  theme: "light" | "dark";
  tank: TankTroublePreviewPlayerSnapshot;
  bullets: TankTroublePreviewBulletState[];
  targets: TankTroublePreviewTargetState[];
  tankExplosions?: TankTroubleTankExplosionState[];
  updated_at_ms: number;
};

export type TankTroublePreviewClearRequest = {
  session_id: string;
};

export type LoginSettings = {
  host: string;
  username: string;
  password: string;
  remember_password: boolean;
  auto_login: boolean;
};

export type ServiceStatus = {
  name: string;
  title: string;
  description: string;
  running: boolean;
  pid?: string | null;
  status: string;
  active_state: string;
  sub_state: string;
  unit_state: string;
  detail: string;
};

export type HealthCheckStatus = {
  key: string;
  title: string;
  description: string;
  ok: boolean;
  note: string;
  status: string;
};

export type PortStatus = {
  key: string;
  title: string;
  port: number;
  protocol: string;
  listening: boolean;
  checked: boolean;
};

export type PortChecksResponse = {
  port_checks: PortStatus[];
};

export type NetworkEndpointStatus = {
  ip: string;
  location: string;
  country_code: string;
};

export type NetworkSnapshot = {
  local: NetworkEndpointStatus;
  server: NetworkEndpointStatus;
  last_checked: string;
};

export type DashboardStatus = {
  connected: boolean;
  ssh_target: string;
  public_base_url: string;
  ingest_mode: string;
  pending_offers: number | string;
  service_running_count: string;
  health_ok_count: string;
  last_refresh: string;
  summary_status: string;
  config_path: string;
  services: ServiceStatus[];
  health_checks: HealthCheckStatus[];
  port_checks: PortStatus[];
  network_snapshot: NetworkSnapshot;
  broker_status?: Record<string, unknown> | null;
};

export type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
};

export type LogsResponse = {
  logs: LogEntry[];
};

export type LocalSetupStatus = {
  ready: boolean;
  message: string;
};

export type LocalSetupResult = {
  ready: boolean;
  changed: boolean;
  message: string;
};

export type TankTroubleSetupStatus = {
  ready: boolean;
  message: string;
};

export type TankTroubleSetupResult = {
  ready: boolean;
  changed: boolean;
  message: string;
};
