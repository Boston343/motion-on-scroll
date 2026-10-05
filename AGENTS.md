# motion-on-scroll (MOS)

Scroll-triggered animation library driven by `data-mos` attributes. It is an AOS-compatible
replacement for AOS, built on the `motion` package's `animate` API.

This file is the single source of agent guidance for the repo (`CLAUDE.md` just imports it).
The block at the bottom is maintained by turbo; edit everything above it freely.

## Product rule

MOS base behaviour and API must match AOS (michalsnik/aos) so users can switch by renaming
`data-aos` to `data-mos`. Parity comes first; new capabilities are added on top and must not
change AOS-equivalent behaviour or defaults (see `DEFAULT_OPTIONS` in
`packages/motion-on-scroll/src/helpers/constants.ts`). When unsure what "correct" is, read the AOS
source (`next` branch: `src/js/aos.js`, `src/js/helpers/*.js`, `src/sass/*.scss`) and copy it,
quirks included.

## Maintainer decisions (do not relitigate without asking)

- **Slide presets stay at 100px** (the `distance` option), even though AOS slides by 100% of the
  element's size. This difference is intentional.
- **`respectReducedMotion` defaults to `true`.** AOS has no reduced-motion handling, so this is the
  one default that knowingly differs from AOS.
- **No lighter / `motion/mini` build for now** (GitHub issue 9 asks about bundle size). Not wanted
  at this stage.
- **A CDN build is supported**: `dist/mos.global.js` exposing `window.MOS`, like AOS's `window.AOS`.
- **quad / cubic / quart easings share identical curves on purpose**: AOS ships them that way.
- **Release order: publish to npm before the docs deploy.** The docs show CDN snippets and options
  that 404 or do not exist until the matching version is on npm.

## Where things are

