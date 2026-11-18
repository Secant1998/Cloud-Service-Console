from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    success: bool
    message: str = ""


class AccountLoginRequest(BaseModel):
    username: str
    password: str = ""
    remember_device: bool = False


class AccountRegisterRequest(BaseModel):
    username: str
    password: str
    remember_device: bool = False


class AccountDeviceLoginRequest(BaseModel):
    device_token: str


class AccountAvatarRequest(BaseModel):
    data_url: str


class AccountAvatarResponse(BaseModel):
    success: bool = True
    avatar_data_url: str


class AccountSessionResponse(BaseModel):
    success: bool = True
    session_token: str
    device_token: str = ""
    username: str
    role: str
    admin: bool = False
    avatar_data_url: str = ""


class AdminUserResponse(BaseModel):
    username: str
    role: str
    status: str = "active"
    created_at: str = ""
    online: bool = False
    last_seen_at: str = ""
    active_sessions: int = 0
    avatar_data_url: str = ""


class AdminUserListResponse(BaseModel):
    users: List[AdminUserResponse] = Field(default_factory=list)
    total: int = 0
    online: int = 0
    updated_at: str = ""


class AgentSettingsRequest(BaseModel):
    enabled: bool = False
    base_url: str
    model: str
    api_key: str = ""
    clear_api_key: bool = False


class AgentSettingsResponse(BaseModel):
    enabled: bool = False
    base_url: str
    model: str
    api_key_configured: bool = False
    api_key_hint: str = ""
    updated_at: str = ""
    updated_by: str = ""


class AgentConnectionTestResponse(BaseModel):
    success: bool
    message: str


class CaptureFileEntry(BaseModel):
    id: str
    filename: str
    stored_filename: str = ""
    kind: str = "capture"
    source: str = "unknown"
    session_id: str = ""
    room_id: str = ""
    node_id: str = ""
    content_type: str = "application/octet-stream"
    size_bytes: int = 0
    sha256: str = ""
    uploaded_at: str = ""
    started_at_server_ms: float | None = None
    stopped_at_server_ms: float | None = None
    authoritative_started_at_server_ms: float | None = None
    authoritative_stopped_at_server_ms: float | None = None
    stop_requested_at_server_ms: float | None = None
    stop_received_at_server_ms: float | None = None
    stop_authority: str | None = None
    sample_count: int | None = None
    sample_hz: float | None = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CaptureFileListResponse(BaseModel):
    files: List[CaptureFileEntry] = Field(default_factory=list)
    total: int = 0
    total_bytes: int = 0
    updated_at: str = ""


class CaptureUploadResponse(BaseModel):
    success: bool = True
    file: CaptureFileEntry


class LoginRequest(BaseModel):
    host: str
    username: str
    password: str
    remember_password: bool = False
    auto_login: bool = False


class SettingsRequest(BaseModel):
    host: str
    username: str
    password: Optional[str] = None
    remember_password: bool = False
    auto_login: bool = False


class SavedLoginAccountResponse(BaseModel):
    host: str
    username: str
    password: str = ""
    remember_password: bool = False
    auto_login: bool = False


class LoginSettingsResponse(BaseModel):
    host: str
    username: str
    password: str = ""
    remember_password: bool = False
    auto_login: bool = False
    saved_accounts: List[SavedLoginAccountResponse] = Field(default_factory=list)


class ServiceStatus(BaseModel):
    name: str
    title: str
    description: str
    running: bool
    pid: Optional[str] = None
    status: str
    active_state: str
    sub_state: str
    unit_state: str
    detail: str = ""


class HealthCheckStatus(BaseModel):
    key: str
    title: str
    description: str
    ok: bool
    note: str
    status: str


class PortStatus(BaseModel):
    key: str
    title: str
    port: int
    protocol: str
    listening: bool
    checked: bool = False


class PortChecksResponse(BaseModel):
    port_checks: List[PortStatus] = Field(default_factory=list)


class NetworkEndpointStatus(BaseModel):
    ip: str = "-"
    location: str = "-"
    country_code: str = ""


