---
id: ADR-0003
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Persistent store for application data; runs on PostgreSQL.
kind: infrastructure
split_reason: Backing service the project uses but does not build
evidence: 'human: "PostgreSQL"'
---

## Context

human: "PostgreSQL"

## Decision

Persistent store for application data; runs on PostgreSQL.

Kept separate because Backing service the project uses but does not build.
