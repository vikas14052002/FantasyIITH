# PlayXI - Fantasy Cricket League

> A real-time fantasy cricket platform built for IPL 2026. Pick your XI, set your captain, track live scores, and compete with friends.

**Live App:** [playxifantasy.vercel.app](https://playxifantasy.vercel.app)

---

## What is PlayXI?

PlayXI is a full-stack fantasy cricket app where users create private leagues, build their dream XI from real IPL squads, and earn points based on live match performance. Think Dream11 — but open source, built in a weekend, and designed for friend groups.

## Features

### Core Gameplay
- **Team Creation** — Pick 11 players within a 100-credit budget with role constraints (WK, BAT, AR, BOWL)
- **Captain & Vice Captain** — 2x and 1.5x point multipliers
- **Backup Players** — Select substitutes with priority ordering
- **One Team Per Match** — Edit anytime before the match starts, locked after deadline
- **Private Leagues** — Create or join with 6-character invite codes

### Live Match Experience
- **Real-time Score Sync** — Cricbuzz data scraped every 60 seconds via cron
- **Auto-refresh** — Frontend polls every 30 seconds during live matches
- **Live Scorecard** — Full batting & bowling tables with player images
- **Fantasy Points Tracker** — Watch your points climb in real-time
- **Player Breakdown** — Tap any player to see line-by-line points: runs, fours, sixes, wickets, catches, bonuses

### Leaderboard & Compare
- **Match Leaderboard** — Ranked by fantasy points with gold/silver/bronze medals
- **Compare-in-Place** — Tap the compare icon, pick a friend, see a full head-to-head breakdown
- **Category Splits** — Different players, common players, captain/VC comparison with point diffs
- **Overall Leaderboard** — Aggregated across all matches in a league
- **Match-wise View** — Top 2 per completed match, click to view teams

### Dream Team
- **Top 11 Players** — Automatically identified after match completion
- **Gold Star Badges** — Dream Team players highlighted with gold glow in Player Stats and Team Preview

### Team Preview
- **Cricket Field Layout** — Players positioned by role on a green pitch
- **Live Preview** — See your partial team on the field while still selecting
- **Bench Slider** — Backup players in a slide-up panel

### Security
- **Server-side Team Protection** — PostgreSQL function (`get_team_preview`) blocks access to other users' teams before match starts
- **Row Level Security** — Enabled on teams and team_players tables
- **Password Authentication** — Name + password login with uniqueness enforcement
- **No Peeking** — Even browser devtools can't see others' picks pre-match

### UI/UX
- **Mobile-first Dark Theme** — Optimized for 480px, looks great on phones
- **Liquid Glass Navigation** — Frosted glass bottom nav with SVG icons and micro-animations
- **Glassmorphism Cards** — Semi-transparent cards with backdrop blur
- **Team Color Gradients** — Match cards bordered with both teams' brand colors
- **Official IPL Logos** — Sourced from IPL CDN for all 10 franchises
- **Animated Points** — Count-up animation when scores load
- **Creation Stepper** — Visual progress: Pick Players → Captain → Done

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router v7, Vite |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **Data Source** | Cricbuzz (HTML scraping) |
| **Hosting** | Vercel (auto-deploy on push) |
| **Cron** | pg_cron + pg_net (1-min intervals) |

### Architecture

```
Cricbuzz ──scrape──> Supabase Edge Functions ──write──> PostgreSQL
                         (every 60s via pg_cron)            |
                                                            |
User Phone ──poll──> Vercel (React SPA) ──read──> Supabase DB
                    (every 30s for live)
```

## Edge Functions

| Function | Purpose |
|----------|---------|
| `sync-schedule` | Fetches IPL match list from Cricbuzz |
| `sync-squads` | Scrapes player squads with images, roles, credits |
| `sync-scorecard` | Live scorecard: batting, bowling, fielding stats + result detection |
| `auto-sync` | Orchestrator: syncs live scorecards, pre-match squads, auto-sets match status |

## Scoring System

| Category | Points |
|----------|--------|
| Playing XI | +4 |
| Run | +1 per run |
| Four | +4 bonus |
| Six | +6 bonus |
| Half Century | +8 |
| Century | +16 |
| Duck (BAT/WK/AR) | -2 |
| Wicket | +30 |
| Maiden | +12 |
| Dot Ball | +1 |
| LBW/Bowled Bonus | +8 per wicket |
| Catch | +8 |
| Stumping | +12 |
| Run Out | +12 |
| Captain | 2x all points |
| Vice Captain | 1.5x all points |

## Local Development

```bash
cd frontend
npm install
npm run dev -- --host    # accessible on local network
```

## Deployment

```bash
# From repo root
npx vercel --prod --yes
npx vercel alias <deployment-url> playxifantasy.vercel.app
```

## Database

Supabase project with tables: `users`, `matches`, `match_players`, `leagues`, `league_members`, `teams`, `team_players`, `scores`, `points_config`

Key security: `get_team_preview()` PostgreSQL function ensures team data is only returned to the owner or after match starts.

---

Built for IPL 2026. Started as a weekend project, grew into a full fantasy platform.
