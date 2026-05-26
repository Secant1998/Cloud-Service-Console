export type LoginRequest = {
  host: string;
  username: string;
  password: string;
  remember_password: boolean;
  auto_login: boolean;
};

export type SavedLoginAccount = {
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
  clientId?: string;
  frontendClientId?: string;
  robotClientId?: string;
  offer: ControlSessionDescription;
};

export type ControlMonitorKeyClientState = {
  clientId: string;
  firstSeenAt?: string;
  firstSeenOrder?: number;
  updatedAt: string;
  ageMs: number;
  latencyMs?: number | null;
  latencySource?: string;
  updateCount: number;
  seq?: unknown;
  sequence?: unknown;
  ts?: unknown;
  timestamp?: unknown;
  sampledAt?: unknown;
  type: string;
  inputMode?: string;
  callState: string;
  pressedKeys: string[];
};

export type ControlMonitorLinkStatus = {
  frontendDialing: boolean;
  backendListening: boolean;
  directConnected: boolean;
  frontendLatencyMs?: number | null;
  frontendLatencySource?: string;
  backendLatencyMs?: number | null;
  backendLatencySource?: string;
  directLatencyMs?: number | null;
  directLatencySource?: string;
  pendingOffers: number;
  userPendingOffers?: number;
  internalPendingOffers?: number;
  browserPosts: number;
  robotPolls: number;
  answersPosted: number;
  activeClientCount: number;
  dialingClientCount: number;
  connectedClientCount: number;
  robotPollFreshMs: number;
  robotPollAgeMs?: number | null;
  signalPairFreshMs?: number;
  signalPairAgeMs?: number | null;
  signalPaired?: boolean;
  inferredDirectConnected?: boolean;
  robotListenerClientId?: string;
  robotListenerFreshMs?: number;
  robotListenerAgeMs?: number | null;
  robotListenerLatencyMs?: number | null;
  robotListenerLatencySource?: string;
  robotListenerLatencyUpdatedAt?: string | null;
  robotListenerConflictCount?: number;
  lastRobotListenerAt?: string | null;
  lastBrowserOfferAt?: string | null;
  lastRobotPollAt?: string | null;
  lastAnswerAt?: string | null;
  source?: string;
};

