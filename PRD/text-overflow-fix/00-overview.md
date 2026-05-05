# Text Overflow Fix -- Overview

## Status

| Field    | Value            |
|----------|------------------|
| Phase    | 1 -- Analysis    |
| Priority | P2 (UX polish)   |
| Branch   | `feat/text-overflow-fix` (proposed) |
| Assignee | TBD              |

## Problem

When previewing document chunks, long URLs or unbroken text strings overflow
the parent container and produce a horizontal scrollbar instead of wrapping.

## Affected Files

| File | Framework | Role |
|------|-----------|------|
| `frontend/src/components/DocumentDetail.tsx` | React 19 | Chunk preview (line 109: `<p>` with `whitespace-pre-wrap` only) |
| `front-vue/src/components/DocumentDetail.vue` | Vue 3 | Chunk preview (line 78: `<p>` with `whitespace-pre-wrap` only) |

## Reference Pattern

| File | Role |
|------|------|
| `frontend/src/components/MarkdownContent.tsx` | Already applies `break-words` + `min-w-0` (line 16-17) |
| `front-vue/src/components/MarkdownContent.vue` | Same pattern in `baseClass` (line 51) |

## Git History

| Commit | Message |
|--------|---------|
| `214a9e2` | `style(frontend): unify industrial UI` |
| `4c19076` | `feat(frontend): add download link modal` |
| `0afd639` | `feat(frontend): add document detail viewer` |

## Deliverables

1. `01-requirements.md` -- problem statement, acceptance criteria
2. `02-solutions.md` -- approaches with comparison and recommendation
3. Code changes in both frontends (separate PR)
