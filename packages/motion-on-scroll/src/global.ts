// ===================================================================
// MOTION-ON-SCROLL (MOS) - Browser Global Entry Point
// ===================================================================
// Entry for the standalone `dist/mos.global.js` build, which is loaded with a
// plain <script> tag and exposes everything on `window.MOS` (like AOS does
// with `window.AOS`). Motion is bundled in, and its `animate` function is
// re-exported so custom animations can be registered without a bundler.

export {
  destroy,
  init,
  refresh,
  refreshHard,
  registerAnimation,
  registerEasing,
  registerKeyframes,
} from "./index.js";
export { animate } from "motion";
