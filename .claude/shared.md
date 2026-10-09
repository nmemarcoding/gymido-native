# Gymido Shared Information

Stable context for every Gymido agent. Not a state file, task list or release tracker.

## Memory Locations
- Shared information: `.claude/shared.md`
- Bootstrap files: `.claude/bootstrap/`
- Agent state files: `.claude/agent-memory/`

## Project Overview
- Gymido is a workout-tracking app: members follow training plans, log workouts set by set
  with rest timers and track progress; trainers coach clients and assign private plans.
- Goal: one product across web and mobile — the mobile app matches the web app's behaviour,
  except where the owner records a numbered override.
- Platforms: web, iOS and Android. Mobile is for trainers and clients; admin is web-only.

## Repository Structure
- **gymido** — `backend/` (Backend), `frontend/` (Frontend), `docs/`; also home to the PM
  (`gymido-pm`) and DevOps (`gymido-devops`) agents.
- **gymido-native** — the React Native app (Mobile, `gymido-native`).

## Agent Routing
- Product requirements, priorities, owner decisions, coordination → PM (`gymido-pm`)
- Go API, API contract, database schema and migrations, business logic, token validation → Backend (`gymido-backend`)
- Auth0 tenant configuration → the owner, via PM
- Web UI/UX, web behaviour questions, RN specs and test plan → Frontend (`gymido-frontend`)
- React Native, iOS, Android, native features, E2E automation → Mobile (`gymido-native`)
- Production server, containers on the server, database operations, backups, deploys → DevOps (`gymido-devops`)
- CI workflows → the agent that owns what they build

## Communication Rules
- All cross-agent communication goes through the PM Agent.
- Agents do not coordinate directly unless the PM explicitly authorizes it.
- The PM routes questions, relays answers and brings decisions to the owner.
- Owner-only approvals (new dependencies, Auth0 or production changes, security trade-offs,
  scope changes) need the owner's own words where an agent's rules require it.
- Report findings as verified or inferred; never present a guess as fact.
- Send the PM a short status whenever you stop.

## Architecture Summary
- **Backend** — Go; MySQL/MariaDB; feature-first modular monolith; three-tier (handlers → services → stores).
- **Frontend** — React, Vite, Tailwind.
- **Mobile** — React Native, Expo.
- **Authentication** — Auth0.

## Ownership Boundaries
- **PM** — priorities, coordination, routing, owner decisions, release planning.
- **Backend** — APIs and the wire contract, database schema, business logic, backend tests, docs and build.
- **Frontend** — web UI/UX and its deploy; source of truth on web behaviour; RN specs, test plan, web bug list.
- **Mobile** — the React Native app on iOS and Android, native features, mobile tests and E2E.
- **DevOps** — production server, containers, database operations, backups, deploys and rollbacks. Never application code.

## Global Rules
- Follow CLAUDE.md in each repository.
- Don't modify another agent's area without PM coordination.
- The codebase is the source of truth; if docs disagree with code, correct the docs.
- Agents must respect published API contracts and ownership boundaries.
- No commit or push until the PM relays the owner's explicit "commit and push"; stage only your own paths.
- Never use the production database for testing; use dedicated test accounts and test databases.
- Never put secrets in repos, docs, state files or messages.
- On a test failure: stop, fix, confirm once, report — no retry loops or long unannounced runs.
- State files are current snapshots, not logs; bootstrap files hold permanent instructions.
