import { useEffect, useRef, useState } from "react";

const COLOR_PAIRS = [
  { default: "#2DD4BF", pointer: "#F59E0B" }, // teal + amber
  { default: "#A78BFA", pointer: "#F472B6" }, // purple + pink
  { default: "#34D399", pointer: "#F87171" }, // green + red
  { default: "#60A5FA", pointer: "#FBBF24" }, // blue + yellow
  { default: "#F472B6", pointer: "#4ADE80" }, // pink + lime
  { default: "#FB923C", pointer: "#38BDF8" }, // orange + sky
  { default: "#E879F9", pointer: "#A3E635" }, // fuchsia + lime
  { default: "#F43F5E", pointer: "#67E8F9" }, // rose + cyan
];

// Cursor shape: classic arrow cursor outline
// Hotspot at tip (top-left of arrow) = 0,0
// Path: tip → down-right along left edge → notch cut-in → tail → back to tip
function makeCursorSVG(color: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>
    <path
      d='M2 2 L2 16 L6 12 L10 19 L12 18 L8 11 L14 11 Z'
      fill='none'
      stroke='${color}'
      stroke-width='1.5'
      stroke-linejoin='round'
      stroke-linecap='round'
    />
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2, auto`;
}

export default function CustomCursor() {
  const pair = useRef(COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const { default: dc, pointer: pc } = pair.current;

    const css = `
      *, *::before, *::after {
        cursor: ${makeCursorSVG(dc)} !important;
      }
      a, button, [role="button"], [tabindex="0"],
      select, label[for],
      input[type="checkbox"], input[type="radio"],
      input[type="submit"], input[type="button"], input[type="range"] {
        cursor: ${makeCursorSVG(pc)} !important;
      }
    `;

    const style = document.createElement("style");
    style.id = "mfd-custom-cursor";
    document.getElementById("mfd-custom-cursor")?.remove();
    style.textContent = css;
    document.head.appendChild(style);

    return () => { document.getElementById("mfd-custom-cursor")?.remove(); };
  }, [mounted]);

  return null;
}