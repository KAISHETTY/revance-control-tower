/** True when the browser can create a WebGL context. `?webgl=0` forces false for testing. */
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("webgl") === "0") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