class NetworkSnapshot(BaseModel):
    local: NetworkEndpointStatus = Field(default_factory=NetworkEndpointStatus)
    server: NetworkEndpointStatus = Field(default_factory=NetworkEndpointStatus)
    last_checked: str = "never"


class TrafficServiceStatus(BaseModel):
    name: str
    title: str
    running: bool = False


class TrafficInterfaceStatus(BaseModel):
    name: str
    rx_bytes: int = 0
    tx_bytes: int = 0
    speed_mbps: Optional[float] = None


class TrafficMonitorSnapshot(BaseModel):
    connected: bool = False
    timestamp: str = ""
    timestamp_ms: int = 0
    rx_bytes: int = 0
    tx_bytes: int = 0
    rx_bps: float = 0.0
    tx_bps: float = 0.0
    total_bps: float = 0.0
    capacity_bps: Optional[float] = None
    capacity_source: str = ""
    utilization_percent: Optional[float] = None
    congestion_level: str = "unknown"
    congestion_note: str = "等待流量采样"
    active_services: int = 0
    monitored_services: int = 0
    cpu_percent: Optional[float] = None
    cpu_core_count: Optional[int] = None
    memory_percent: Optional[float] = None
    memory_used_mb: Optional[float] = None
    memory_total_mb: Optional[float] = None
    load_1m: Optional[float] = None
    load_5m: Optional[float] = None
    load_15m: Optional[float] = None
    disk_percent: Optional[float] = None
    disk_used_gb: Optional[float] = None
    disk_total_gb: Optional[float] = None
    uptime_seconds: Optional[float] = None
    interfaces: List[TrafficInterfaceStatus] = Field(default_factory=list)
    services: List[TrafficServiceStatus] = Field(default_factory=list)
    error: str = ""


class DashboardStatus(BaseModel):
    connected: bool
    ssh_target: str
    public_base_url: str
    ingest_mode: str = "unknown"
    pending_offers: int | str
    service_running_count: str
    health_ok_count: str
    last_refresh: str
    summary_status: str
    config_path: str
    services: List[ServiceStatus] = Field(default_factory=list)
    health_checks: List[HealthCheckStatus] = Field(default_factory=list)
    port_checks: List[PortStatus] = Field(default_factory=list)
    network_snapshot: NetworkSnapshot = Field(default_factory=NetworkSnapshot)
    broker_status: Optional[Dict[str, Any]] = None


class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str


class LogsResponse(BaseModel):
    logs: List[LogEntry] = Field(default_factory=list)


class LocalSetupStatus(BaseModel):
    ready: bool
    message: str


class LocalSetupResult(BaseModel):
    ready: bool
    changed: bool = False
    message: str


class LocalSetupRunRequest(BaseModel):
    password: str


class LocalStreamCamera(BaseModel):
    id: str
    name: str
    source: str = ""
    status: str = ""


class LocalStreamConfig(BaseModel):
    stream_name: str = "main-camera"
    use_current_server: bool = True
    cloud_public_scheme: str = "http"
    cloud_public_host: str = ""
    cloud_api_port: int = 18081
    cloud_ingest_port: int = 18084
    cloud_srt_ingest_port: int = 19091
    cloud_webrtc_port: int = 19090
    camera_name: str = ""
    camera_device: str = ""
    input_format: str = ""
    video_size: str = "1920x1080"
    output_video_size: str = "1920x1080"
    input_framerate: int = 30
    target_framerate: int = 30
    video_bitrate: str = "1800k"
    ffmpeg_path: str = "ffmpeg"
    open_viewer_on_start: bool = False
    hidden_delay_marker_enabled: bool = False
    video_encoder: str = "libx264"
    ingest_mode: str = "srt"
    srt_latency_ms: int = 1000
    srt_packet_size: int = 1128
    connect_timeout_ms: int = 3000
    drop_late_packets: bool = False


