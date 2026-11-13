summary: |
  Add the "Record an expense" flow end to end. The Web API (Fastify, PostgreSQL) gets an `expenses` table, a validated `POST /expenses` that saves against the signed-in user's own id, and a `GET /categories` that returns only that user's categories. The Web App (React + Vite) gets the approved Add expense screen: amount, date, category (the user's own), optional description, no currency field, inline field errors, a success message with the form cleared, and a "create a category first" state with Save disabled. Validation is enforced on both sides (amount > 0, date not after today, description optional, category must belong to the user), so no expense is saved on invalid input even if the client is bypassed. Browsing, editing and deleting stay out of scope.
scope:
  - description: |
      Migration for the expenses table. Columns: id uuid primary key, user_id (owner), category_id, amount numeric(12,2) with CHECK (amount > 0), spent_on date, description text null, created_at timestamptz default now(). Index on (user_id, spent_on). Plus a tiny migration runner script (no migration tooling exists yet; `src/db.ts` only builds a pg pool).
    files:
      - services/api/migrations/001_create_expenses.sql
      - services/api/src/migrate.ts
    rationale: |
      The data must persist in PostgreSQL (ADR-0003). A DB-level amount check is a second line of defence behind API validation.
  - description: |
      Auth seam. `buildApp(opts?: { resolveUserId?: (req: FastifyRequest) => Promise<string | undefined>; expenses?: ExpenseStore; categories?: CategoryStore })`. A `requireUser` preHandler sets `req.userId` or replies 401 `{ error: 'unauthorised' }`. The default resolver is whatever the App shell and accounts story provides; until it lands it resolves nothing (401), and tests inject a fake.
    files:
      - services/api/src/auth.ts
      - services/api/src/app.ts
    rationale: |
      Expenses must be recorded against the caller's own account (AC 8) and the user id must come from the session, never from the request body. No accounts code exists in the repo today (searched, see notes), so this story only adds the seam.
  - description: |
      Stores (PostgreSQL via `getPool()`): `ExpenseStore.create(userId, input): Promise<Expense>` and `CategoryStore.listForUser(userId): Promise<Category[]>`, `CategoryStore.existsForUser(userId, categoryId): Promise<boolean>`. Queries always filter on user_id.
    files:
      - services/api/src/stores/expenses.ts
      - services/api/src/stores/categories.ts
    rationale: |
      Keeps SQL out of the routes so route tests run with in-memory fakes and only the store tests need a database. Reads the categories table owned by the Categories story.
  - description: |
      Validation and routes. `validateExpenseInput(body, today: string)` returns `{ ok: true, value } | { ok: false, errors: { amount?: string; date?: string; category?: string } }`. Messages: amount "Amount must be greater than zero.", date "Date cannot be in the future.", empty amount/date/category "Enter an amount." / "Enter a date." / "Choose a category.". Amount accepts at most 2 decimals. Description is trimmed and optional (empty becomes null). Any `currency` key in the body is ignored. Routes: `POST /expenses` replies 201 with the saved expense, 400 `{ errors }`, or 400 with `errors.category` when the category is not the user's. `GET /categories` replies 200 `{ categories: [{ id, name }] }`.
    files:
      - services/api/src/validation/expense.ts
      - services/api/src/routes/expenses.ts
      - services/api/src/routes/categories.ts
    rationale: |
      Server-side rules are the authority for AC 3-6 and 12; the client mirrors them for fast feedback only.
  - description: |
      Load the design system once in the web app: add `@import "../../../design-system/tokens.css";` and `@import "../../../design-system/prototype-utils.css";` to `apps/web/src/index.css` after `@import "tailwindcss";`. Currently the file holds only the Tailwind import (apps/web/src/index.css line 1), loaded from `main.tsx` line 3, so no token or component class exists in the app yet. Add `apps/web/src/expense-form.css` for the approved screen's own rules: `.form-wrap` (max-width 520px, padding-block var(--space-4) var(--space-6)) and `.form-actions` (flex, justify-content flex-end, wrap, gap var(--space-2)), on tokens only.
    files:
      - apps/web/src/index.css
      - apps/web/src/expense-form.css
    rationale: |
      The classes the prototype uses (`.container`, `.stack`, `.field`, `.input`, `.select`, `.textarea`, `.field-hint`, `.field-error`, `.is-invalid`, `.btn`, `.btn-primary`, `.btn-secondary`, `.alert`, `.alert-danger`, `.alert-success`, `.alert-warning`) are all defined in design-system/prototype-utils.css; `.form-wrap` and `.form-actions` exist only in the prototype's inline style, so they are redefined on the same tokens. The token file is copied as is; the Tailwind utilities already in App.tsx are untouched.
  - description: |
      Web client logic. `validateExpenseForm(values, today)` mirrors the API messages. `getCategories()` calls GET /categories and `createExpense(payload)` calls POST /expenses (payload has amount, date, categoryId, description and no currency). `todayLocal()` returns YYYY-MM-DD from the browser's local date.
    files:
      - apps/web/src/expenses/validation.ts
      - apps/web/src/expenses/api.ts
    rationale: |
      Pure functions are cheap to test first and keep the component thin.
  - description: |
      `AddExpenseForm` component following the approved Add expense screen. Page title h1 "Add expense" (token `--color-primary`, `--font-size-xl`), lead "Enter the amount, date and category. The description is optional.", then in one `.stack` inside `.container.form-wrap`: Amount (`.input`, `inputmode="decimal"`, placeholder 0.00, no currency symbol or field), Date (`type="date"`, default today, `max` today, hint "Today or an earlier day."), Category (`.select`, first option "Choose a category", then the user's categories from the API), Description (optional) (`.textarea`, 3 rows). Actions in `.form-actions`: `.btn.btn-secondary` Cancel and `.btn.btn-primary` "Save expense". States from the prototype. Error state: `.alert.alert-danger role="alert"` "Nothing was saved. Fix the fields below and save again." plus `.field-error` text under each invalid control with `.is-invalid` and `aria-invalid="true"` and `aria-describedby`. Success state: `.alert.alert-success role="status"` "Expense saved. The form is clear for your next one." and all fields reset (date back to today). No-categories state: `.alert.alert-warning role="alert"` "You have no categories yet. Create a category first, then record your expense.", the select disabled with hint "Expenses need a category. Add one to continue.", Save disabled, and a secondary "Create a category" button. Loading categories shows `.skeleton` blocks; a failed categories or save request shows `.alert.alert-danger` "We could not save your expense. Try again." Mounted by `App.tsx` as the Dashboard content.
    files:
      - apps/web/src/expenses/AddExpenseForm.tsx
      - apps/web/src/App.tsx
    rationale: |
      Builds the approved screen's four states (default, error, success, no-categories). Tokens used via the prototype classes: `--space-1..6`, `--color-danger`, `--color-success`, `--color-warning` and their `-bg` pairs, `--color-fg-muted`, `--color-border-strong`, `--control-height-md`, `--radius-md`, `--focus-ring-width`.
tests:
  - |
    AC 1 and 8. API test `services/api/test/unit/expenses.test.ts`, written first, with a fake store and `resolveUserId: async () => 'user-1'`:
    ```ts
    const res = await app.inject({ method: 'POST', url: '/expenses', payload: { amount: '18.50', date: '2026-11-13', categoryId: 'cat-food', description: 'Lunch' } });
    expect(res.statusCode).toBe(201);
    expect(store.created[0]).toMatchObject({ userId: 'user-1', amount: '18.50', date: '2026-11-13', categoryId: 'cat-food', description: 'Lunch' });
    ```
    A second case posts `userId: 'someone-else'` in the body and asserts the stored `userId` is still `'user-1'`. An unauthenticated request asserts 401 and nothing stored.
  - |
    AC 2. Same file, description omitted and `description: ''` both give 201 and `store.created[0].description` toBeNull().
  - |
    AC 3. `validateExpenseInput` unit test table, plus a route test that each of amount, date and category missing gives 400 and `expect(store.created).toHaveLength(0)`:
    ```ts
    it.each(['amount', 'date', 'categoryId'])('rejects a missing %s', async (key) => {
      const res = await post({ ...valid, [key]: '' });
      expect(res.statusCode).toBe(400);
      expect(store.created).toHaveLength(0);
    });
    ```
  - |
    AC 4. API: `amount: '0'` gives `res.json().errors.amount === 'Amount must be greater than zero.'` and nothing is stored. Web: typing 0 and clicking Save shows `screen.getByText('Amount must be greater than zero.')` next to the Amount field and `expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true')`.
  - |
    AC 5. API with `today = '2026-11-13'` injected: date '2026-11-14' gives `errors.date === 'Date cannot be in the future.'`. Web: same message under the Date field.
  - |
    AC 6. API: date '2026-11-13' with `today = '2026-11-13'` gives 201. Web: submitting with the default date (today) calls `createExpense` once.
  - |
    AC 7. API: `GET /categories` for a user whose store holds Food and Travel (plus another user's Work) returns `[{ name: 'Food' }, { name: 'Travel' }]` only. Web: with the mocked client returning those two, `screen.getAllByRole('option').map(o => o.textContent)` equals `['Choose a category', 'Food', 'Travel']`.
  - |
    AC 8 (data layer). `services/api/test/e2e/expenses.spec.ts` against a real PostgreSQL: create as user A, assert the row's user_id is A's, and that a category id belonging to user B is rejected with 400 and no row inserted.
  - |
    AC 9. Web: `expect(screen.queryByLabelText(/currency/i)).not.toBeInTheDocument()` and the form contains no text matching /currency|\$|€|£/. API: a body with `currency: 'USD'` saves without a currency column or value.
  - |
    AC 10. Web: after a successful save `expect(await screen.findByRole('status')).toHaveTextContent('Expense saved.')`.
  - |
    AC 11. Web: after a successful save `expect(screen.getByLabelText('Amount')).toHaveValue('')`, `expect(screen.getByLabelText('Category')).toHaveValue('')`, `expect(screen.getByLabelText(/Description/)).toHaveValue('')` and the Date is today again.
  - |
    AC 12. API: user with no categories posting a valid amount and date gives 400 and nothing stored. Web: with an empty category list `expect(screen.getByRole('button', { name: 'Save expense' })).toBeDisabled()` and `createExpense` is never called.
  - |
    AC 13. Web: with an empty category list `expect(screen.getByRole('alert')).toHaveTextContent('Create a category first')` and a "Create a category" button is present. API: the 400 for that case carries `errors.category` "Create a category first." so a bypassing client sees the same direction.
  - |
    Store test (real PostgreSQL, Playwright e2e project) that `001_create_expenses.sql` applies on an empty database and that the CHECK rejects amount 0. No existing rows are changed, so no pre-existing data test is needed.
assumptions_or_open_questions:
  - |
    BLOCKER to confirm. The repo has no accounts, session or categories code or tables (searched the whole worktree outside node_modules for session, user_id, categor, CREATE TABLE and found only design-system and ADR files). The epic says expenses depend on Categories and App shell and accounts. This plan assumes those stories merge first and provide a `users` table, a `categories(id, user_id, name)` table and a way to resolve the signed-in user. If they have not, the expenses migration cannot add foreign keys, and `resolveUserId` stays a stub that returns 401. Please confirm the order, or the real table and column names.
  - |
    Open question from deferred list: how passwords and sessions are secured, and which environments the app runs in. ADR-0007 says login is via Google and GitHub social login, so this story does not handle passwords. Session mechanism is left to the accounts story; this story only needs `resolveUserId`.
  - |
    Open question from deferred list: backup and recovery for the PostgreSQL expense data. Not answerable from the code or ADRs and not part of this story; no backup work is planned here.
  - |
    Settled decision followed: amount greater than zero, date not in the future, description optional.
  - |
    Assumed: amount is stored as numeric(12,2) with at most two decimal places and an upper bound of 9999999999.99. The story only states greater than zero. Please confirm.
  - |
    Assumed: "today" is computed in the browser's local date for the form and in UTC on the server, which can disagree by a day near midnight for users far from UTC. The server accepts a date up to UTC today plus one day to avoid rejecting a valid local today. Please confirm or give a user timezone setting.
  - |
    The prototype's Cancel and "Create a category" buttons only show a toast, because their target screens belong to other stories. Plan: Cancel resets the form with no navigation, "Create a category" links to the Categories screen route once it exists and is a no-op placeholder button until then. Navigation, the top bar and the footer come from the App shell story and are not built here.
  - |
    design-system/tokens.css lines 76-77 contain `--duration-fast: [object Object]` and `--duration-spin: [object Object]`, which are invalid values, so transitions and the skeleton animation are silently dropped. No token covers these durations; I did not plan a literal. Needs a fix in the design system export.
  - |
    The UI guidelines say one primary action per screen at the top right of the page header, but the approved prototype puts the single primary "Save expense" at the bottom right of the form. I follow the prototype (one primary action on the screen, aligned right) and flag the difference.
  - |
    The project's stack lists Tailwind for styling, but the approved design is built on design-system class names. I use the design-system classes for this screen and add no Tailwind utilities to it.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: new table only (`expenses`), no existing rows are altered. Foreign keys to users and categories depend on the open question above; if those tables exist at deploy time the migration adds them, otherwise they are added by a follow-up migration.
  - **Backfill / seed**: none. The migration uses `CREATE TABLE IF NOT EXISTS` so re-running is safe.
  - **Settings**: reuses `DATABASE_URL` (already read in services/api/src/db.ts). No new env var.
  - **Provisioning**: a PostgreSQL database reachable from the API; the users and categories tables from the dependency stories.
  - **Order and rollback**: run `001_create_expenses.sql` (via `pnpm tsx src/migrate.ts`) before deploying the API that reads it. Rollback is `DROP TABLE expenses`, safe because nothing else reads it yet.

  ### Findings from the code

  - services/api currently has only `buildApp()` in src/app.ts registering `healthRoutes`, a lazy pg pool in src/db.ts, and vitest unit tests under test/unit using `app.inject`. The new routes follow the same plugin shape as src/routes/health.ts.
  - apps/web is a bare Vite app: App.tsx renders a single heading, App.test.tsx asserts it ("Web App"), and the vitest setup is jsdom with globals and `@testing-library/react`. If App.tsx changes, update that test in the same step.
  - The design-system tokens are not loaded by the app yet (index.css holds only the Tailwind import), hence the import scope item.

  ```mermaid
  flowchart TD
    main[main.tsx] --> App[App.tsx]
    App --> Form[expenses/AddExpenseForm.tsx]
    Form --> WebVal[expenses/validation.ts]
    Form --> WebApi[expenses/api.ts]
    main --> Css[index.css]
    Css --> Tokens[design-system/tokens.css]
    Css --> Utils[design-system/prototype-utils.css]
    WebApi -->|HTTP| AppTs[api app.ts]
    AppTs --> Health[routes/health.ts]
    AppTs --> Auth[auth.ts]
    AppTs --> ExpRoute[routes/expenses.ts]
    AppTs --> CatRoute[routes/categories.ts]
    ExpRoute --> ApiVal[validation/expense.ts]
    ExpRoute --> ExpStore[stores/expenses.ts]
    CatRoute --> CatStore[stores/categories.ts]
    ExpStore --> Db[db.ts]
    CatStore --> Db
    Db --> PG[(PostgreSQL)]
    classDef touched fill:#f96,color:#000
    class App,Form,WebVal,WebApi,Css,AppTs,Auth,ExpRoute,CatRoute,ApiVal,ExpStore,CatStore touched
  ```

  Touched nodes are new or edited: `app.ts` registers the new routes, `auth.ts` supplies the signed-in user, the stores keep SQL out of the routes, and `index.css` is where the design tokens are loaded once.

  Untrusted-input note: the work item and deferred questions contained no instructions outside the change itself; nothing was dropped.
review_focus: |
  IN scope: add-expense form, POST /expenses, GET /categories, the expenses table, and the auth seam. OUT: list, edit, delete, categories CRUD, accounts and the app shell. Riskiest points are the dependency on missing users and categories tables (the user id must come from the session, and the category must belong to that user) and the today/timezone comparison for the future-date rule. Deliberate choices: validation is duplicated on server and client, `resolveUserId` is a stub until accounts land, and the primary button sits at the form bottom as in the approved prototype, not in the page header.
