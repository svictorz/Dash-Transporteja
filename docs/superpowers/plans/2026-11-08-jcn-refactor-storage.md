# JCN storage and refactor implementation plan

> For agentic workers: implement this plan task by task, checking the result before the next task.

**Goal:** Improve document delivery, maintenance, and VPS space while preserving existing records, calculations, roles, and original files.

**Architecture:** Keep the existing Supabase Storage and Next.js application. Extract the common document operations before changing delivery. Use the configured imgproxy for thumbnails only after a real compatibility check. Keep schema evolution additive and historical financial values intact.

**Tech Stack:** Next.js 14, TypeScript, React, Supabase self-hosted Storage/Postgres, Docker, PowerShell/SSH.

**Spec:** `C:/Users/Victor/.codex/attachments/684e3929-208e-422c-a979-85c5f22ae41b/Texto colado.txt`

## Global constraints

- Honor all P-01 through P-26 in the PRD; do not delete originals or reset the database.
- Deliver phases separately. Verify role and finance behavior after each relevant change.
- Preserve the running app and its validated rollback image during infrastructure work.
- Only report measured transfer, disk, and timing gains. Do not add claimed percentages.
- Read old `documents/<route id>/freteDocs-*` objects throughout migration.

## Review focus

- A PDF or signed document stays byte-identical and downloadable after image work.
- The same route documents appear in Rotas and Performance for each authorized role.
- A failed multi-file upload retains successful entries and gives a retryable error.
- A thumbnail failure still lets the user open the original.
- No calculation or role changes while modifying document code.

## Task 0: Recovery baseline

**Files:** VPS inventory and backup artifacts; no application source change.

- [x] Record active commit/image, Docker inventory, schema, media count and disk usage.
- [x] Create a new database dump and Storage archive without mutating either source.
- [x] Copy backup outside the VPS and verify archive contents and checksums in isolation.
- [ ] Record current role and financial baseline; keep personal data out of reports.

## Task 1: Docker artifact retention

**Files:** `/home/ubuntu/deploy-transporteja.sh` only if retention is separately approved.

- [x] Classify image/container entries and selected cache entries, protecting active and rollback images.
- [x] Prepare an exact candidate list and estimate; no broad `system prune` or volume pruning.
- [x] Remove the 15 approved old image IDs, then verify app, Supabase and actual disk gain (436,350,976 bytes). The two approved cache IDs remain because Buildx returned 0 B; no wider prune was attempted.

## Task 2: Shared freight documents

**Files:** Create `lib/services/freight-documents.ts`, `lib/utils/freight-image.ts`, `components/transporteja/FreightDocuments.tsx` as needed; modify `app/(painel)/rotas/page.tsx` and `app/(painel)/performance/page.tsx`.

- [x] Add tests for old naming, image/PDF validation, upload error after partial success, and route boundary.
- [x] Extract list/upload/remove and image preparation without changing formats or storage paths.
- [x] Use shared rendering while retaining each screen's existing permission checks.
- [ ] Compare the two screens and all roles against the baseline before publishing.

## Task 3: Image previews

**Files:** Shared freight document display and a small URL/preview helper.

- [ ] Test the running imgproxy with a disposable or authorized image; do not assume hosted Supabase behavior.
- [ ] Add a thumbnail URL for image tiles, keeping original URL for full-view/download.
- [ ] Check contain/no crop, image clarity, broken-preview fallback, mobile scroll, and bytes transferred.
- [ ] Inspect storage/cache effects; publish only after the visual and functional review.

## Task 4: Inventory and catalog

**Files:** New additive SQL migration and a catalog service, if verified useful.

- [ ] Produce read-only duplicate/orphan candidates and validate full content hashes and references.
- [ ] Add optional metadata with backward-compatible reads; do not rename or delete existing objects.
- [ ] Verify all old documents and access rules before relying on catalog entries.

## Task 5: Selective optimization

**Files:** Shared upload helper; optional bounded background processor after measurement.

- [ ] Test image types and a sample of large unsigned PDFs on copies only.
- [ ] Keep originals, reject a candidate that grows or fails legibility/structure checks.
- [ ] Record per-file outcomes; do not batch rewrite the archive.

## Task 6: Data access

**Files:** Route service/hook, Dashboard, Rotas, Performance, user/session hooks.

- [ ] Add parity tests for complete totals, periods, last seven and role ownership.
- [ ] Introduce complete pagination or server-side aggregates with RLS; no silent 1,000-row cap.
- [ ] Share session/profile state and review Realtime reloads without cross-user cache leaks.

## Task 7: Financial persistence and user saves

**Files:** Existing financial helper and user update endpoint; additive migration only if required.

- [ ] Test historical values, toll inclusion, nonfinancial edits and role-specific access.
- [ ] Share payload construction; preserve saved historical financial values.
- [ ] Design transactional profile/goal save and explicitly account for Auth metadata outside Postgres.

## Task 8: Private document access assessment

**Files:** Separate design and tests; no bucket switch in another phase.

- [ ] Inventory all readers and shared links and choose category-specific access rules.
- [ ] Implement and verify authorized temporary URLs before any bucket visibility change.
- [ ] Document expiration and old-link impact for a separate approval.
