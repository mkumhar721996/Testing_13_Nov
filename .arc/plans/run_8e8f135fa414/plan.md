summary: |
  Add the single Organization screen end to end, following the approved prototype. The Web API (Fastify, PostgreSQL) gets an `organizations` table, a seed with one organization, and `GET /organizations/:id` and `PUT /organizations/:id`, built the same way as the existing expenses feature (a `stores/` store, a `validation/` module, a route plugin, injection through `buildApp`). The PUT validates on the server (name required; admin email, FC email and FC phone well-formed when present) and returns per-field errors with status 400, as `POST /expenses` does. The Web App gets an `organization/` feature folder with a read view, an in-card edit form, inline field errors that keep what was typed, and loading and error states. The design system tokens and component classes are already loaded in `apps/web/src/index.css`, so no styling plumbing is needed. There is no list screen; create and delete stay with the sibling epic.
scope:
  - description: |
      Database migration and seed. Add `services/api/migrations/002_create_organizations.sql`, written re-runnable like `001_create_expenses.sql` (the existing `src/migrate.ts` applies every `migrations/*.sql` in name order and relies on `IF NOT EXISTS`, so no new runner is needed):

      ```sql
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        address text NULL,
        admin_name text NULL,
        admin_email text NULL,
        created_by text NOT NULL,
        fc_name text NULL,
        fc_email text NULL,
        fc_phone text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ```

      Add `services/api/src/seed.ts` (same `process.argv[1] === import.meta.filename` entry pattern as `migrate.ts`) that inserts one organization with a fixed id using `ON CONFLICT (id) DO NOTHING`. Add package.json scripts `"migrate": "tsx src/migrate.ts"` and `"seed": "tsx src/seed.ts"`.
    files:
      - services/api/migrations/002_create_organizations.sql
      - services/api/src/seed.ts
      - services/api/package.json
    rationale: |
      The story is "backed by the API and database" and no organizations table exists (only 001_create_expenses.sql). Creating organizations belongs to the sibling epic, so a seed gives the screen one record. `created_by` is system-recorded and no create flow exists, so only the seed sets it and the API never accepts it from the client.
  - description: |
      Server validation (authoritative), a pure module next to `validation/expense.ts` and in the same style.

      ```ts
      export type OrganizationInput = {
        name: string; address: string | null; adminName: string | null; adminEmail: string | null;
        fcName: string | null; fcEmail: string | null; fcPhone: string | null;
      };
      export type OrganizationErrors = Partial<Record<keyof OrganizationInput, string>>;
      export function validateOrganizationInput(
        body: unknown,
      ): { ok: true; value: OrganizationInput } | { ok: false; errors: OrganizationErrors };
      ```

      Rules: trim every string; non-string values count as blank. Blank name gives `Enter the organization name.` Blank optional values become null. Email is valid when it matches `^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$` (one @, text on both sides, a dot in the domain), message `Enter an email like name@example.com.` Phone is valid when it matches `^\+?\d{7,15}$`, message `Enter 7 to 15 digits, with an optional + at the start.` Any `createdBy` in the body is ignored. Messages come from the prototype's `validate()`.
    files:
      - services/api/src/validation/organization.ts
      - services/api/test/unit/organization-validation.test.ts
    rationale: |
      One place decides what a valid organization is. The settled project decision fixes the rules (only name mandatory; email and phone formats).
  - description: |
      Store and routes, following `stores/expenses.ts` and `routes/expenses.ts`.

      ```ts
      export type Organization = OrganizationInput & { id: string; createdBy: string };
      export interface OrganizationStore {
        get(id: string): Promise<Organization | undefined>;
        update(id: string, input: OrganizationInput): Promise<Organization | undefined>;
      }
      export const pgOrganizationStore: OrganizationStore;
      ```

      `update` is one statement, `UPDATE organizations SET name=$2, address=$3, admin_name=$4, admin_email=$5, fc_name=$6, fc_email=$7, fc_phone=$8, updated_at = now() WHERE id = $1 RETURNING ...` with camelCase aliases, and never touches `created_by`. Because it is one atomic UPDATE, two simultaneous saves serialise in Postgres: the last commit wins and no row is half-written. A malformed (non-uuid) id must give 404, not a 500 (check the id against a uuid regex in the route before querying).

      `organizationRoutes(deps)` registers `GET /organizations/:id` (200, or 404 `{ error: 'Organization not found.' }`) and `PUT /organizations/:id` (200 with the saved organization, 400 `{ errors }` on validation failure as `POST /expenses` does, 404 when missing). Extend `AppOptions` and `buildApp`:

      ```ts
      // AppOptions gains
      organizations?: OrganizationStore;
      // buildApp
      app.register(organizationRoutes({ organizations: opts.organizations ?? pgOrganizationStore }));
      ```

      The routes are not behind `requireUser`; see the open question on authentication.
    files:
      - services/api/src/stores/organizations.ts
      - services/api/src/routes/organizations.ts
      - services/api/src/app.ts
      - services/api/test/unit/organizations.test.ts
      - services/api/test/e2e/organizations.spec.ts
    rationale: |
      Follows the existing store/route/DI pattern so unit tests use a fake store and need no database, as `expenses.test.ts` does. Last-write-wins with no optimistic locking is the simplest reading of the deferred concurrency questions.
  - description: |
      Web client and validation under `apps/web/src/organization/`, in the style of `expenses/api.ts` and `expenses/validation.ts`.

      ```ts
      export type OrganizationValues = { name: string; address: string; adminName: string; adminEmail: string;
        fcName: string; fcEmail: string; fcPhone: string };
      export type Organization = OrganizationValues & { id: string; createdBy: string };
      export type OrganizationErrors = Partial<Record<keyof OrganizationValues, string>>;
      export class OrganizationRejectedError extends Error { constructor(readonly errors: OrganizationErrors) }
      export function getOrganization(id: string): Promise<Organization>;   // throws on non-2xx
      export function saveOrganization(id: string, v: OrganizationValues): Promise<Organization>; // 400 throws OrganizationRejectedError
      export function validateOrganizationForm(v: OrganizationValues): OrganizationErrors;
      ```

      The API returns null for blank optionals, so `getOrganization` maps null to `''` for form use. `validateOrganizationForm` repeats the server's rules and messages so the error shows with no round trip; the server's 400 `errors` are shown too.
    files:
      - apps/web/src/organization/api.ts
      - apps/web/src/organization/validation.ts
      - apps/web/src/organization/validation.test.ts
    rationale: |
      The client and server rules must stay identical; the boundary cases in the tests pin both copies to the same behaviour.
  - description: |
      `OrganizationPage` (default export) takes `organizationId: string`, fetches on mount and renders these states from the approved prototype:

      - Page head: `h1` "Organization" (prototype `.page-head h1`, `--color-primary`, `--font-size-xl`).
      - Loading: `.skeleton` lines (prototype `.skeleton-line`) inside `role="status"` with `aria-busy` and label "Loading organization".
      - Load error: `.alert .alert-danger` "We couldn't load this organization. Check your connection and try again." with a "Try again" `.btn .btn-primary` that refetches. A 404 also lands here.
      - Read view, in one `.card.stack.org-card`: organization name as the single `h2` (`.detail-title`), Address, Admin (name and email), Created by, and the `.fc-box` with FC contact name, email and phone. Each value is `.detail-label` + `.detail-value`; a blank value reads "Not provided" in `.text-muted`; an all-blank FC group reads "No FC contact added". "Edit" is the single `.btn-primary` in `.actions`. The prototype's Delete button and its "handled in a separate release" toast are NOT built; delete belongs to the sibling epic. No list or table is rendered.
      - Edit form in the same card: `<form noValidate>`, a `.form-grid` with Organization name (required, tagged with `.req`), Address, Admin name, Admin email; then Created by as `.readonly-value` plain text with hint "Recorded by the system when the organization was created. It can't be changed." and no input; then `fieldset.fc-group` with legend "FC contact (optional)" holding Contact name, Contact email, Contact phone (hint "7 to 15 digits, optional + at the start. No spaces."). Every control sits in a `.field` with a label tagged (required) or (optional). Buttons: "Save changes" (`.btn-primary`, disabled with a `.spinner` and "Saving…" while pending) and "Cancel" (`.btn-secondary`, returns to the read view and discards edits).
      - Blocked save (client check, or a 400 from the API): stays in edit mode with every typed value kept; `.field-error` beside each bad field referenced by `aria-describedby`, plus `aria-invalid="true"` and `.is-invalid` on the input; an `.alert-danger role="alert"` "Not saved. Fix N field(s) below. What you typed is still in the form."; focus moves to the first invalid input. A non-400 failure keeps the form and shows an `.alert-danger` "We couldn't save the organization. Try again."
      - Saved: back to the read view with `.alert-success role="status"` "Organization saved. The details below are the saved values." and the `.toast` "Organization saved".

      Wiring: `App.tsx` currently renders only `AddExpenseForm`. Change it to read `window.location.pathname`; on `/organizations/:id` render `OrganizationPage` with that id, otherwise keep rendering `AddExpenseForm` exactly as today (no router is installed and the screen is a single page, so the path is parsed by hand). `vite.config.ts` gains `server.proxy` for `/organizations` to `process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'`. Add `organization.css` with only the prototype's own classes (`.org-card`, `.detail-label`, `.detail-value`, `.detail-title`, `.fc-box`, `.actions`, `.form-grid`, `fieldset.fc-group`, `.readonly-value`, `.req`, `.skeleton-line`, `.row-wrap`, `.page-head`), written with `var(--token)` values only.
    files:
      - apps/web/src/organization/OrganizationPage.tsx
      - apps/web/src/organization/organization.css
      - apps/web/src/organization/OrganizationPage.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/vite.config.ts
    rationale: |
      Builds the approved prototype's single Organization screen and its states (default, partial, saved, loading, error, edit, edit-error). The prototype's inline sample data and Delete shortcut are not carried into production. Tokens used by organization.css, all existing in `design-system/tokens.css`: --space-1, --space-3, --font-size-sm, --font-size-lg, --font-size-xl, --color-fg-muted, --color-primary, --color-border, --color-bg-subtle, --border-width, --radius-md, --control-height-md, --font-weight-medium, --font-weight-regular. `.card`, `.stack`, `.field`, `.input`, `.field-error`, `.field-hint`, `.is-invalid`, `.alert`, `.btn-*`, `.skeleton`, `.spinner`, `.toast` come from the already-loaded `design-system/prototype-utils.css`.
