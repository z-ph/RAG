# Text Overflow Fix -- Requirements

## Problem Statement

The chunk preview panel in DocumentDetail renders each segment's raw text inside
a `<p>` element styled with only `whitespace-pre-wrap`. When the text contains
long unbreakable content -- such as URLs, file paths, or continuous character
sequences -- the browser cannot find a break opportunity. The text extends past
the container boundary, causing the `overflow-auto` parent to display a
horizontal scrollbar.

This affects both the React frontend (`frontend/`) and the Vue frontend
(`front-vue/`), which share the same structural markup and class names.

## Root Cause Analysis

1. **Missing word-break directive.** The `<p>` at line 109 (React) / line 78
   (Vue) uses `whitespace-pre-wrap` but has no `word-break`, `overflow-wrap`,
   or `break-words` utility. `whitespace-pre-wrap` preserves newlines and
   collapses spaces, but it does NOT tell the browser to break inside a word
   when no soft-wrap opportunity exists.

2. **Scrollable parent with no clamp.** The `overflow-auto` div at line 97
   (React) / line 66 (Vue) allows unrestricted horizontal scrolling rather than
   forcing its children to fit the available width.

3. **No max-width constraint on inner content.** The segment card `<div>` has
   no `min-w-0` or `max-w-full`, so in a flex context it can grow beyond its
   parent.

## User Scenarios

### Scenario A -- Long URL in chunk text

A document chunk contains a URL such as:
`https://example.com/api/v2/resources/very-long-path-segment-that-keeps-going`

Expected: URL wraps at container edge, possibly mid-string.
Actual: URL renders on a single line, pushing the container wider and triggering
a horizontal scrollbar.

### Scenario B -- Unbroken text / path

A log file or configuration chunk contains:
`C:\Users\admin\AppData\Local\Programs\application\logs\2024-12-31-debug-output.log`

Expected: Path wraps when it hits the container boundary.
Actual: Same overflow behavior.

### Scenario C -- Long CJK string without spaces

A Chinese document segment contains a very long continuous string of characters
with no whitespace. Under `whitespace-pre-wrap`, CJK characters are break
opportunities by default, so this scenario is lower risk but should still be
verified.

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | Chunk text containing URLs 200+ chars long wraps within the container | Manual: load document with long-URL chunk |
| AC-2 | No horizontal scrollbar appears in the chunk list area | Manual: inspect overflow behavior |
| AC-3 | Normal short text retains existing line spacing and whitespace behavior | Visual regression check |
| AC-4 | Multi-line chunks with intentional newlines still display correctly | Manual: verify `whitespace-pre-wrap` still works |
| AC-5 | Fix is applied to **both** React and Vue frontends | Code review: both files modified |
| AC-6 | No new CSS classes introduced if Tailwind utilities suffice | Code review: prefer existing utilities |

## Out of Scope

- Truncating or eliding text (we want full content visible, just wrapped)
- Modifying the `MarkdownContent` component (already handles this correctly)
- Adding a "copy" button to chunk cards (separate feature)
- Changing the scroll behavior of the chunk list (vertical scroll is fine)
- Modifying API responses or backend text processing
