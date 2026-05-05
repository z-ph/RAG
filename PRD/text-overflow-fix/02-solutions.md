# Text Overflow Fix -- Solutions

## Approach 1 -- Add `break-words` + `min-w-0` to the `<p>` element (Recommended)

### Description

Mirror the proven pattern from `MarkdownContent`:
- Add `break-words` (Tailwind v4: maps to `overflow-wrap: break-word`) to the
  `<p>` element that renders `segment.text`.
- Add `min-w-0` to the segment card `<div>` to prevent flex children from
  overflowing.

This is the same approach already shipping in production for chat message
content via `MarkdownContent.tsx` (line 16-17) and `MarkdownContent.vue` (line
51).

### Changes

**React** -- `frontend/src/components/DocumentDetail.tsx`

```
Line 109, current:
  <p className="text-sm leading-relaxed text-ink-900 whitespace-pre-wrap">

Proposed:
  <p className="text-sm leading-relaxed text-ink-900 whitespace-pre-wrap break-words">

Line 100-102, current:
  <div key={segment.chunkIndex}
    className="border border-ink-300 bg-white px-4 py-3">

Proposed:
  <div key={segment.chunkIndex}
    className="min-w-0 border border-ink-300 bg-white px-4 py-3">
```

**Vue** -- `front-vue/src/components/DocumentDetail.vue`

```
Line 78, current:
  <p class="text-sm leading-relaxed text-ink-900 whitespace-pre-wrap">

Proposed:
  <p class="text-sm leading-relaxed text-ink-900 whitespace-pre-wrap break-words">

Line 68-71, current:
  <div v-for="segment in detail.segments" :key="segment.chunkIndex"
    class="rounded-[12px] bg-white/[0.72] px-4 py-3 shadow-[...]">

Proposed (add min-w-0):
  <div v-for="segment in detail.segments" :key="segment.chunkIndex"
    class="min-w-0 rounded-[12px] bg-white/[0.72] px-4 py-3 shadow-[...]">
```

### Pros

- **Consistent with existing codebase.** Uses the same class combination already
  validated in `MarkdownContent` on both frontends.
- **Minimal diff.** Two classes added per file, no structural changes.
- **Tailwind v4 compatible.** `break-words` is a standard Tailwind utility
  (`overflow-wrap: break-word`).
- **`whitespace-pre-wrap` is preserved.** Newlines and whitespace in the source
  text still render correctly; `break-words` only activates when a word has no
  natural break opportunity.

### Cons

- Long URLs will break mid-string rather than at a logical boundary. This is
  acceptable for a preview panel (the full URL is still readable and
  selectable).

### Risk

Low. The classes are additive and do not change existing layout behavior for
normal-width text.

---

## Approach 2 -- Add `overflow-x-hidden` to the scrollable parent

### Description

Instead of fixing overflow at the text level, clamp the `overflow-auto`
container to suppress horizontal overflow entirely.

### Changes

**React** (line 97):
```
Current:  className="mt-4 flex-1 min-h-0 overflow-auto ..."
Proposed: className="mt-4 flex-1 min-h-0 overflow-x-hidden overflow-y-auto ..."
```

**Vue** (line 66): same change.

### Pros

- Even simpler: one class change per file.
- Guarantees no horizontal scrollbar under any circumstance.

### Cons

- **Content is clipped, not wrapped.** Long text simply disappears at the right
  edge. Users cannot scroll to see the rest, making this a poor UX choice.
- Does not address the root cause; just hides the symptom.

### Risk

Medium. Clipping content without any way to access it is likely to generate user
complaints.

---

## Approach 3 -- Hybrid: text wrapping + parent clamp

### Description

Combine Approach 1 (text-level wrapping) with a safety clamp on the parent
container using `overflow-x-hidden`.

### Changes

Both sets of changes from Approach 1, plus the parent `overflow-x-hidden` from
Approach 2.

### Pros

- Belt-and-suspenders: text wraps, and even if something slips through, the
  parent prevents a scrollbar.

### Cons

- Slightly more classes than necessary; `break-words` on the text should be
  sufficient on its own.
- `overflow-x-hidden` on the parent could interfere if a future feature needs
  horizontal scrolling (e.g., wide tables in chunks).

### Risk

Low, but marginally higher maintenance cost than Approach 1 alone.

---

## Comparison

| Criterion | Approach 1 (break-words) | Approach 2 (overflow-x-hidden) | Approach 3 (Hybrid) |
|-----------|--------------------------|-------------------------------|---------------------|
| Content fully visible | Yes | **No** (clipped) | Yes |
| No horizontal scrollbar | Yes | Yes | Yes |
| Preserves whitespace | Yes | Yes | Yes |
| Consistent with MarkdownContent | **Yes** | No | Partially |
| Files changed | 2 | 2 | 2 |
| Classes added | 2 per file | 1 per file | 3 per file |
| Risk of side effects | Low | Medium (clipping) | Low |
| Future-proof | Good | Poor | Good |

## Recommendation

**Approach 1** is recommended. It directly fixes the root cause (missing
word-break on text), is consistent with the established `MarkdownContent`
pattern, has the lowest risk, and keeps all content visible to the user.

The hybrid (Approach 3) is acceptable as an alternative if extra safety is
desired, but is likely unnecessary given that `break-words` handles all known
overflow cases.

Approach 2 is not recommended because it hides content rather than wrapping it.
