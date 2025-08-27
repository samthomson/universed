# AOS Universes — Dog‑Food MVP (DF MVP)

> Single‑relay dog‑food build to validate core community experience before broader release.

## Scope & Constraints
- **Relay:** `universes.to` (single relay for DF)
- **URL:** DF app served at **`universes.social`**
- **Experimentation:** Live experimentation continues on `universes.to` (separate from DF app)
- **Out of scope:** Marketplace, Resources (excluded for DF MVP)

---

## Features

### 1) Performance & Reliability
- [ ] Fast initial load and snappy navigation (TTI target on baseline devices)
- [ ] Retry/backoff on relay hiccups; offline toasts with “Retry”
- [ ] Error boundaries per page; preserve state on failure (no hard resets)
- [ ] Client logs include error codes and relay responses (PII‑redactable)

### 2) Web Notifications
- [ ] Explicit opt‑in prompt with clear explanation
- [ ] Respect OS **Do Not Disturb**

### 3) Channels & Content
**Channel types:** Text channels, Voice channels

**Moderator capabilities**
- [ ] Create / edit / delete channels (text & voice)
- [ ] Pin / unpin posts

**User capabilities**
- [ ] Create posts; threaded replies; emoji reactions
- [ ] Zap posts
- [ ] Create & share events (date/time + link)
- [ ] Create & share polls (single/multi‑select; open/close time)
- [ ] Upload files (images/docs/audio) with previews
- [ ] Post links with previews

**DF Decisions**
- **File previews**
  - Images → inline thumbnail + lightbox
  - Docs/PDF → file card (name, size, type) + “View / Download”
  - Audio → compact inline player (duration)
- **Link previews**
  - Basic unfurl (title/description/favicon/thumbnail) using server‑side fetch with caching
  - Respect robots/no‑cache; user can collapse previews
- **Hashtags**
  - **Not included** in DF MVP; revisit after behavior is defined (search/subscriptions semantics)

### 4) Moderation
**Roles**
- Owner(s) can grant/revoke **Mod** role

**Actions**
- [ ] **Boot user** (removes membership & posting rights)  
  Public‑read Universe: booted users may still read public content but cannot interact.  
  Private‑read Universe: booted users lose all visibility.
- [ ] **Hide** vs **Delete** content  
  Hide → removes from member timelines; reversible; retained for audit.  
  Delete → removes where feasible; may leave tombstone.
- [ ] **Report**: users can report posts/users with reason codes + notes

### 5) Direct Messages (DMs)
- [ ] Auto‑select modern private DMs when supported (NIP‑17 family); fall back to legacy encrypted DMs (NIP‑04)
- [ ] Clear message state (sent / delivered / failed) with retry
- [ ] First‑use tooltip explains tradeoffs & metadata leakage considerations

### 6) Accessibility & UX
- [ ] Keyboard navigable; visible focus states; motion‑reduced option
- [ ] WCAG AA color contrast; light/dark/system modes
- [ ] Alt‑text required on image uploads

### 7) Settings (Minimum)
- [ ] Notifications (per‑event toggles)
- [ ] Privacy (DM tooltips on/off)
- [ ] Content (autoplay voice previews off by default)
- [ ] Display (light/dark/system)
- [ ] Data (clear cache)

### 8) Telemetry for DF
- [ ] Anonymous counters: channel ops, posts, replies, reactions, zaps, file/link preview renders, DMs, mod actions, errors
- [ ] Daily CSV export for DF review

---

## Non‑Goals (DF MVP)
- Marketplace
- Resources

## Definitions
- **Boot:** Remove user from Universe membership & posting rights. Public‑read Universes remain viewable; private‑read Universes become invisible.
- **Hide vs Delete:** Hide = reversible moderation action; Delete = removal where feasible (may show tombstone).

## Open Questions (post‑DF)
- Voice channels: speaker requests/raise‑hand, recording, or stage mode?
- Link unfurl privacy: per‑Universe toggle to disable server‑side fetch?
- Hashtags: should they map to Nostr `t` tags and power search/subscriptions?
- DM retention: per‑conversation retention windows (e.g., 24h ephemeral)?
- Notifications: Per‑event‑type toggles (mentions, DMs, thread replies, mod notices)?

## Success Signals
- Smooth performance/reliability; low error rates
- Healthy creation mix (posts, replies, zaps, polls/events)
- Clear, effective mod workflows (hide vs delete; boot semantics)
- DF telemetry shows daily use across core flows

---

### Changelog
- v0.1.0 — Initial DF MVP feature spec
