# Pending Tasks

Do-This-Now 2.0: we’re rebuilding the “do-this-now” task manager (the app tells you what to work on now) with a new stack. See `CURRENT_STATE.md` for what exists today and `PROMPT.md` for how to work on this list.

**Stack:** TanStack Start, Neon, Drizzle, Clerk, Tailwind CSS, Vercel.

Tasks below are unordered. Pick one by priority (see PROMPT.md).

---

- Connect the repo to Vercel
- Get a successful deployment of the base TanStack Start app (even with no custom code)
- Verify the deployed URL works
  Create database schema for tasks and history tables
- Connect to Neon (use environment variables, e.g. DATABASE_URL)
- Install Clerk SDK
- Configure Clerk provider in the app
- Create sign-in/sign-out flow
- Protect routes that require authentication
- Define Task type/schema matching old version (title, due, repeat, timeFrame, strictDeadline, subtasks, snooze)
- Define History type/schema
- Create Drizzle migrations for task/history
- Port the sorting logic from `old-version/shared-logic/task-sorting.ts`
- Create server function to fetch and sort tasks
- Return top 3 tasks to the client
- Display top 3 prioritized tasks on home page
- Task selection on home (click or keyboard shortcuts 1/2/3)
- Action buttons on home: Complete, Snooze, Edit, Delete
- Progress indicator for today on home
- Display all tasks on task list page
- Link to edit each task from task list
- Form fields for all task properties (create/edit)
- Validation with Zod for task form
- Create and update server functions for tasks
- Complete task (handle repeat logic, update history)
- Snooze task
- Delete task
- Display tasks completed today on history page
- Option to view past days on history page
- Port keyboard navigation from old version (d=done, n=new, s=snooze, u=update, t=tasks, h=history, etc.)
- Port the "ding" sound from old version on task completion
- Responsive design
- Error handling
- Loading states
- Add knip to the project (dead code, unused deps, etc.)