class LocalStreamStatus(BaseModel):
    camera_connected: bool = False
    cameras: List[LocalStreamCamera] = Field(default_factory=list)
    running: bool = False
    pid: Optional[int] = None
    config: LocalStreamConfig = Field(default_factory=LocalStreamConfig)
    target_url: str = ""
    ffmpeg_available: bool = False
    server_reachable: bool = False
    server_note: str = ""
    local_stream_ready: bool = False
    local_stream_note: str = ""
    push_visible: bool = False
    push_note: str = ""
    pull_reachable: bool = False
    pull_note: str = ""
    log_tail: str = ""
    message: str = ""
    updated_at: str = ""


class P2PLocalPusherStatus(BaseModel):
    available: bool = False
    running: bool = False
    pid: Optional[int] = None
    project_path: str = ""
    config_path: str = ""
    room_id: str = "robot"
    watch_url: str = ""
    active_profile: Dict[str, Any] = Field(default_factory=dict)
    log_tail: str = ""
    message: str = ""
    updated_at: str = ""


class TankTroubleSetupStatus(BaseModel):
    ready: bool
    message: str


class TankTroubleSetupResult(BaseModel):
    ready: bool
    changed: bool = False
    message: str


class IngestModeSwitchRequest(BaseModel):
    target_mode: str


class IngestModeResult(BaseModel):
    ingest_mode: str
    changed: bool = False
    message: str


class ControlSessionDescription(BaseModel):
    sdp: str
    type: str


class ControlMonitorConfigResponse(BaseModel):
    session: str
    poll_interval_sec: float
    turn_urls: List[str] = Field(default_factory=list)
    turn_username: str = ""
    turn_credential: str = ""


class ControlMonitorOfferResponse(BaseModel):
    ok: bool = True
    session: str
    offerId: str
    createdAt: str
    clientId: str = ""
    frontendClientId: str = ""
    computeClientId: str = ""
    robotClientId: str = ""
    offer: ControlSessionDescription


class ControlMonitorKeyClientState(BaseModel):
    clientId: str
    firstSeenAt: str = ""
    firstSeenOrder: int = 0
    updatedAt: str = ""
    ageMs: int = 0
    latencyMs: Optional[int] = None
    latencySource: str = ""
    updateCount: int = 0
    seq: Any = None
    sequence: Any = None
    ts: Any = None
    timestamp: Any = None
    sampledAt: Any = None
    type: str = ""
    inputMode: str = ""
    callState: str = ""
    pressedKeys: List[str] = Field(default_factory=list)


class ControlMonitorLinkStatus(BaseModel):
    frontendDialing: bool = False
    backendListening: bool = False
    directConnected: bool = False
    frontendLatencyMs: Optional[int] = None
    frontendLatencySource: str = ""
    backendLatencyMs: Optional[int] = None
    backendLatencySource: str = ""
    directLatencyMs: Optional[int] = None
    directLatencySource: str = ""
    pendingOffers: int = 0
    userPendingOffers: int = 0
    internalPendingOffers: int = 0
    browserPosts: int = 0
    robotPolls: int = 0
    frontendPosts: int = 0
    computePolls: int = 0
    answersPosted: int = 0
    activeClientCount: int = 0
    dialingClientCount: int = 0
    connectedClientCount: int = 0
    robotPollFreshMs: int = 5000
    robotPollAgeMs: Optional[int] = None
    signalPairFreshMs: int = 15000
    signalPairAgeMs: Optional[int] = None
    signalPaired: bool = False
    inferredDirectConnected: bool = False
    robotListenerClientId: str = ""
    computeListenerClientId: str = ""
    robotListenerFreshMs: int = 10000
    robotListenerAgeMs: Optional[int] = None
    robotListenerLatencyMs: Optional[int] = None
    robotListenerLatencySource: str = ""
    robotListenerLatencyUpdatedAt: Optional[str] = None
    robotListenerConflictCount: int = 0
    lastRobotListenerAt: Optional[str] = None
    lastBrowserOfferAt: Optional[str] = None
    lastRobotPollAt: Optional[str] = None
    lastFrontendOfferAt: Optional[str] = None
    lastComputePollAt: Optional[str] = None
    lastAnswerAt: Optional[str] = None
    source: str = ""


