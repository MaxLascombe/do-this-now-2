import { r as reactExports, j as jsxRuntimeExports } from "../_chunks/_libs/react.mjs";
import { g as getPunkSongs } from "./router-VK4P8qu0.mjs";
import "../_chunks/_libs/@tanstack/react-router.mjs";
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
import "./index.mjs";
import "node:async_hooks";
import "../_libs/lucide-react.mjs";
function RouteComponent() {
  const [punkSongs, setPunkSongs] = reactExports.useState([]);
  reactExports.useEffect(() => {
    getPunkSongs().then(setPunkSongs);
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white", style: {
    backgroundImage: "radial-gradient(50% 50% at 20% 60%, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)"
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-bold mb-6 text-green-400", children: "SPA Mode - Punk Songs" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-3", children: punkSongs.map((song) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "bg-white/10 border border-white/20 rounded-lg p-4 backdrop-blur-sm shadow-md", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-lg text-white font-medium", children: song.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-white/60", children: [
        " - ",
        song.artist
      ] })
    ] }, song.id)) })
  ] }) });
}
export {
  RouteComponent as component
};
