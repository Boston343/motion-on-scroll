# motion-on-scroll (MOS)

Scroll-triggered animation library driven by `data-mos` attributes. It is an AOS-compatible
replacement for AOS, built on the `motion` package's `animate` API.

## Product rule

MOS base behaviour and API must stay compatible with AOS (michalsnik/aos) so users can switch by
renaming `data-aos` to `data-mos`. New capabilities are additive and must not change
AOS-equivalent defaults (see `DEFAULT_OPTIONS` in `packages/motion-on-scroll/src/helpers/constants.ts`).

## Layout

- `packages/motion-on-scroll` - the published npm library (tsdown build: ESM `dist/index.js` with `motion` external, standalone `dist/mos.global.js` exposing `window.MOS` with Motion bundled, and `dist/mos.css`).
  - `src/index.ts` - public API (`init`, `refresh`, `refreshHard`, `register*`, `MOS` object).
  - `src/helpers/*.ts` - constants, types, attributes, keyframes, easing, scroll handling, etc.
  - `src/css/mos.css` - stylesheet, minified into `dist/` by the build.
  - `src/__tests__/*.spec.ts` - vitest specs.
- `apps/docs` - Astro Starlight docs site (workspace package `motion-on-scroll-docs`);
  content in `src/content/docs/**/*.mdx`.
- `.changeset` - changesets config and pending changesets.
- Root: turbo (`turbo.json`), shared eslint/prettier config, pnpm workspace.

## Commands (run from repo root; pnpm only, enforced by `preinstall`)

- Install: `pnpm install`
- Build everything: `pnpm build` (turbo); library only: `pnpm mos:build`
- Test, one-shot: `pnpm --filter=motion-on-scroll exec vitest run`
  - `pnpm test` runs the library's `test` script, which is plain `vitest` (watch mode locally).
  - Coverage: `pnpm test:coverage`
- Typecheck: `pnpm typecheck` (turbo -> `tsc --noEmit`)
- Lint + format check (library): `pnpm mos:format:check` (`eslint . && prettier --check .`)
- Lint + format fix: `pnpm format` (whole repo) or `pnpm mos:format` (library)
- All checks: `pnpm check` (turbo lint, typecheck, format:check)
- What CI runs: `pnpm typecheck` then `pnpm run ci` (= `mos:build`, `mos:format:check`, `test`)
- Docs dev server: `pnpm docs:dev`; build: `pnpm docs:build`
- Library watch build: `pnpm mos:dev`

## Conventions

- ESM TypeScript; relative imports use the `.js` suffix (`./helpers/constants.js`).
- Double quotes; formatting by prettier, import order by eslint simple-import-sort.
- Section-banner comments (`// ====...` / `// SECTION NAME`) to divide files.
- JSDoc on functions (with `@param` / `@returns` where useful).
- Tests live in `src/__tests__/*.spec.ts`, run in jsdom; `motion` is mocked globally in
  `packages/motion-on-scroll/vitest.setup.ts` (individual specs may override the mock).
- Docs must match the code: when changing an option, default, or attribute, update
  `apps/docs/src/content/docs/reference/{api,attributes}.mdx` and both READMEs.
- MDX does not accept `<!-- -->` comments; use `{/* ... */}` in `.mdx` files.

## Releases

- Add a changeset (`pnpm changeset`) for any user-visible library change. `motion-on-scroll-docs`
  is ignored by changesets.
- On push to `main`, `.github/workflows/release.yml` runs `changesets/action`, which only opens or
  updates the "Version Packages" PR. It does not publish.
- Publishing to npm is manual: `pnpm mos:publish:release` (or `mos:publish:beta` / `mos:publish:next`);
  `prepublishOnly` runs the library's `ci` script first.

## Gotchas

- TypeScript is pinned to 6.0.x: `typescript-eslint` does not support TypeScript 7 yet. Re-check before bumping.
- pnpm settings live in `pnpm-workspace.yaml` (pnpm 11 no longer reads `.npmrc` or the `pnpm` field in `package.json` for them).
- Element state follows AOS's model: `animated` flips as soon as an element starts animating in or out. Do not rely on Motion's `controls.finished` to track state: after an animation has finished once, a replayed WAAPI animation reports an already-resolved promise.
- jsdom has no layout or animation engine, and the unit tests mock `motion`. Changes to animation behaviour need a check in a real browser (a static page loading `dist/mos.global.js` and `dist/mos.css` is enough).
- The show delay is applied by MOS with a timer, not passed to Motion: a delay inside Motion's timeline is replayed in the wrong place when the animation runs backwards.
- `releaseIdleFrameLoop` in `helpers/animations.ts` uses Motion internals (`animations[].animation.stopDriver()`) to stop paused animations ticking every frame. It is guarded, so if a Motion upgrade removes them the only symptom is idle `requestAnimationFrame` activity. Re-check it when bumping Motion.