tests:
  - |
    AC1, API (organizations.test.ts, fake store injected through `buildApp({ organizations })`):
    ```ts
    const res = await app.inject({ method: 'GET', url: `/organizations/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name, address, adminName, adminEmail, createdBy, fcName, fcEmail, fcPhone });
    expect((await app.inject({ method: 'GET', url: `/organizations/${missingId}` })).statusCode).toBe(404);
    ```
    AC1, UI (OrganizationPage.test.tsx, fetch mocked):
    ```ts
    expect(await screen.findByRole('heading', { level: 2, name: orgName })).toBeInTheDocument();
    for (const text of [address, adminName, adminEmail, createdBy, fcName, fcEmail, fcPhone])
      expect(screen.getByText(text)).toBeInTheDocument();
    ```
  - |
    AC2: no collection route and no list in the UI.
    ```ts
    expect((await app.inject({ method: 'GET', url: '/organizations' })).statusCode).toBe(404);
    ```
    ```ts
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    ```
  - |
    AC3: for each editable field, PUT a valid new value, then GET and see it (API, fake store; the e2e spec repeats it against real Postgres).
    ```ts
    const put = await app.inject({ method: 'PUT', url, payload: { ...valid, address: '1 New St' } });
    expect(put.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url })).json().address).toBe('1 New St');
    ```
    UI: edit a field, click "Save changes", assert the read view shows the new value and the "Organization saved" alert is present.
  - |
    AC4: created-by is read-only text in the UI and ignored by the API.
    ```ts
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText(createdBy)).toBeInTheDocument();
    expect(screen.queryByLabelText(/created by/i)).not.toBeInTheDocument();
    ```
    ```ts
    const put = await app.inject({ method: 'PUT', url, payload: { ...valid, createdBy: 'Mallory' } });
    expect(put.json().createdBy).toBe(seededCreatedBy);
    ```
  - |
    AC5: a blank name is blocked (validation, route, UI).
    ```ts
    expect(validateOrganizationInput({ ...valid, name: '   ' })).toEqual({ ok: false, errors: { name: 'Enter the organization name.' } });
    const res = await app.inject({ method: 'PUT', url, payload: { ...valid, name: '' } });
    expect(res.statusCode).toBe(400);
    expect(store.updated).toHaveLength(0);
    ```
    UI: clear the name, click "Save changes", assert `fetch` was not called with PUT and `screen.getByText('Enter the organization name.')` is shown.
  - |
    AC6: table-driven in organization-validation.test.ts for adminEmail and fcEmail with `['a', 'a@', '@b.com', 'a@b', 'a@@b.com', 'a@b@c.com']`, and for fcPhone with `['12345', '123-456-7890', '+', 'abc1234567']`. Valid values are `a@b.co` and `+15552184400`.
    ```ts
    it.each(badEmails)('rejects admin email %s', (adminEmail) => {
      expect(validateOrganizationInput({ ...valid, adminEmail }).ok).toBe(false);
    });
    expect(validateOrganizationInput({ ...valid, fcEmail: 'a@b.co', fcPhone: '+15552184400' }).ok).toBe(true);
    ```
    The route test asserts 400 and that the store was not called. validation.test.ts (web) repeats the same table against `validateOrganizationForm`, and the UI test asserts no PUT is sent for a client-invalid value.
  - |
    AC7: the API 400 body names every bad field and the UI renders a message beside each.
    ```ts
    expect(res.json().errors).toEqual({
      name: 'Enter the organization name.',
      adminEmail: 'Enter an email like name@example.com.',
      fcPhone: 'Enter 7 to 15 digits, with an optional + at the start.',
    });
    ```
    ```ts
    expect(screen.getByLabelText(/admin email/i)).toHaveAccessibleDescription('Enter an email like name@example.com.');
    expect(screen.getByLabelText(/admin email/i)).toHaveAttribute('aria-invalid', 'true');
    ```
  - |
    AC8: after a blocked save every typed value is still in its field. The UI test types into all seven inputs with a blank name and a malformed email, clicks "Save changes", and asserts:
    ```ts
    expect(screen.getByLabelText(/address/i)).toHaveValue('typed address');
    expect(screen.getByLabelText(/admin name/i)).toHaveValue('typed admin');
    expect(screen.getByLabelText(/admin email/i)).toHaveValue('karishmah@gmail');
    expect(screen.getByLabelText(/contact name/i)).toHaveValue('typed fc');
    ```
    A second case mocks a 400 response from a client-valid form and asserts the same values remain.
  - |
    AC9: the three FC fields blank and the rest valid, so the save succeeds (API and UI).
    ```ts
    const res = await app.inject({ method: 'PUT', url, payload: { ...valid, fcName: '', fcEmail: '', fcPhone: '' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ fcName: null, fcEmail: null, fcPhone: null });
    ```
    UI: after saving, `screen.getByText('No FC contact added')`.
  - |
    AC10: address, admin name and admin email blank with the name filled, so the save succeeds.
    ```ts
    const res = await app.inject({ method: 'PUT', url, payload: { ...valid, address: '', adminName: '', adminEmail: '' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ address: null, adminName: null, adminEmail: null });
    ```
    UI: the read view shows "Not provided" for Address and Admin.
  - |
    AC11: a 6-digit phone is blocked, 7 digits passes.
    ```ts
    expect(validateOrganizationInput({ ...valid, fcPhone: '123456' })).toEqual({
      ok: false, errors: { fcPhone: 'Enter 7 to 15 digits, with an optional + at the start.' } });
    expect(validateOrganizationInput({ ...valid, fcPhone: '1234567' }).ok).toBe(true);
    ```
    Also asserted through the route (400) and the UI (message shown, no PUT).
  - |
    AC12: a 16-digit phone is blocked, 15 digits and +15 digits pass.
    ```ts
    expect(validateOrganizationInput({ ...valid, fcPhone: '1234567890123456' }).ok).toBe(false);
    expect(validateOrganizationInput({ ...valid, fcPhone: '123456789012345' }).ok).toBe(true);
    expect(validateOrganizationInput({ ...valid, fcPhone: '+123456789012345' }).ok).toBe(true);
    ```
  - |
    Non-AC states in OrganizationPage.test.tsx. Loading shows `role="status"` labelled "Loading organization". A rejected fetch or a 404 shows "We couldn't load this organization", and "Try again" refetches. API: a non-uuid id returns 404, not 500. App.test.tsx: `/organizations/<id>` renders the Organization heading and any other path still renders the "Add expense" heading (mock `./organization/api` as the existing test mocks `./expenses/api`).
  - |
    Real-database check (services/api/test/e2e/organizations.spec.ts, needs Postgres, run by `pnpm run e2e`, not by the unit command): after `migrate` and `seed`, GET the seeded id, PUT a change, GET again and see it; run `migrate` twice and `seed` twice to confirm both are safe to re-run; confirm existing `expenses` rows are untouched.
assumptions_or_open_questions:
  - |
    Concurrent edits (both deferred questions) are handled as last-write-wins. Each PUT is one atomic full-row UPDATE, so simultaneous saves serialise in Postgres and no row is partially overwritten. There is no version or If-Match check and no "someone else changed this" warning. If the business wants conflict detection, that is a follow-up (an `updated_at` precondition and a 409).
  - |
    Audit logging and retention of organization changes (the open EPIC-008 and CHORE-017 questions) are not answered by the story. This plan stores only `created_at` and `updated_at` and writes no audit trail. The retention period needs a business decision before code is written; ADR-0009 (compliance and data residency) may apply.
  - |
    Authentication. The existing `/expenses` and `/categories` routes sit behind `requireUser`, but `auth.ts` is a placeholder (`noUser`) until the accounts story, and an organization is not owned by a user. This plan leaves the organization routes unauthenticated so the screen works, which means anyone who can reach the API can edit. Confirm whether to put them behind `requireUser` (and what role may edit) before this ships.
  - |
    How the screen knows which organization to show is not in the story ("identified directly, no list screen"). Assumed the id is in the URL path `/organizations/:id`, parsed by hand, with no router added. The prototype's note that Organization sits under Settings is not built because the app has no top bar or navigation yet. Confirm the route and where it is linked from.
  - |
    The validation failure status is 400, matching `POST /expenses` in this codebase, instead of 422.
  - |
    Prototype versus settled decision. The prototype headed the FC block "Fundraising consultant" but the settled decision says it is labelled "FC contact" with no expansion. The plan uses "FC contact" for the visible heading, legend and the "No FC contact added" text. Field labels stay Contact name, Contact email and Contact phone. Tell me if the prototype wording is preferred.
  - |
    The prototype's Delete button is left out because delete belongs to the sibling epic.
  - |
    Design-system gaps. `design-system/tokens.css` lines 76-77 define `--duration-fast` and `--duration-spin` as the invalid text `[object Object]`, so hover transitions, the skeleton pulse and the spinner animation are ignored by the browser until the token generator is fixed. This plan does not hand-edit generated tokens. The prototype's 48rem card max-width and form-grid breakpoint have no token and stay as rem values in organization.css, to be confirmed. The prototype's `.toast` offset is rebuilt from spacing tokens.
  - |
    Address, admin name and admin email are optional, as settled in the project decisions, although the item text says the business is still to confirm. If any becomes mandatory only the two validation modules change.
  - |
    `apps/web/e2e/app.spec.ts` still asserts a "Web App" heading that the app no longer renders. That is existing drift and is left alone; no web Playwright spec is added for this item.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: the `organizations` table is new, so no existing rows (including `expenses`) are touched. Only `id`, `name` and `created_by` are NOT NULL, the rest are nullable, so partial records stay readable. No foreign keys and no unique constraints.
  - **Backfill / seed**: `services/api/src/seed.ts` inserts one organization with a fixed id using `ON CONFLICT (id) DO NOTHING`, so it is safe to re-run. It is provisioning data for the screen, not a backfill. Run `pnpm run migrate && pnpm run seed` from `services/api`.
  - **Settings**: no new API settings; `migrate` and `seed` reuse `DATABASE_URL` read by `src/db.ts`. The Web App adds an optional dev-only `VITE_API_PROXY_TARGET` (default `http://localhost:3000`, matching the API's default port), documented in a comment in `vite.config.ts`.
  - **Provisioning**: a reachable PostgreSQL and the seeded organization row, created by the seed script.
  - **Order and rollback**: deploy migrate, then API, then web. The old web build never calls the new routes, so order is safe. Rollback is to redeploy the previous build; the unused table can stay. A `DROP TABLE organizations` down step is noted in a comment at the top of the migration.

  ### Design system loading
  Already done, so no styling plumbing is planned. `apps/web/src/index.css` imports `tailwindcss`, `../../../design-system/tokens.css` and `../../../design-system/prototype-utils.css` (lines 1-3), and `main.tsx` imports `index.css`. The existing `expenses/expense-form.css` shows the pattern: a feature stylesheet using `var(--token)` values, imported by the component. `organization.css` follows it.

  ### Code read for this plan
  `services/api/src/app.ts`, `auth.ts`, `migrate.ts`, `routes/expenses.ts`, `stores/expenses.ts`, `migrations/001_create_expenses.sql`, `test/unit/expenses.test.ts`, `apps/web/src/App.tsx`, `App.test.tsx`, `expenses/api.ts`, `expenses/AddExpenseForm.tsx`, `expenses/expense-form.css`, `index.css`, `vite.config.ts` and the prototype (styles at lines 898-914, states and copy through line 1112).

  ```mermaid
  flowchart TD
    server[server.ts] --> app[app.ts]
    app --> health[routes/health.ts]
    app --> expRoutes[routes/expenses.ts]
    app --> orgRoutes[routes/organizations.ts]
    orgRoutes --> validation[validation/organization.ts]
    orgRoutes --> store[stores/organizations.ts]
    store --> db[db.ts getPool]
    migrate[migrate.ts] --> sql[migrations/002_create_organizations.sql]
    seed[seed.ts] --> db
    main[main.tsx] --> index[index.css design-system imports]
    main --> webapp[App.tsx]
    webapp --> expForm[expenses/AddExpenseForm.tsx]
    webapp --> page[organization/OrganizationPage.tsx]
    page --> client[organization/api.ts]
    page --> cvalidate[organization/validation.ts]
    client -->|HTTP /organizations/:id| orgRoutes
    classDef touched fill:#f96,color:#000
    class app,orgRoutes,validation,store,sql,seed,webapp,page,client,cvalidate touched
  ```
  Touched nodes: app.ts takes the new store; the route, validation and store files are the API; the migration and seed create the table and one row; App.tsx chooses the screen by path; the page, client and validation files are the screen.
review_focus: |
  IN: the single Organization screen, `GET/PUT /organizations/:id`, the `organizations` table with migration and seed, and the web client and validation. OUT: create, delete, a list screen, navigation shell, auth, audit trail and optimistic locking. The riskiest area is validation, because the API and web copies must stay identical and the boundaries (6, 7, 15 and 16 digits, a single @, a dot in the domain) are the acceptance criteria. Concurrency is deliberately last-write-wins through one atomic UPDATE, `created_by` is deliberately never accepted from the client, and validation failures return 400 to match `POST /expenses`, so none of these should be flagged as missing.
