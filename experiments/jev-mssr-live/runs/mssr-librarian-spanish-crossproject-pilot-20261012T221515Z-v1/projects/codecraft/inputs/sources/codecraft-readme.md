# Codecraft

A standalone Minecraft Java/Fabric prototype for making local coding-agent work visible and approachable. This project is original; AgentCraft may be consulted for product ideas, but its source is not forked or copied.

## Current status

- Minecraft Java 26.3 is installed locally.
- Fabric Loom project scaffold targets Minecraft 26.3, Fabric Loader 0.19.5, Fabric API 0.161.0+26.3, and Java 25.
- The client-only mod opens its office panel with `K` (Minecraft's default `O` key opens its social menu). It has a simulated workflow, plus an authenticated loopback connection to Foreman for real local task metadata, queue actions, and events.
- A dark responsive office panel and task-entry form were visually inspected through a hidden Minecraft harness. Harness runs set the isolated dev profile's master volume to zero and hide the SDL window before opening Codecraft.
- Foreman lives under `foreman/`: durable local task/event state, task creation, pause/resume, a Sign in with ChatGPT loopback flow with Windows DPAPI storage, and a one-worker Responses API loop. The dark Minecraft account screen starts browser consent only after a player clicks **Continue with ChatGPT**. Codecraft uses only its explicit local file/check functions; no account has signed in yet and no model request has been made.
- Coding tasks run in detached Git worktrees and remain in review state when they produce changes. The source baseline is committed locally; Foreman requires the main checkout to stay clean before starting a task.
- `ROADMAP.md` defines the first milestones and their completion gates. `scripts/Run-BackgroundHarness.ps1` runs isolated, muted visual checks without taking the desktop focus.

## Prerequisites found on this machine

- JDK 25 (Amazon Corretto 25.0.4)
- Node.js 24.16.0 and npm 10.9.9
- Git 2.46.2
- Minecraft Launcher / Java Edition package

The Gradle Wrapper is included. It downloads its configured Gradle distribution and Fabric dependencies on first use.

On this Windows machine, the Gradle daemon uses Windows' trusted root certificates (`Windows-ROOT`) so Java can reach Fabric's Maven repository. If you build this project on another operating system, replace that JVM trust-store setting in `gradle.properties` with the appropriate platform setting.

## Launch the development client

From this directory:

```powershell
.\gradlew.bat runClient
```

The development client uses Gradle's isolated run directory; it does not overwrite the normal Minecraft installation or worlds.

## Build the mod jar

```powershell
.\gradlew.bat build
```

The built jar will appear under `build\libs`.
