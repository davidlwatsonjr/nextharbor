# NextHarbor

A browser-local workspace built around David Allen’s Getting Things Done method.

- **Capture** thoughts and commitments in an inbox.
- **Clarify** each item into a concrete next action, a project outcome, a delegated commitment, a date-specific commitment, a deferred idea, reference, or trash. Record a two-minute action as done from the same dialog.
- **Organize** actions by context, time, and energy. Link actions to projects and see which projects are missing an actionable reminder.
- **Reflect** with a weekly review checklist that remembers your progress.
- **Engage** by filtering your Next Actions by current context, available time, and energy.

The app stores a versioned workspace in IndexedDB. Changes are transactional. There are no accounts, servers, external assets, or synchronization between devices in this version. Export and import JSON under **Data & backups**. Imports replace the workspace after confirmation. Moving to another domain, port, or browser gives you a separate workspace. Offline use on a hosted origin starts after a successful first load and service-worker activation.

## Run locally

Node 22 or newer.

```sh
npm ci
npm test
npm run build
npm run verify:offline
npm run preview
```

Open the loopback URL printed by Vite. For fast frontend edits without the offline behavior, run `npx vite`.

## GitHub Pages

Create the empty repository `davidlwatsonjr/nextharbor`. If importing the release bundle, clone it and point the checkout at your repository.

```sh
git clone -b main nextharbor.bundle nextharbor
cd nextharbor
git remote set-url origin https://github.com/davidlwatsonjr/nextharbor.git
git push -u origin main
```

In **Settings → Pages**, select **GitHub Actions** as the source and run **Deploy NextHarbor** manually if the initial push preceded the Pages setup. The workflow tests, builds, checks the offline assets, and deploys `dist/` on pushes to `main` or manual runs from `main`. Pull requests run the build and tests.

The relative build paths support both `davidlwatsonjr.github.io/nextharbor/` and a custom domain. To use the proposed `nextharbor.davidlwatsonjr.com`, add a DNS CNAME pointing to `davidlwatsonjr.github.io`, configure the custom domain in Pages settings, then enable HTTPS. The checked-in CNAME documents the intended domain. GitHub Actions publishing still requires configuring it in Pages settings.

## Code layout

- `src/gtd.ts` owns the workspace model, rules, and backup format.
- `src/storage.ts` owns IndexedDB persistence. It provides the boundary for a future account-backed store.
- `src/App.tsx` and `src/Editor.tsx` render the lists, review, and clarification flow.
- `scripts/` generates and verifies the production precache.

This is an independent implementation. The initial scope covers the core workflow. Horizons of Focus, the Natural Planning Model, calendar integration, and account-backed sync are outside this prototype.
