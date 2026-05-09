# Pending Tasks

Do-This-Now 2.0: we're rebuilding the "do-this-now" task manager (the app tells
you what to work on now) with a new stack. See `CURRENT_STATE.md` for what
exists today and `PROMPT.md` for how to work on this list.

**Stack:** TanStack Start (frontend + Nitro server, Railway) + PostgreSQL +
Drizzle ORM + Clerk + Tailwind CSS. Single deploy.

Tasks below are unordered. Pick one by priority (see PROMPT.md).

---

**Auth (Clerk)**

- Install and configure Clerk for TanStack Start (`@clerk/tanstack-react-start`)
- Wrap the router in `<ClerkProvider>` and add sign-in / sign-out flow
- Protect routes that require authentication
- Use `auth()` in server functions / API routes to gate access

**API (TanStack Start server functions or `src/routes/api/*`)**

- `getTopTasks` server function: fetch, sort, return top 3 tasks for the
  authenticated user
- `createTask`, `updateTask`, `deleteTask` server functions
- `completeTask` server function (handle repeat logic, write history)
- `snoozeTask` server function
- `getHistory` server function (tasks completed today, optionally past days)

**UI**

- Display top 3 prioritized tasks on the home page
- Task selection on home (click or keyboard shortcuts 1/2/3)
- Action buttons on home: Complete, Snooze, Edit, Delete
- Progress indicator for today on home
- Display all tasks on task list page
- Link to edit each task from task list
- Form with all task fields (create/edit), validated with Zod
- Display tasks completed today on history page
- Option to view past days on history page
- Port keyboard navigation from old version (d=done, n=new, s=snooze, u=update,
  t=tasks, h=history, etc.)
- Port the "ding" sound from old version on task completion
- Responsive design
- Error handling
- Loading states

**Tooling**

- Add knip to the project (dead code, unused deps)
