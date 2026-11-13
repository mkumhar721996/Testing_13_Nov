---
id: ADR-0002
category: component
title: Web API
status: accepted
superseded_by: null
component_id: comp_web_api
responsibility: Single backend API holding the application's business logic, authentication
  and data access; also hosts any background jobs until one has its own NFR.
kind: api_service
split_reason: Different runtime from the browser client; owns the data boundary
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: 'proposed: API reads and writes application data'
evidence: 'human: "I want to make common web application"; proposed: a web UI needs
  one API'
---

## Context

human: "I want to make common web application"; proposed: a web UI needs one API

## Decision

Single backend API holding the application's business logic, authentication and data access; also hosts any background jobs until one has its own NFR.

Kept separate because Different runtime from the browser client; owns the data boundary.

## Talks to

- **Relational Database** (sync) — proposed: API reads and writes application data
