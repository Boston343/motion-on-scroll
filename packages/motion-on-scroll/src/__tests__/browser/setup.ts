// ===================================================================
// BROWSER TEST SETUP
// ===================================================================
// Counts requestAnimationFrame calls so specs can tell whether Motion's frame
// loop is still running. Motion keeps a reference to requestAnimationFrame when
// it loads, so the wrapper has to be in place before any spec imports it.

const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
let frameRequests = 0;

window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  frameRequests++;
  return nativeRequestAnimationFrame(callback);
};

declare global {
  var mosFrameRequests: () => number;
}

globalThis.mosFrameRequests = () => frameRequests;
