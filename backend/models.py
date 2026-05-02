from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    success: bool
    message: str = ""


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


class LoginSettingsResponse(BaseModel):
    host: str
    username: str
    password: str = ""
    remember_password: bool = False
    auto_login: bool = False


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
    offer: ControlSessionDescription


class TankTroubleRoomRequest(BaseModel):
    room: str = "main"
    player_id: str
    country_code: str = ""


class TankTroubleRoomState(BaseModel):
    ok: bool = True
    room: str = "main"
    map_seed: int
    map_id: str
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
    active: bool = False


class TankTroublePreviewRect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class TankTroublePreviewTankState(BaseModel):
    id: str
    color: str = "green"
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0


class TankTroublePreviewBulletState(BaseModel):
    id: int
    color: str = "green"
    x: float
    y: float
    radius: float


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


class TankTroublePreviewSceneState(BaseModel):
    theme: str = "dark"
    mapTag: str = ""
    elapsedMs: int = 0
    walls: List[TankTroublePreviewRect] = Field(default_factory=list)
    tanks: List[TankTroublePreviewTankState] = Field(default_factory=list)
    bullets: List[TankTroublePreviewBulletState] = Field(default_factory=list)
    targets: List[TankTroublePreviewTargetState] = Field(default_factory=list)
    wallRipples: List[TankTroublePreviewRippleState] = Field(default_factory=list)
    bulletFades: List[TankTroublePreviewFadeState] = Field(default_factory=list)


class TankTroublePreviewPlayerSnapshot(BaseModel):
    color: str = "green"
    x: float
    y: float
    angle: float
    radius: float
    flash: float = 0.0
    shots: int = 0


class TankTroublePreviewPushRequest(BaseModel):
    session_id: str
    room: str = "main"
    player_id: str = ""
    country_code: str = ""
    snapshot_seq: int = 0
    tank: TankTroublePreviewPlayerSnapshot
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
