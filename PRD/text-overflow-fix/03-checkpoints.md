# Text Overflow Fix -- TDD Checkpoints

## Checkpoint 1 -- Source files contain `break-words` on the `<p>` element

- Test that `DocumentDetail.tsx` has a `<p>` element whose className includes
  `break-words` alongside `whitespace-pre-wrap`.
- Test that `DocumentDetail.vue` has a `<p>` element whose class attribute
  includes `break-words` alongside `whitespace-pre-wrap`.
- This confirms the text-level word-break directive is in place for both
  frontends.

## Checkpoint 2 -- Source files contain `min-w-0` on the segment card wrapper

- Test that the `<div>` with `border border-ink-300` in `DocumentDetail.tsx`
  also includes `min-w-0` in its className (the segment card, not the header).
- Test that the `<div>` with `rounded-[12px]` in `DocumentDetail.vue` also
  includes `min-w-0` in its class attribute (the segment card, not the header).
- This confirms the flex-child overflow clamp targets the correct element,
  avoiding a false match on the header div which already has `min-w-0`.

## Checkpoint 3 -- React frontend builds without errors

- Run `pnpm build` in `frontend/` and assert exit code 0.
- Grep the build output directory for `break-words` and `min-w-0` to confirm
  Tailwind generated the corresponding CSS rules.
- This proves the added classes are valid Tailwind v4 utilities that survive
  compilation.

## Checkpoint 4 -- Vue frontend builds without errors

- Run `pnpm build` in `front-vue/` and assert exit code 0.
- Grep the build output directory for `break-words` and `min-w-0` to confirm
  Tailwind generated the corresponding CSS rules.
- This proves the added classes are valid Tailwind v4 utilities that survive
  compilation in the Vue project.

## Checkpoint 5 -- No unintended class removals or duplicates

- Verify the original classes (`whitespace-pre-wrap`, `text-sm`, `leading-relaxed`)
  still appear on the `<p>` element in both files.
- Verify `break-words` appears exactly once per `<p>` element and `min-w-0`
  appears exactly once per segment card `<div>` in each file (note: the header
  div already has `min-w-0`, so the check targets the segment card line only).
- This catches accidental class deletion or copy-paste duplication.

## Manual Verification (AC-3)

- AC-3 ("normal short text retains existing line spacing and whitespace behavior")
  requires manual visual regression testing. Load a document with short-text
  chunks and verify the line spacing, whitespace, and overall layout are unchanged.

---

## Progress Checklist

- [ ] CP-1: `break-words` present on `<p>` in both DocumentDetail.tsx and .vue
- [ ] CP-2: `min-w-0` present on segment card `<div>` in both files
- [ ] CP-3: React frontend `pnpm build` succeeds with new classes in output
- [ ] CP-4: Vue frontend `pnpm build` succeeds with new classes in output
- [ ] CP-5: No missing original classes, no duplicate additions