class ControlMonitorKeyStateResponse(BaseModel):
    ok: bool = True
    session: str
    ttlSec: float = 1.2
    clientCount: int = 0
    totalUpdates: int = 0
    lastUpdateAt: Optional[str] = None
    serverTime: str = ""
    clients: List[ControlMonitorKeyClientState] = Field(default_factory=list)
    linkStatus: ControlMonitorLinkStatus = Field(default_factory=ControlMonitorLinkStatus)
    commandLinkStatus: ControlMonitorLinkStatus = Field(default_factory=ControlMonitorLinkStatus)


class TankTroubleRoomRequest(BaseModel):
    room: str = "main"
    player_id: str
    country_code: str = ""
    preferred_color: str = ""


class TankTroubleRoomStatusRequest(BaseModel):
    room: str = "main"


class TankTroublePageUrlResponse(BaseModel):
    ok: bool = True
    room: str = "main"
    url: str


class TankTroubleRoomPlayerState(BaseModel):
    player_id: str
    country_code: str = ""
    color: str = "green"
    score: int = 0
    hits: int = 0
    deaths: int = 0
    latency_ms: int = 0
    connected: bool = True
    voted: bool = False


class TankTroubleVoteMarker(BaseModel):
    player_id: str
    country_code: str = ""
    color: str = "green"


class TankTroubleCustomOptions(BaseModel):
    health_system: bool = False
    persistent_buffs: bool = False
    same_place_respawn: bool = False


class TankTroubleRoomState(BaseModel):
    ok: bool = True
    room: str = "main"
    map_seed: int
    map_id: str
    match_mode: str = "default"
    custom_options: TankTroubleCustomOptions = Field(default_factory=TankTroubleCustomOptions)
    match_mode_owner_id: str = ""
    mode_locked: bool = False
    active_player_ids: List[str] = Field(default_factory=list)
    active_player_count: int = 0
    voted_player_ids: List[str] = Field(default_factory=list)
    vote_count: int = 0
    vote_required: int = 0
    countdown_seconds: int = 0
    countdown_active: bool = False
    countdown_deadline_ms: int = 0
    local_player_voted: bool = False
    local_player_color: str = "green"
    local_player_present: bool = False
    active_players: List[TankTroubleRoomPlayerState] = Field(default_factory=list)
    voters: List[TankTroubleVoteMarker] = Field(default_factory=list)
    occupied_colors: List[str] = Field(default_factory=list)
    available_colors: List[str] = Field(default_factory=list)
    room_full: bool = False
    updated_at_ms: int = 0


class TankTroubleMatchInputState(BaseModel):
    forward: bool = False
    backward: bool = False
    left: bool = False
    right: bool = False
    fire_seq: int = 0
    fire_held: bool = False


class TankTroubleMatchLocalPlayerSyncState(BaseModel):
    x: float
    y: float
    angle: float
    radius: float = 20.0
    deaths: int = 0
    spawn_seq: int = 0


class TankTroubleMatchRequest(BaseModel):
    room: str = "main"
    player_id: str
    country_code: str = ""
    preferred_color: str = ""
    match_mode: str = "default"
    custom_options: TankTroubleCustomOptions = Field(default_factory=TankTroubleCustomOptions)
    input_seq: int = 0
    map_seed: int = 0
    latency_ms: int = 0
    input: TankTroubleMatchInputState = Field(default_factory=TankTroubleMatchInputState)
    local_player: TankTroubleMatchLocalPlayerSyncState | None = None


class TankTroubleMatchPlayerState(BaseModel):
    player_id: str
    country_code: str = ""
    color: str = "green"
    weapon: str = "default"
    shotgun_ammo: int = 0
    minigun_ammo: int = 0
    double_barrel_ammo: int = 0
    mine_ammo: int = 0
    missile_ammo: int = 0
    weapon_reload_ms: int = 0
    shield_active_ms: int = 0
    shield_visible_ms: int = 0
    shield_elapsed_ms: int = 0
    shield_radius: float = 0.0
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0
    hp: float = 100.0
    max_hp: float = 100.0
    score: int = 0
    hits: int = 0
    deaths: int = 0
    shots: int = 0
    alive: bool = True
    respawn_in_ms: int = 0
    spawn_seq: int = 0
    latency_ms: int = 0
    input: TankTroubleMatchInputState = Field(default_factory=TankTroubleMatchInputState)
    server_time_ms: int = 0