export type ControlMonitorKeyState = {
  ok: boolean;
  session: string;
  ttlSec: number;
  clientCount: number;
  totalUpdates: number;
  lastUpdateAt?: string | null;
  serverTime: string;
  clients: ControlMonitorKeyClientState[];
  linkStatus: ControlMonitorLinkStatus;
  commandLinkStatus?: ControlMonitorLinkStatus;
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

export type TankTroubleCustomOptions = {
  health_system: boolean;
  persistent_buffs: boolean;
  same_place_respawn: boolean;
};

export type TankTroubleRoomState = {
  ok: boolean;
  room: string;
  map_seed: number;
  map_id: string;
  match_mode?: "default" | "custom" | string;
  custom_options?: TankTroubleCustomOptions;
  match_mode_owner_id?: string;
  mode_locked?: boolean;
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
  deaths?: number;
  spawn_seq?: number;
};

export type TankTroubleMatchRequest = {
  room: string;
  player_id: string;
  country_code?: string;
  preferred_color?: string;
  match_mode?: "default" | "custom" | string;
  custom_options?: TankTroubleCustomOptions;
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
  mine_ammo?: number;
  missile_ammo?: number;
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
  hp?: number;
  max_hp?: number;
  score: number;
  hits: number;
  deaths: number;
  shots: number;
  alive: boolean;
  respawn_in_ms: number;
  spawn_seq?: number;
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
  ignore_owner_shield?: boolean;
  fire_seq?: number;
  target_id?: string;
  target_color?: string;
  flame_color?: string;
  locked?: boolean;
  steer_locked_until_age?: number;
  wall_hit_seq?: number;
  wall_hit_x?: number;
  wall_hit_y?: number;
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

export type TankTroubleMineState = {
  id: number;
  owner_id: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  trigger_radius: number;
  blast_radius: number;
  age: number;
  armed: boolean;
  triggered: boolean;
  trigger_started_at_ms?: number;
  created_at_ms: number;
  fire_seq?: number;
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
  mine_ammo?: number;
  missile_ammo?: number;
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
  hp?: number;
  max_hp?: number;
  score: number;
  hits: number;
  deaths: number;
  shots: number;
  fire_ack_seq?: number;
  alive: boolean;
  respawn_in_ms: number;
  spawn_seq?: number;
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
  match_mode?: "default" | "custom" | string;
  custom_options?: TankTroubleCustomOptions;
  match_mode_owner_id?: string;
  mode_locked?: boolean;
  active_player_ids: string[];
  active_player_count: number;
  active_players: TankTroubleRoomPlayerState[];
  players: TankTroubleMatchPlayerState[];
  bullets: TankTroubleMatchBulletState[];
  mines?: TankTroubleMineState[];
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
  hp?: number;
  max_hp?: number;
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
  mine_ammo?: number;
  missile_ammo?: number;
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
  owner_shield_released?: boolean;
  ignore_owner_shield?: boolean;
  target_id?: string;
  target_color?: string;
  flame_color?: string;
  locked?: boolean;
  steer_locked_until_age?: number;
  wall_hit_seq?: number;
  wall_hit_x?: number;
  wall_hit_y?: number;
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
  projectileType?: string;
  targetColor?: string;
};

export type TankTroublePreviewSceneState = {
  theme: "light" | "dark";
  mapTag: string;
  elapsedMs: number;
  walls: TankTroublePreviewRect[];
  tanks: TankTroublePreviewTankState[];
  bullets: TankTroublePreviewBulletState[];
  targets: TankTroublePreviewTargetState[];
  mines: TankTroubleMineState[];
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
  mine_ammo?: number;
  missile_ammo?: number;
  weapon_reload_ms?: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  flash: number;
  hp?: number;
  max_hp?: number;
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
  mines: TankTroubleMineState[];
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
  saved_accounts: SavedLoginAccount[];
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

export type TrafficServiceStatus = {
  name: string;
  title: string;
  running: boolean;
};

export type TrafficInterfaceStatus = {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  speed_mbps?: number | null;
};

export type TrafficMonitorSnapshot = {
  connected: boolean;
  timestamp: string;
  timestamp_ms: number;
  rx_bytes: number;
  tx_bytes: number;
  rx_bps: number;
  tx_bps: number;
  total_bps: number;
  capacity_bps?: number | null;
  capacity_source: string;
  utilization_percent?: number | null;
  congestion_level: "idle" | "good" | "warning" | "danger" | "unknown" | string;
  congestion_note: string;
  active_services: number;
  monitored_services: number;
  cpu_percent?: number | null;
  cpu_core_count?: number | null;
  memory_percent?: number | null;
  memory_used_mb?: number | null;
  memory_total_mb?: number | null;
  load_1m?: number | null;
  load_5m?: number | null;
  load_15m?: number | null;
  disk_percent?: number | null;
  disk_used_gb?: number | null;
  disk_total_gb?: number | null;
  uptime_seconds?: number | null;
  interfaces: TrafficInterfaceStatus[];
  services: TrafficServiceStatus[];
  error: string;
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

export type VideoPushModeStatus = {
  live?: boolean;
  state?: string;
  streamName?: string;
  lastHeartbeatAt?: string | null;
  heartbeatAgeSec?: number | null;
  heartbeatIntervalSec?: number | null;
  staleAfterSec?: number | null;
  statusReason?: string | null;
  producerVisible?: boolean;
  encoderDisplay?: string | null;
  encoderName?: string | null;
  ingestMode?: string | null;
  uploadProtocol?: string | null;
  playUrl?: string;
  pushUrlHost?: string;
  source?: string;
  clientId?: string;
  stoppedAt?: string | null;
};

export type VideoPushStatus = {
  ok?: boolean;
  activeMode?: "offline" | "legacy" | "tencent" | string;
  conflict?: boolean;
  availableModes?: string[];
  legacy?: VideoPushModeStatus;
  tencent?: VideoPushModeStatus;
  serverTime?: string;
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

export type LocalStreamCamera = {
  id: string;
  name: string;
  source: string;
  status: string;
};

export type LocalStreamConfig = {
  stream_name: string;
  use_current_server: boolean;
  cloud_public_scheme: string;
  cloud_public_host: string;
  cloud_api_port: number;
  cloud_ingest_port: number;
  cloud_srt_ingest_port: number;
  cloud_webrtc_port: number;
  camera_name: string;
  camera_device: string;
  input_format: string;
  video_size: string;
  output_video_size: string;
  input_framerate: number;
  target_framerate: number;
  video_bitrate: string;
  ffmpeg_path: string;
  open_viewer_on_start: boolean;
  hidden_delay_marker_enabled: boolean;
  video_encoder: string;
  ingest_mode: string;
  srt_latency_ms: number;
  srt_packet_size: number;
  connect_timeout_ms: number;
  drop_late_packets: boolean;
};

export type LocalStreamStatus = {
  camera_connected: boolean;
  cameras: LocalStreamCamera[];
  running: boolean;
  pid?: number | null;
  config: LocalStreamConfig;
  target_url: string;
  ffmpeg_available: boolean;
  server_reachable: boolean;
  server_note: string;
  local_stream_ready: boolean;
  local_stream_note: string;
  push_visible: boolean;
  push_note: string;
  pull_reachable: boolean;
  pull_note: string;
  log_tail: string;
  message: string;
  updated_at: string;
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
