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
- Tailwind CSS

### New Stack

**Status: NOT YET DECIDED**

The new stack needs to be determined through discussion with the project owner.

---

## How This File Works

This file serves as the central context document for AI agents working on this project. Each agent session should:

1. Read this file to understand the project state
2. Complete the current task (marked with `[CURRENT]`)
3. Update this file with progress and mark the next task as current
4. Provide a summary of what was accomplished

---

## Tasks

### Task 1: Determine the New Technology Stack `[CURRENT]`

**Objective:** Have a conversation with the project owner to determine what technologies should be used for the new version.

**Instructions for Agent:**

1. Review the old version's structure in `old-version/` to understand the application's requirements
2. Ask the project owner questions about:
   - Frontend framework preferences (React, Vue, Svelte, etc.)
   - Backend/API preferences (serverless, traditional server, edge functions, etc.)
   - Database preferences (SQL, NoSQL, local-first, etc.)
   - Hosting preferences (Vercel, AWS, Cloudflare, self-hosted, etc.)
   - Authentication requirements
   - Any specific technologies they want to try or avoid
3. Document the chosen stack in the "New Stack" section above
4. Create the next task for initial project setup

**Completion Criteria:**

- [ ] New stack is documented in this file
- [ ] Project owner has confirmed the technology choices
- [ ] Next task is created for project scaffolding

---

## Completed Tasks

(None yet)

---

## Notes & Decisions

(Add important decisions and context here as the project progresses)