class TankTroubleMatchBulletState(BaseModel):
    id: int
    owner_id: str = ""
    color: str = "green"
    projectile_type: str = "bullet"
    x: float
    y: float
    radius: float
    vx: float = 0.0
    vy: float = 0.0
    life: float = 0.0
    age: float = 0.0
    bounces_left: int = 0
    has_bounced: bool = False
    owner_shield_released: bool = True
    ignore_owner_shield: bool = False
    fire_seq: int = 0
    target_id: str = ""
    target_color: str = ""
    flame_color: str = ""
    locked: bool = False
    steer_locked_until_age: float = 0.0
    wall_hit_seq: int = 0
    wall_hit_x: float = 0.0
    wall_hit_y: float = 0.0
    path_segments: List[dict] = Field(default_factory=list)
    distance_travelled: float = 0.0
    segments: List[dict] = Field(default_factory=list)
    server_time_ms: int = 0


class TankTroubleMineState(BaseModel):
    id: int
    owner_id: str = ""
    color: str = "green"
    x: float
    y: float
    radius: float
    trigger_radius: float
    blast_radius: float
    age: float = 0.0
    armed: bool = False
    triggered: bool = False
    trigger_started_at_ms: int = 0
    created_at_ms: int = 0
    server_time_ms: int = 0


class TankTroubleMatchTargetState(BaseModel):
    id: int
    x: float
    y: float
    radius: float
    phase: float = 0.0


class TankTroubleTankExplosionState(BaseModel):
    id: int
    x: float
    y: float
    radius: float
    color: str = "green"
    life: float
    maxLife: float
    seed: int = 0
    created_at_ms: int = 0
    killer_id: str = ""
    victim_id: str = ""
    killer_color: str = ""
    victim_color: str = ""
    weapon: str = "bullet"
    bullet_id: int = 0
    suicide: bool = False


class TankTroublePowerupState(BaseModel):
    id: int
    kind: str = "cash"
    color: str = "#9ca3af"
    symbol: str = "$"
    effect: str = "score"
    score_delta: int = 100
    x: float
    y: float
    radius: float
    phase: float = 0.0


class TankTroublePowerupEffectState(BaseModel):
    id: int
    powerup_id: int = 0
    player_id: str = ""
    kind: str = "cash"
    color: str = "#9ca3af"
    symbol: str = "$"
    effect: str = "score"
    score_delta: int = 100
    x: float
    y: float
    radius: float
    created_at_ms: int = 0


class TankTroubleMatchLocalState(BaseModel):
    player_id: str
    country_code: str = ""
    color: str = "green"
    weapon: str = "default"
    shotgun_ammo: int = 0
    minigun_ammo: int = 0
    double_barrel_ammo: int = 0
    mine_ammo: int = 0
    missile_ammo: int = 0
    weapon_reload_ms: int = 0
    shield_active_ms: int = 0
    shield_visible_ms: int = 0
    shield_elapsed_ms: int = 0
    shield_radius: float = 0.0
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0
    hp: float = 100.0
    max_hp: float = 100.0
    score: int = 0
    hits: int = 0
    deaths: int = 0
    shots: int = 0
    fire_ack_seq: int = 0
    alive: bool = True
    respawn_in_ms: int = 0
    spawn_seq: int = 0
    latency_ms: int = 0
    server_time_ms: int = 0


