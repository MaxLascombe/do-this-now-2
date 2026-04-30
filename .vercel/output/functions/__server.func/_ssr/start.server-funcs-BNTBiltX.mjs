import { r as reactExports, j as jsxRuntimeExports } from "../_chunks/_libs/react.mjs";
import { R as Route$6, c as createSsrRpc } from "./router-VK4P8qu0.mjs";
import { u as useRouter } from "../_chunks/_libs/@tanstack/react-router.mjs";
import { c as createServerFn } from "./index.mjs";
import "../_libs/lucide-react.mjs";
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
import "node:async_hooks";
const addTodo = createServerFn({
  method: "POST"
}).inputValidator((d) => d).handler(createSsrRpc("34a400ef155cae4517b50b99a6f1db6819e2090dea5a8bc25de22b442e6347a4"));
function Home() {
  const router = useRouter();
  let todos = Route$6.useLoaderData();
  const [todo, setTodo] = reactExports.useState("");
  const submitTodo = reactExports.useCallback(async () => {
    todos = await addTodo({
      data: todo
    });
    setTodo("");
    router.invalidate();
  }, [addTodo, todo]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white", style: {
    backgroundImage: "radial-gradient(50% 50% at 20% 60%, #23272a 0%, #18181b 50%, #000000 100%)"
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl mb-4", children: "Start Server Functions - Todo Example" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mb-4 space-y-2", children: todos?.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-lg text-white", children: t.name }) }, t.id)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "text", value: todo, onChange: (e) => setTodo(e.target.value), onKeyDown: (e) => {
        if (e.key === "Enter") {
          submitTodo();
        }
      }, placeholder: "Enter a new todo...", className: "w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { disabled: todo.trim().length === 0, onClick: submitTodo, className: "bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors", children: "Add todo" })
    ] })
  ] }) });
}
export {
  Home as component
};
