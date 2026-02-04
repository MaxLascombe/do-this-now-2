# Do-This-Now 2.0 - Task Context & Progress

## Project Overview

We are recreating the "do-this-now" task manager application with a completely new technology stack. The original version is preserved in the `old-version/` folder as a Git submodule for reference.

### What is Do-This-Now?

Do-This-Now is a task manager with one key feature: **it tells the user what they should work on now**. All tasks are prioritized automatically based on certain parameters, and the top task is served to the user. The user doesn't choose what to work on—the app decides for them.

### Original Stack (for reference)

The old version in `old-version/` uses:

- TypeScript/JavaScript
- React (Vite)
- AWS Amplify (backend)
- Lambda functions
- DynamoDB
- Tailwind CSS

### New Stack

| Layer     | Choice          |
| --------- | --------------- |
| Framework | TanStack Start  |
| Database  | Vercel Postgres |
| ORM       | Drizzle         |
| Auth      | Clerk           |
| Styling   | Tailwind CSS    |
| Hosting   | Vercel          |

---

## How This File Works

This file serves as the central context document for AI agents working on this project. Each agent session should:

1. Read this file to understand the project state
2. Review all pending tasks and pick the most important one (based on dependencies and priority)
3. Complete the chosen task
4. Update this file with progress and mark the task as done

**Note:** Tasks are unordered. Pick the most impactful task to work on, not necessarily the first one listed.

---

## Tasks

### Scaffold TanStack Start project

- [ ] Initialize a new TanStack Start project in the root directory
- [ ] Ensure it builds and runs locally
- [ ] Basic Tailwind CSS setup

### Deploy to Vercel

- [ ] Connect the repo to Vercel
- [ ] Get a successful deployment of the base TanStack Start app (even with no custom code)
- [ ] Verify the deployed URL works

### Set up Drizzle with Vercel Postgres

- [ ] Install Drizzle and required dependencies
- [ ] Create database schema for tasks and history tables
- [ ] Set up Drizzle config and migrations
- [ ] Connect to Vercel Postgres (use environment variables)

### Set up Clerk authentication

- [ ] Install Clerk SDK
- [ ] Configure Clerk provider in the app
- [ ] Create sign-in/sign-out flow
- [ ] Protect routes that require authentication

### Implement task data model

- [ ] Define Task type/schema matching old version (title, due, repeat, timeFrame, strictDeadline, subtasks, snooze)
- [ ] Define History type/schema
- [ ] Create Drizzle migrations

### Implement task sorting algorithm

- [ ] Port the sorting logic from `old-version/shared-logic/task-sorting.ts`
- [ ] Create server function to fetch and sort tasks
- [ ] Return top 3 tasks to the client

### Build home page UI

- [ ] Display top 3 prioritized tasks
- [ ] Task selection (click or keyboard shortcuts 1/2/3)
- [ ] Action buttons: Complete, Snooze, Edit, Delete
- [ ] Progress indicator for today

### Build task list page

- [ ] Display all tasks
- [ ] Link to edit each task

### Build task form (create/edit)

- [ ] Form fields for all task properties
- [ ] Validation with Zod
- [ ] Create and update server functions

### Implement task actions

- [ ] Complete task (handle repeat logic, update history)
- [ ] Snooze task
- [ ] Delete task

### Build history page

- [ ] Display tasks completed today
- [ ] Option to view past days

### Add keyboard shortcuts

- [ ] Port keyboard navigation from old version
- [ ] d=done, n=new, s=snooze, u=update, t=tasks, h=history, etc.

### Add sound effect on task completion

- [ ] Port the "ding" sound from old version

### Polish and testing

- [ ] Responsive design
- [ ] Error handling
- [ ] Loading states

---

## Completed Tasks

- [x] Determine the new technology stack (2024-02-03)
  - Decided on: TanStack Start, Vercel Postgres, Drizzle, Clerk, Tailwind CSS, Vercel hosting

---

## Notes & Decisions

- **2024-02-03:** Stack decision made. Chose TanStack Start to explore the new framework. Vercel Postgres chosen for simplicity (same as Neon under the hood). Drizzle for ORM (T3-approved, lightweight for serverless). Clerk for auth (modern DX). Continuing with Tailwind for styling.
- The old app has simple database needs: ~2 tables, no complex joins, low volume personal use.
- Task sorting algorithm prioritizes: not snoozed > due today/past due > strict deadline > won't repeat tomorrow > won't repeat today > earlier due date > shorter time frame.