class TankTroubleMatchState(BaseModel):
    ok: bool = True
    room: str = "main"
    map_seed: int
    map_id: str
    snapshot_seq: int = 0
    ack_input_seq: int = 0
    local_player_color: str = "green"
    local_state: TankTroubleMatchLocalState | None = None
    local_player_voted: bool = False
    match_mode: str = "default"
    custom_options: TankTroubleCustomOptions = Field(default_factory=TankTroubleCustomOptions)
    match_mode_owner_id: str = ""
    mode_locked: bool = False
    active_player_ids: List[str] = Field(default_factory=list)
    active_player_count: int = 0
    active_players: List[TankTroubleRoomPlayerState] = Field(default_factory=list)
    players: List[TankTroubleMatchPlayerState] = Field(default_factory=list)
    bullets: List[TankTroubleMatchBulletState] = Field(default_factory=list)
    mines: List[TankTroubleMineState] = Field(default_factory=list)
    targets: List[TankTroubleMatchTargetState] = Field(default_factory=list)
    tank_explosions: List[TankTroubleTankExplosionState] = Field(default_factory=list)
    powerups: List[TankTroublePowerupState] = Field(default_factory=list)
    powerup_effects: List[TankTroublePowerupEffectState] = Field(default_factory=list)
    voters: List[TankTroubleVoteMarker] = Field(default_factory=list)
    vote_count: int = 0
    vote_required: int = 0
    countdown_seconds: int = 0
    countdown_active: bool = False
    countdown_deadline_ms: int = 0
    occupied_colors: List[str] = Field(default_factory=list)
    available_colors: List[str] = Field(default_factory=list)
    room_full: bool = False
    updated_at_ms: int = 0


class TankTroubleLatencyInputState(BaseModel):
    forward: bool = False
    backward: bool = False
    left: bool = False
    right: bool = False
    fire_seq: int = 0
    clone_hit_seq: int = 0


class TankTroubleLatencyPlayerState(BaseModel):
    x: float
    y: float
    angle: float
    radius: float


class TankTroubleLatencyTargetState(BaseModel):
    id: int
    x: float
    y: float
    radius: float
    phase: float = 0.0


class TankTroubleLatencyRequest(BaseModel):
    room: str = "main"
    player_id: str
    country_code: str = ""
    map_seed: int
    local_color: str = "green"
    input_seq: int = 0
    local_player: TankTroubleLatencyPlayerState
    targets: List[TankTroubleLatencyTargetState] = Field(default_factory=list)
    input: TankTroubleLatencyInputState = Field(default_factory=TankTroubleLatencyInputState)


class TankTroubleLatencyBulletState(BaseModel):
    id: int
    x: float
    y: float
    radius: float


class TankTroubleLatencyFireEvent(BaseModel):
    id: int
    x: float
    y: float
    angle: float
    speed: float
    radius: float = 5.0


class TankTroubleLatencyCloneState(BaseModel):
    player_id: str = "RelayBot"
    country_code: str = "US"
    color: str = "red"
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0


class TankTroubleLatencyTargetRespawn(BaseModel):
    id: int
    x: float
    y: float
    phase: float = 0.0


class TankTroubleLatencyState(BaseModel):
    ok: bool = True
    room: str = "main"
    ack_input_seq: int = 0
    snapshot_seq: int = 0
    clone: TankTroubleLatencyCloneState
    clone_input: TankTroubleLatencyInputState = Field(default_factory=TankTroubleLatencyInputState)
    fire_events: List[TankTroubleLatencyFireEvent] = Field(default_factory=list)
    clone_reset_seq: int = 0
    bullets: List[TankTroubleLatencyBulletState] = Field(default_factory=list)
    target_respawns: List[TankTroubleLatencyTargetRespawn] = Field(default_factory=list)
    local_player_hit_seq: int = 0
    clone_hit_ack_seq: int = 0
    updated_at_ms: int = 0


class TankTroublePreviewRow(BaseModel):
    rank: int = 1
    player_id: str = "--"
    country_code: str = ""
    score: int = 0
    latency_ms: int = 0
    active: bool = False


class TankTroublePreviewRect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class TankTroublePreviewTankState(BaseModel):
    id: str
    color: str = "green"
    weapon: str = "default"
    shotgun_ammo: int = 0
    minigun_ammo: int = 0
    double_barrel_ammo: int = 0
    mine_ammo: int = 0
    missile_ammo: int = 0
    weapon_reload_ms: int = 0
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0
    hp: float = 100.0
    max_hp: float = 100.0