- `packages/motion-on-scroll` - the published npm library.
  - `src/index.ts` - public API and lifecycle: `init`, `refresh`, `refreshHard`, `destroy`,
    `register*`, the `MOS` object, exported types; option merging, disable / reduced-motion path,
    start / load / resize listeners.
  - `src/global.ts` - entry for the standalone `window.MOS` build (also re-exports Motion's `animate`).
  - `src/helpers/constants.ts` - `DEFAULT_OPTIONS`, `EASINGS`, `KEYFRAMES_PRESETS` (the 27 presets).
  - `src/helpers/types.ts` - `MosOptions`, `ElementOptions`, `MosElement`.
  - `src/helpers/attributes.ts` - reads `data-mos-*` attributes into per-element options.
  - `src/helpers/elements.ts` - the tracked-element registry; `prepareElements` keeps state across refreshes.
  - `src/helpers/scroll-handler.ts` - the AOS-style show / hide decision and trigger positions per scroll.
  - `src/helpers/position-calculator.ts` - offsets, anchors and the 9 anchor placements.
  - `src/helpers/animations.ts` - creates Motion animations; `play` / `reverse`, show delay,
    class names, `mos:in` / `mos:out` events, `registerAnimation`.
  - `src/helpers/easing.ts`, `keyframes.ts` - parsing and the custom registries.
  - `src/helpers/observer.ts` - MutationObserver that triggers `refreshHard`.
  - `src/css/mos.css` - stylesheet, minified into `dist/` by the build.
  - `src/__tests__/*.spec.ts` - vitest specs; `lifecycle.spec.ts` is the integration spec (real
    modules, only `motion` mocked).
  - `tsdown.config.ts` - two builds: ESM `dist/index.js` (+ `.d.ts`, `motion` external) and the
    IIFE `dist/mos.global.js` (Motion bundled); the CSS is built in its `onSuccess` hook.
- `apps/docs` - Astro Starlight docs site (workspace package `motion-on-scroll-docs`), deployed at
  https://motion-on-scroll.pages.dev. Content in `src/content/docs/**/*.mdx`; the live preset demo
  is `src/components/MosDemo.astro`.
- `.changeset` - changesets config and pending changesets.
- `.github/workflows` - `ci.yml` (typecheck, build, lint, tests, docs build) and `release.yml`.
- Root: turbo (`turbo.json`), shared eslint / prettier config, `pnpm-workspace.yaml` (workspace and
  all pnpm settings).

## Commands (run from repo root; pnpm only, enforced by `preinstall`)

- Install: `pnpm install`
- Build everything: `pnpm build` (turbo); library only: `pnpm mos:build`
- Test, one-shot: `pnpm --filter=motion-on-scroll test:run`
  - `pnpm test` is plain `vitest`, which is watch mode in a terminal.
  - Coverage: `pnpm test:coverage`
- Typecheck: `pnpm typecheck` (turbo -> `tsc --noEmit`; library `src` only, specs are excluded)
- Lint + format check (library): `pnpm mos:format:check` (`eslint . && prettier --check .`)
- Lint + format fix: `pnpm format` (whole repo) or `pnpm mos:format` (library)
- What CI runs: `pnpm typecheck`, `pnpm run ci` (= `mos:build`, `mos:format:check`, `test:run`),
  then `pnpm docs:build`
- Docs dev server: `pnpm docs:dev` (needs the library built first: `pnpm mos:build`); build:
  `pnpm docs:build`, which builds the library itself. The docs always use the workspace library,
  not the npm release.
- Library watch build: `pnpm mos:dev`

## Conventions

- ESM TypeScript; relative imports use the `.js` suffix (`./helpers/constants.js`).
- Double quotes; formatting by prettier, import order by eslint simple-import-sort.
- Section-banner comments (`// ====...` / `// SECTION NAME`) to divide files.
- JSDoc on functions (with `@param` / `@returns` where useful).
- Tests live in `src/__tests__/*.spec.ts`, run in jsdom; `motion` is mocked globally in
  `packages/motion-on-scroll/vitest.setup.ts` (individual specs may override the mock). Tests
  assert outcomes (state, DOM, call arguments), not merely that a mock was called.
- Docs must match the code: when changing an option, default, or attribute, update
  `apps/docs/src/content/docs/reference/{api,attributes}.mdx`,
  `getting-started/migrate-from-aos.mdx` and both READMEs.
- MDX does not accept `<!-- -->` comments; use `{/* ... */}` in `.mdx` files.

## Verifying animation behaviour

jsdom has no layout or animation engine and the unit tests mock `motion`, so they cannot show
whether an animation looks right. Any change to animation behaviour needs a real-browser check:

- Build, then load a static page that includes `dist/mos.css` and `dist/mos.global.js` and calls
  `MOS.init()`; drive scrolling and sample computed `opacity` / `transform` per frame.
- Use a visible or headless browser. A hidden tab or pane throttles `requestAnimationFrame`, so
  animations appear stuck there.
- The library supports Motion `^12.23.3 || ^13 || ^14`. For changes that touch Motion's controls,
  bundle `dist/index.js` against the oldest and newest supported versions and repeat the check.

## Releases

- Add a changeset (`pnpm changeset`) for any user-visible library change: one changeset per
  logical change, `minor` for features, `patch` for fixes. `motion-on-scroll-docs` is ignored by
  changesets.
- On push to `main`, `.github/workflows/release.yml` runs `changesets/action`, which only opens or
  updates the "Version Packages" PR. It does not publish.
- Publishing to npm is manual: `pnpm mos:publish:release` (or `mos:publish:beta` /
  `mos:publish:next`); `prepublishOnly` runs the library's `ci` script first. Publish before the
  docs deploy (see Maintainer decisions).

## Gotchas

- Node: development needs `^22.22.2 || >=24` (root `engines`). On older 22.x `tsdown` fails with
  `Failed to import module "unrun"` because it cannot load `tsdown.config.ts` natively, and jsdom
  needs 22.22.2. `.node-version` pins the version for hosted builds: Cloudflare Pages defaults to
  Node 22.16 without it. Pages runs `pnpm mos:build && pnpm docs:build`, output `apps/docs/dist`,
  and only rebuilds when files under `apps/docs/` change.
- TypeScript is pinned to 6.0.x: `typescript-eslint` does not support TypeScript 7 yet. Re-check
  before bumping.
- pnpm is pinned to 11.x in `packageManager`. Its settings live in `pnpm-workspace.yaml`; pnpm 11
  no longer reads `.npmrc` or the `pnpm` field in `package.json` for them. pnpm's release-age
  cooldown rejects packages published in the last day, so a very fresh version may not resolve yet.
- Element state follows AOS's model: `animated` flips as soon as an element starts animating in or
  out. Do not rely on Motion's `controls.finished` to track state: after an animation has finished
  once, a replayed WAAPI animation reports an already-resolved promise.
- The show delay is applied by MOS with a timer, not passed to Motion: a delay inside Motion's
  timeline is replayed in the wrong place when the animation runs backwards. Like AOS, there is no
  delay on the way out.
- `releaseIdleFrameLoop` in `helpers/animations.ts` uses Motion internals
  (`animations[].animation.stopDriver()`) to stop paused animations ticking every frame. It is
  guarded, so if a Motion upgrade removes them the only symptom is idle `requestAnimationFrame`
  activity. Re-check it when bumping Motion.
- Completing a reversed Motion animation ends on its first (hidden) keyframe; set `speed = 1`
  before `complete()` when the goal is "show it".

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
