#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::HashMap,
    io::{self, Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::api::process::{Command, CommandChild, CommandEvent};
use tauri::{Manager, State};

const DEFAULT_BACKEND_HOST: &str = "127.0.0.1";
const DEFAULT_BACKEND_PORT: u16 = 8765;
const BACKEND_READY_TIMEOUT: Duration = Duration::from_secs(15);
const BACKEND_READY_INTERVAL: Duration = Duration::from_millis(250);
const BACKEND_STOP_TIMEOUT: Duration = Duration::from_secs(5);
const BACKEND_STOP_INTERVAL: Duration = Duration::from_millis(150);

struct BackendRuntime {
    base_url: String,
    port: Option<u16>,
    child: Option<CommandChild>,
}

struct BackendState(Mutex<BackendRuntime>);

fn terminate_backend_child(state: &BackendState) -> Result<Option<u16>, String> {
    let (child, port) = {
        let mut guard = state
            .0
            .lock()
            .map_err(|_| "backend state lock poisoned".to_string())?;
        (guard.child.take(), guard.port)
    };

    if let Some(child) = child {
        child
            .kill()
            .map_err(|error| format!("failed to terminate backend sidecar: {error}"))?;
    }

    Ok(port)
}

fn wait_for_backend_stop(port: u16) -> Result<(), String> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let start = Instant::now();

    while start.elapsed() < BACKEND_STOP_TIMEOUT {
        if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_err() {
            return Ok(());
        }
        std::thread::sleep(BACKEND_STOP_INTERVAL);
    }

    Err(format!(
        "backend sidecar did not stop listening on http://{DEFAULT_BACKEND_HOST}:{port}"
    ))
}

fn cleanup_backend_child<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) {
    let state = app_handle.state::<BackendState>();
    let _ = terminate_backend_child(&state);
}

#[tauri::command]
fn prepare_update_install(state: State<'_, BackendState>) -> Result<(), String> {
    if let Some(port) = terminate_backend_child(&state)? {
        wait_for_backend_stop(port)?;
    }

    std::thread::sleep(Duration::from_millis(450));
    Ok(())
}

#[tauri::command]
fn get_backend_base_url(state: State<'_, BackendState>) -> Result<String, String> {
    state
        .0
        .lock()
        .map(|runtime| runtime.base_url.clone())
        .map_err(|_| "backend state lock poisoned".to_string())
}

fn choose_backend_port() -> Result<u16, String> {
    let listener = TcpListener::bind((DEFAULT_BACKEND_HOST, 0))
        .map_err(|error| format!("failed to reserve backend port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("failed to read reserved backend port: {error}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn wait_for_backend_ready(port: u16) -> Result<(), String> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let start = Instant::now();

    while start.elapsed() < BACKEND_READY_TIMEOUT {
        if let Ok(true) = check_backend_health(address) {
            return Ok(());
        }
        std::thread::sleep(BACKEND_READY_INTERVAL);
    }

    Err(format!(
        "backend did not become ready on http://{DEFAULT_BACKEND_HOST}:{port}"
    ))
}

fn check_backend_health(address: SocketAddr) -> Result<bool, String> {
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_millis(500))
        .map_err(|error| format!("connect failed: {error}"))?;

    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

    let request = format!(
        "GET /api/health HTTP/1.1\r\nHost: {DEFAULT_BACKEND_HOST}\r\nConnection: close\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("write failed: {error}"))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| format!("read failed: {error}"))?;

    Ok(response.contains("200 OK") && response.contains("backend-ready"))
}

fn to_setup_error(message: String) -> Box<dyn std::error::Error> {
    Box::new(io::Error::new(io::ErrorKind::Other, message))
}

fn main() {
    let app = tauri::Builder::default()
        .manage(BackendState(Mutex::new(BackendRuntime {
            base_url: format!("http://{DEFAULT_BACKEND_HOST}:{DEFAULT_BACKEND_PORT}"),
            port: None,
            child: None,
        })))
        .invoke_handler(tauri::generate_handler![
            get_backend_base_url,
            prepare_update_install
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                return Ok(());
            }

            let port = choose_backend_port().map_err(to_setup_error)?;
            let base_url = format!("http://{DEFAULT_BACKEND_HOST}:{port}");
            let envs = HashMap::from([
                (
                    "CLOUD_CONSOLE_BACKEND_HOST".to_string(),
                    DEFAULT_BACKEND_HOST.to_string(),
                ),
                ("CLOUD_CONSOLE_BACKEND_PORT".to_string(), port.to_string()),
                (
                    "CLOUD_CONSOLE_PARENT_PID".to_string(),
                    std::process::id().to_string(),
                ),
            ]);

            let (mut rx, child) = Command::new_sidecar("cloud-console-backend")
                .expect("failed to prepare backend sidecar")
                .envs(envs)
                .spawn()
                .expect("failed to launch backend sidecar");

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[backend] {}", line);
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[backend] {}", line);
                        }
                        _ => {}
                    }
                }
            });

            if let Err(error) = wait_for_backend_ready(port) {
                let _ = child.kill();
                return Err(to_setup_error(error));
            }

            let state = app.state::<BackendState>();
            let mut runtime = state.0.lock().expect("backend state lock poisoned");
            runtime.base_url = base_url;
            runtime.port = Some(port);
            runtime.child = Some(child);

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                cleanup_backend_child(&event.window().app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
            cleanup_backend_child(app_handle);
        }
    });
}
