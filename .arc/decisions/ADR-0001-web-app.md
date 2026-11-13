---
id: ADR-0001
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: Browser UI for end users of the web application; talks only to the
  Web API.
kind: web_ui
split_reason: Separate client runtime (browser); proposed as the minimal starting
  shape
talks_to:
- component_id: comp_web_api
  interaction: sync
  evidence: 'proposed: browser UI calls its API over HTTPS'
evidence: 'human: "I want to make common web application"'
---

## Context

human: "I want to make common web application"

## Decision

Browser UI for end users of the web application; talks only to the Web API.

Kept separate because Separate client runtime (browser); proposed as the minimal starting shape.

## Talks to

- **Web API** (sync) — proposed: browser UI calls its API over HTTPS
