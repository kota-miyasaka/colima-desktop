<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="128" alt="Colima Desktop logo">

# Colima Desktop

English | [日本語](README.md)

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey)
![Built with Tauri v2](https://img.shields.io/badge/built%20with-Tauri%20v2-24C8DB)

**A lightweight Docker GUI for [Colima](https://github.com/abiosoft/colima).**<br>
Manage containers, images, Docker Compose projects and volumes from your menu bar — no Docker Desktop required.

</div>

| Containers | Docker Compose |
|---|---|
| ![Containers](doc/images/containers.png) | ![Docker Compose](doc/images/compose.png) |
| **Images (light theme)** | **Settings (light theme)** |
| ![Images](doc/images/images.png) | ![Settings](doc/images/settings.png) |

> The UI text is currently in Japanese.

## Highlights

- **Built for Colima** — auto-detects Colima's Docker socket and supports multiple Colima profiles
- **Lightweight** — Tauri v2 + Rust. Lives in the menu bar and shows connection status and the number of running containers at a glance
- **Everyday operations covered** — containers, images, Compose projects, volumes, plus Colima start / stop
- **Light and dark themes**

## Features

| Screen | What you can do |
|---|---|
| **Containers** | List, Start / Stop / Restart / Remove, view logs |
| **Compose** | List by project, Up / Stop / Down / Restart |
| **Images** | List, Pull, Remove |
| **Volumes** | List, remove, prune unused volumes |
| **Connection** | Check the Docker connection, Colima Start / Stop, switch profiles |
| **Settings** | Persist socket path, auto-refresh interval (Containers) and theme (light / dark) |
| **Menu bar** | Connection status, running container count, open the window |

Destructive actions ask for confirmation first.

## Installation

> Prebuilt binaries (Releases) are not available yet. For now you need to build from source.

### Requirements

| Tool | Notes |
|---|---|
| macOS | Tested on Apple Silicon |
| [Colima](https://github.com/abiosoft/colima) and the Docker CLI | `docker compose` is required for Compose features |
| [Node.js](https://nodejs.org/) 20.x | |
| [Rust](https://www.rust-lang.org/tools/install) (stable) | |

```bash
brew install colima docker docker-compose
```

### Build and install to /Applications

```bash
git clone https://github.com/kota-miyasaka/colima-desktop.git
cd colima-desktop
npm install
npm run tauri -- build

cp -R "src-tauri/target/release/bundle/macos/Colima Desktop.app" /Applications/
codesign --force --deep --sign - "/Applications/Colima Desktop.app"
```

The ad-hoc `codesign` step after copying is required. Without it the app may be killed at launch by the signature check.

## Usage

1. Run `colima start` in a terminal (you can also start / stop Colima from the **Connection** screen)
2. Launch **Colima Desktop**
3. Switch between Containers / Compose / Images / Volumes from the left navigation

The Containers screen can refresh periodically via "auto-refresh interval" in **Settings** (off by default). Every screen also has a manual refresh button at the top right.

## Docker socket detection order

```
1. socketPath saved in Settings
2. ~/.colima/{profile}/docker.sock (default profile: "default")
3. DOCKER_HOST environment variable
4. /var/run/docker.sock
```

## Troubleshooting

**"Disconnected" is shown**
Check that Colima is running with `colima status`. If you use a profile, select it on the **Connection** screen or set the socket path directly in **Settings**.

**Compose operations fail**
Up / Stop / Down / Restart run the `docker compose` command. Make sure `docker compose version` works.

**The app quits right after launch**
Make sure you ran the `codesign` step from the installation instructions.

## Development

```bash
colima start
npm run tauri -- dev
```

If `cargo` is not found after installing rustup via Homebrew, add this to `~/.zshrc`:

```sh
export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
```

### Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app/) |
| Frontend | React 18 + TypeScript |
| Backend | Rust |
| Docker client | [bollard](https://github.com/fussybeaver/bollard) 0.17 |
| Settings storage | tauri-plugin-store v2 |
| CLI execution | tokio::process::Command |

### Docs (Japanese)

- [Specification](doc/SPEC.md) — scope, types, Tauri command list
- [Development guide](doc/DEVELOPMENT.md) — architecture, Tauri v2 notes, implementation patterns
- [Backend](doc/BACKEND.md) / [Frontend](doc/FRONTEND.md)

## Contributing

Bug reports and feature requests are welcome in [Issues](https://github.com/kota-miyasaka/colima-desktop/issues). Pull requests are welcome too.

## License

[MIT](LICENSE)
