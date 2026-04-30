import { j as jsxRuntimeExports } from "../_chunks/_libs/react.mjs";
import { L as Link } from "../_chunks/_libs/@tanstack/react-router.mjs";
import "../_libs/tiny-warning.mjs";
import "../_chunks/_libs/@tanstack/router-core.mjs";
import "../_chunks/_libs/@tanstack/history.mjs";
import "../_libs/tiny-invariant.mjs";
import "node:stream/web";
import "node:stream";
import "../_chunks/_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
function RouteComponent() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-900 to-black p-4 text-white", style: {
    backgroundImage: "radial-gradient(50% 50% at 20% 60%, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)"
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-4xl font-bold mb-8 text-center bg-gradient-to-r from-pink-500 via-purple-500 to-green-400 bg-clip-text text-transparent", children: "SSR Demos" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/demo/start/ssr/spa-mode", className: "text-2xl font-bold py-6 px-8 rounded-lg bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 text-white text-center shadow-lg transform transition-all hover:scale-105 hover:shadow-pink-500/50 border-2 border-pink-400", children: "SPA Mode" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/demo/start/ssr/full-ssr", className: "text-2xl font-bold py-6 px-8 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-center shadow-lg transform transition-all hover:scale-105 hover:shadow-purple-500/50 border-2 border-purple-400", children: "Full SSR" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/demo/start/ssr/data-only", className: "text-2xl font-bold py-6 px-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-center shadow-lg transform transition-all hover:scale-105 hover:shadow-green-500/50 border-2 border-green-400", children: "Data Only" })
    ] })
  ] }) });
}
export {
  RouteComponent as component
};