class TankTroublePreviewBulletState(BaseModel):
    id: int
    color: str = "green"
    projectile_type: str = "bullet"
    x: float
    y: float
    radius: float
    vx: float = 0.0
    vy: float = 0.0
    bounces_left: int = 0
    has_bounced: bool = False
    owner_shield_released: bool = True
    ignore_owner_shield: bool = False
    target_id: str = ""
    target_color: str = ""
    flame_color: str = ""
    locked: bool = False
    steer_locked_until_age: float = 0.0
    wall_hit_seq: int = 0
    wall_hit_x: float = 0.0
    wall_hit_y: float = 0.0
    path_segments: List[dict] = Field(default_factory=list)
    distance_travelled: float = 0.0
    segments: List[dict] = Field(default_factory=list)


class TankTroublePreviewTargetState(BaseModel):
    id: int
    x: float
    y: float
    radius: float
    phase: float = 0.0


class TankTroublePreviewRippleState(BaseModel):
    id: int
    x: float
    y: float
    color: str = "green"
    life: float
    maxLife: float
    wall: TankTroublePreviewRect


class TankTroublePreviewFadeState(BaseModel):
    id: int
    x: float
    y: float
    radius: float
    life: float
    maxLife: float
    color: str = "green"
    projectileType: str = "bullet"
    targetColor: str = ""


class TankTroublePreviewSceneState(BaseModel):
    theme: str = "dark"
    mapTag: str = ""
    elapsedMs: int = 0
    walls: List[TankTroublePreviewRect] = Field(default_factory=list)
    tanks: List[TankTroublePreviewTankState] = Field(default_factory=list)
    bullets: List[TankTroublePreviewBulletState] = Field(default_factory=list)
    targets: List[TankTroublePreviewTargetState] = Field(default_factory=list)
    mines: List["TankTroubleMineState"] = Field(default_factory=list)
    tankExplosions: List[TankTroubleTankExplosionState] = Field(default_factory=list)
    wallRipples: List[TankTroublePreviewRippleState] = Field(default_factory=list)
    bulletFades: List[TankTroublePreviewFadeState] = Field(default_factory=list)


class TankTroublePreviewPlayerSnapshot(BaseModel):
    color: str = "green"
    weapon: str = "default"
    shotgun_ammo: int = 0
    minigun_ammo: int = 0
    double_barrel_ammo: int = 0
    mine_ammo: int = 0
    missile_ammo: int = 0
    weapon_reload_ms: int = 0
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0
    hp: float = 100.0
    max_hp: float = 100.0
    shots: int = 0
    score: int = 0
    hits: int = 0


class TankTroublePreviewPushRequest(BaseModel):
    session_id: str
    room: str = "main"
    player_id: str = ""
    country_code: str = ""
    latency_ms: int = 0
    snapshot_seq: int = 0
    authoritative_scene: bool = False
    theme: str = "dark"
    tank: TankTroublePreviewPlayerSnapshot
    bullets: List[TankTroublePreviewBulletState] = Field(default_factory=list)
    targets: List[TankTroublePreviewTargetState] = Field(default_factory=list)
    mines: List["TankTroubleMineState"] = Field(default_factory=list)
    tankExplosions: List[TankTroubleTankExplosionState] = Field(default_factory=list)
    updated_at_ms: int = 0


class TankTroublePreviewClearRequest(BaseModel):
    session_id: str = ""


class TankTroublePreviewState(BaseModel):
    active: bool = False
    frame_seq: int = 0
    session_id: str = ""
    player_id: str = ""
    map_id: str = ""
    map_label: str = ""
    runtime_summary: str = ""
    rows: List[TankTroublePreviewRow] = Field(default_factory=list)
    scene: TankTroublePreviewSceneState = Field(default_factory=TankTroublePreviewSceneState)
    updated_at_ms: int = 0
