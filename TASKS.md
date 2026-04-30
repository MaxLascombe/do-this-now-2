# Pending Tasks

Do-This-Now 2.0: we're rebuilding the "do-this-now" task manager (the app tells
you what to work on now) with a new stack. See `CURRENT_STATE.md` for what
exists today and `PROMPT.md` for how to work on this list.

**Stack:** TanStack Start (frontend, Vercel) + Express (backend, Railway) +
PostgreSQL + Drizzle ORM + Clerk + Tailwind CSS.

Tasks below are unordered. Pick one by priority (see PROMPT.md).

---

- Connect server to PostgreSQL via `DATABASE_URL` (already wired in
  `server/src/db/index.ts`, just needs a real DB and migration run)
- Create Drizzle migrations for tasks/history
  (`pnpm db:generate && pnpm db:migrate` in server/)
- Install and configure Clerk on the server (`@clerk/express`, protect routes
  with `requireAuth`)
- Install and configure Clerk on the frontend (`@clerk/react`, wrap router in
  `<ClerkProvider>`)
- Create sign-in/sign-out flow on the frontend
- Protect frontend routes that require authentication
- Create Express route `GET /tasks` that fetches, sorts, and returns top 3 tasks
  for the authenticated user
- Create Express routes for task CRUD: `POST /tasks`, `PUT /tasks/:id`,
  `DELETE /tasks/:id`
- Create Express route `POST /tasks/:id/complete` (handle repeat logic, write
  history)
- Create Express route `POST /tasks/:id/snooze`
- Create Express route `GET /history` (tasks completed today)
- Display top 3 prioritized tasks on the frontend home page
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
- Add knip to the project (dead code, unused deps)
