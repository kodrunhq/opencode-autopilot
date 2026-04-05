<p align="center">
  <img src="https://img.shields.io/npm/v/@kodrunhq/opencode-autopilot?color=blue&label=npm" alt="npm version" />
  <img src="https://img.shields.io/github/actions/workflow/status/kodrunhq/opencode-autopilot/ci.yml?branch=main&label=CI" alt="CI" />
  <img src="https://img.shields.io/github/license/kodrunhq/opencode-autopilot" alt="license" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=black" alt="Bun" />
</p>

# OpenCode Autopilot Documentation

OpenCode Autopilot is an autonomous SDLC orchestration plugin for the OpenCode AI coding CLI. It manages the entire development lifecycle from initial research to final documentation through a multi-agent pipeline. The system uses adversarial model diversity to ensure high quality code and sound architectural decisions.

### Quick Links
[Installation](guide/installation.md) | [Configuration](configuration.md) | [Pipeline](pipeline.md) | [Tools Reference](tools-reference.md)

---

### 1. Getting Started
[Installation Guide](guide/installation.md), Step by step instructions for installing and configuring the plugin.

### 2. Architecture
[Architecture](architecture.md), Overview of the system architecture and internal module map.

### 3. The Pipeline
[The Pipeline](pipeline.md), Detailed breakdown of the 8-phase autonomous development pipeline.

### 4. Agents
[Agents](agents.md), Complete catalog of all specialized agents and their roles.

### 5. Code Review
[Code Review](code-review.md), Deep dive into the 13-agent adversarial code review pipeline.

### 6. Skills & Commands
[Skills & Commands](skills-and-commands.md), Reference for all adaptive skills and slash commands.

### 7. Configuration
[Configuration](configuration.md), Comprehensive reference for the v7 configuration schema.

### 8. Memory System
[Memory System](memory-system.md), How the smart dual-scope memory tracks project patterns and user preferences.

### 9. Observability
[Observability](observability.md), Event tracking, structured logging, and health diagnostics.

### 10. Model Fallback & Recovery
[Model Fallback](model-fallback.md), Automatic fallback chains and session recovery strategies.

### 11. Background Tasks & Routing
[Background & Routing](background-and-routing.md), Managing background tasks, category routing, and the autonomy loop.

### 12. Tools Reference
[Tools Reference](tools-reference.md), Documentation for all 25 oc_* tools registered by the plugin.

### 13. CLI Reference
[CLI Reference](cli-reference.md), Reference for the standalone install, configure, and doctor commands.
