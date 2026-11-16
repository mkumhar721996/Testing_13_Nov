summary: |
  Add the Market overview dashboard's data lifecycle: a section-based loader hook (`useDashboardData`) that fetches the four dashboard sections (indices, chart, watchlist, movers) independently with Promise.allSettled, a header Refresh that refetches all of them, and four state views taken from the approved prototype: loading (spinner + skeletons), no-market-data empty state, partial-failure banner with per-card reload, and total-failure error with Try again. The page maps the hook's status to exactly one of ready / loading / no-data / partial / error. The watchlist-empty state ('Add a symbol') is out of scope; the Watchlist epic owns it. The market routes and section displays belong to STORY-021 (3e6f45d, PR #12); this plan reuses them and adds only the lifecycle on top.

scope:
  - description: |
      Step 0, before any code: bring the branch up to date with main. Verified this session (Glob): `apps/web/src` holds only App.tsx, App.test.tsx, main.tsx, index.css, setupTests.ts and `expenses/`; `services/api/src` has no `routes/market.ts` or `stores/market.ts`. The branch predates STORY-021 (3e6f45d) and STORY-012, which the path history says touched App.tsx, app.ts, routes/market.ts and stores/market.ts. The platform or a human must merge or rebase main into the branch (the implementer does not push or merge). Then the implementer reads `git show 3e6f45d`, apps/web/src/App.tsx, services/api/src/routes/market.ts and stores/market.ts, and adjusts every later item to what is really there. Never recreate a file that already exists.
    files: []
    rationale: |
      Every item below is written against the contract this plan expects from STORY-021. Duplicating its routes or page would conflict with main.

  - description: |
      API, only where STORY-021's routes fall short. One independently failing read per section, so one failure never fails the others. For each existing route: (a) 200 with an empty array or series when there is no data (empty is not an error); (b) a non-2xx status when the store throws, without affecting other routes. Add the route or a test for any behaviour that is missing. Expected contract (the web client follows the real paths and payload names if STORY-021 differs):
      ```ts
      GET /market/indices?range=1D|1W|1M|1Y  -> { indices: IndexStat[] }
      GET /market/chart?symbol=&range=       -> { chart: ChartSeries }
      GET /market/watchlist                  -> { watchlist: WatchlistQuote[] }
      GET /market/movers                     -> { movers: Mover[] }
      ```
      If STORY-021 has no watchlist or movers endpoint, adding it is part of this story; raise the estimate and flag it to the reviewer. app.ts already takes injectable stores through `AppOptions` (expenses, categories); follow that for the market store so tests can inject a throwing one.
    files:
      - services/api/src/routes/market.ts
      - services/api/src/routes/market.test.ts
      - services/api/src/stores/market.ts
      - services/api/src/app.ts
    rationale: |
      Partial and total failure must be real per-section outcomes. These files exist only after step 0, so this item is conditional on it.

  - description: |
      Web dashboard API client in the style of apps/web/src/expenses/api.ts (`fetch`, `if (!res.ok) throw new Error(...)`, return the unwrapped body). One function per section: `getIndices(range)`, `getChart(symbol, range)`, `getWatchlist()`, `getMovers()`. If STORY-021 already added a client module, extend it instead of creating a second one.
    files:
      - apps/web/src/dashboard/api.ts
    rationale: |
      One function per section is what makes per-section failure observable.

  - description: |
      Loader hook. Signature and state shape:
      ```ts
      type Section = 'indices' | 'chart' | 'watchlist' | 'movers';
      type SectionState<T> = { status: 'loading' | 'ok' | 'failed'; data?: T };
      export type DashboardStatus = 'loading' | 'ready' | 'no-data' | 'partial' | 'error';
      export function useDashboardData(range: Range, symbol: string): {
        status: DashboardStatus;
        sections: { [K in Section]: SectionState<unknown> };
        failed: Section[];
        refresh: () => void;
        retry: (section: Section) => void;
      }
      ```
      Runs all four requests with Promise.allSettled on mount, on `refresh()`, and when range or symbol change; reports 'loading' while any request is in flight. After settling: all four rejected gives 'error'; some rejected gives 'partial'; none rejected and indices, chart and movers all empty gives 'no-data'; otherwise 'ready'. The watchlist is excluded from the no-data test because the Watchlist epic owns it. A response from an earlier request round is ignored (request counter ref). `retry(section)` refetches one section and recomputes status. If STORY-021 already fetches in the Dashboard or App component, move that code into this hook rather than keeping two loaders.
    files:
      - apps/web/src/dashboard/useDashboardData.ts
      - apps/web/src/dashboard/useDashboardData.test.tsx
    rationale: |
      Keeps every state rule in one testable place; the page component only maps status to markup.

  - description: |
      State components, built from the approved prototype's `data-arc-state` views (lines 1150-1234 of the design file).
      - LoadingState: `<p class="state-title text-muted m-0" role="status">` containing `<span class="spinner" aria-hidden="true">` and "Loading market data…"; then a `.grid` of four `.skeleton` blocks and a `.main-row` of two, heights `calc(var(--control-height-lg) * 3)` and `calc(var(--control-height-lg) * 6)`.
      - NoMarketDataState: `.empty-state` role="status", `<h3>` "No market data yet", the sentence "Quotes are not available right now, for example outside trading hours or before the first update. Refresh to check again.", and a `.btn.btn-primary` "Refresh" with the `i-loader` icon.
      - PartialFailureBanner: `.alert.alert-warning` role="alert" with the alert icon, `<strong>Some dashboard data could not be loaded</strong>`, a sentence naming the failed sections, and a `.btn.btn-secondary` "Try again" calling refresh. Each failed section is a `.card.failed` with an `<h3>`, a "could not be loaded" line and `.btn.btn-secondary` "Reload chart" or "Reload movers" calling `retry(section)`.
      - TotalFailureState: `.alert.alert-danger` role="alert" with "Market data could not be loaded. Check your connection and try again; the last update may be out of date.", then `.empty-state` with `<h3>` "Quotes are unavailable right now", "The range, index stats and chart will return once the data loads.", and a `.btn.btn-primary` "Try again" with the loader icon.
      Tokens used: --space-1, --space-2, --space-3, --space-4, --control-height-lg, --color-fg-muted, --color-warning, --color-warning-bg, --color-danger, --color-danger-bg, --radius-lg, --border-width, --drawer-width. `.alert`, `.alert-warning`, `.alert-danger`, `.empty-state`, `.skeleton`, `.spinner`, `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.grid`, `.stack`, `.visually-hidden`, `.text-muted`, `.m-0` are defined in design-system/prototype-utils.css, already imported by apps/web/src/index.css line 3 (tokens.css on line 2; main.tsx imports index.css), so no stylesheet import item is needed. The prototype's inline-only rules (`.state-title`, `.alert-row`, `.alert-body`, `.failed`, `.main-row` with its 64rem breakpoint) are defined in a new dashboard.css on those tokens, imported by the component the way expenses/AddExpenseForm.tsx imports expense-form.css. If STORY-021 already defines `.main-row` or the header rules, reuse them.
    files:
      - apps/web/src/dashboard/DashboardStates.tsx
      - apps/web/src/dashboard/DashboardStates.test.tsx
      - apps/web/src/dashboard/dashboard.css
    rationale: |
      Builds the approved design with existing classes and tokens and no colour or pixel literals.

  - description: |
      Dashboard page wiring. Keep STORY-021's page header (`<h1>` "Market overview", the Range `.select`) and add a `.btn.btn-primary` "Refresh" with the loader icon in the header-actions cluster at top right (the screen's one primary action, per the UI guidelines). Refresh calls `refresh()` and is disabled while status is 'loading'. A visually-hidden `role="status" aria-live="polite"` region (the prototype's `#live` paragraph) announces "Loading market data" and then "Market data updated". The body renders by status: loading gives LoadingState; no-data gives NoMarketDataState; error gives TotalFailureState and replaces the page body; partial gives the banner, the loaded sections and the failed-section cards; ready gives the sections with no banner. Update App.test.tsx so its mocks cover the dashboard client.
    files:
      - apps/web/src/dashboard/Dashboard.tsx
      - apps/web/src/dashboard/Dashboard.test.tsx
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      Maps the hook's status to the prototype's views. The exact file layout depends on how STORY-021 structured the page (step 0). The `.page-header`, `.header-actions` and `.range-field` rules are prototype-inline; STORY-021 should already define them, if not define them in dashboard.css on the same tokens.

tests:
  - |
    AC1, Refresh refetches all. Dashboard.test.tsx mocks ./api. Write first:
    ```ts
    render(<Dashboard />);
    await screen.findByText('S&P 500');
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(api.getIndices).toHaveBeenCalledTimes(2);
    expect(api.getChart).toHaveBeenCalledTimes(2);
    expect(api.getWatchlist).toHaveBeenCalledTimes(2);
    expect(api.getMovers).toHaveBeenCalledTimes(2);
    ```
    Hook level: renderHook and `act(() => result.current.refresh())`, same four counts.
  - |
    AC2, loading indicator. Every api mock returns a never-resolving promise:
    ```ts
    render(<Dashboard />);
    expect(screen.getByText('Loading market data…')).toBeInTheDocument();
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
    ```
  - |
    AC3, no-market-data empty state. indices, chart and movers resolve empty:
    ```ts
    render(<Dashboard />);
    expect(await screen.findByRole('heading', { name: 'No market data yet' })).toBeInTheDocument();
    expect(screen.queryByText('Some dashboard data could not be loaded')).not.toBeInTheDocument();
    ```
    API side, in routes/market.test.ts: a store returning an empty list for /market/indices gives 200.
  - |
    AC4, Refresh from no-data. First round empty, second round populated:
    ```ts
    await screen.findByRole('heading', { name: 'No market data yet' });
    await user.click(screen.getAllByRole('button', { name: /refresh/i })[0]);
    await waitFor(() => expect(screen.queryByText('No market data yet')).not.toBeInTheDocument());
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    ```
    The page has two buttons named Refresh in this state (header and empty state), hence `getAllByRole(...)[0]` or `within`.
  - |
    AC5, partial-failure banner. getChart rejects, the others resolve with data:
    ```ts
    expect(await screen.findByText('Some dashboard data could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload chart' })).toBeInTheDocument();
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    ```
    Hook level: `expect(result.current.status).toBe('partial'); expect(result.current.failed).toEqual(['chart'])`. Clicking Reload chart calls only getChart again.
  - |
    AC6, no banner on full success:
    ```ts
    await screen.findByText('S&P 500');
    expect(screen.queryByText('Some dashboard data could not be loaded')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    ```
  - |
    AC7, total-failure error. All four reject:
    ```ts
    expect(await screen.findByRole('heading', { name: 'Quotes are unavailable right now' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Market data could not be loaded');
    expect(screen.queryByText('Some dashboard data could not be loaded')).not.toBeInTheDocument();
    ```
    Hook level: `expect(result.current.status).toBe('error')`.
  - |
    AC8, Try again refetches all. From the error state:
    ```ts
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(api.getIndices).toHaveBeenCalledTimes(2);
    expect(api.getChart).toHaveBeenCalledTimes(2);
    expect(api.getWatchlist).toHaveBeenCalledTimes(2);
    expect(api.getMovers).toHaveBeenCalledTimes(2);
    ```
  - |
    AC9, recovery. First round rejects, second resolves:
    ```ts
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    await screen.findByText('S&P 500');
    expect(screen.queryByText('Quotes are unavailable right now')).not.toBeInTheDocument();
    ```
  - |
    Stale-response guard (supports AC1 and AC4). In useDashboardData.test.tsx start a refresh whose first request resolves late, trigger a second refresh, then resolve the first last. The result must reflect the second response only.
  - |
    API per-section isolation, only for routes that lack a test. In routes/market.test.ts with a store whose movers read rejects:
    ```ts
    expect((await app.inject({ method: 'GET', url: '/market/movers' })).statusCode).toBeGreaterThanOrEqual(500);
    expect((await app.inject({ method: 'GET', url: '/market/indices?range=1D' })).statusCode).toBe(200);
    ```
  - |
    Verification command, narrowed from the project test command:
    `(cd services/api && pnpm exec vitest run src/routes/market.test.ts) && (cd apps/web && pnpm exec vitest run src/dashboard src/App.test.tsx)`

assumptions_or_open_questions:
  - |
    Sequencing and contract drift. Verified by Glob this session that STORY-021's files are not present (no market routes or store, no dashboard components; App.tsx is the expense-only app). I could not read STORY-021's route paths, payload names, component names or CSS. The API and web scope items are conditional on step 0 and must be reconciled with what main holds. If STORY-021 has no watchlist or movers endpoint, adding them makes this story larger than estimated.
  - |
    Market data source. What backs the market store in production could not be read here. The plan adds no fixture or invented data to production code. Please confirm STORY-021's store is the source to rely on.
  - |
    Definition of "no market data available" (AC3). Assumed to mean indices, chart and movers all loaded but empty; the watchlist is ignored because watchlist-empty belongs to the Watchlist epic. Please confirm.
  - |
    Definition of "part" and "all" failing (AC5, AC7). Assumed to be across the four sections indices, chart, watchlist and movers: some failed gives partial, all four failed gives error.
  - |
    Prototype versus acceptance criteria. In the prototype, the header Refresh jumps to the error state and the other buttons return to default (data-goto-state); that is a review shortcut. The plan follows the ACs: Refresh refetches and the state comes from the real responses. The prototype's partial banner has a Try again button the ACs do not mention; the plan keeps it (it calls refresh) plus the per-card Reload buttons. Say if either should go.
  - |
    The prototype's "Edit list" button on the watchlist card, the Volume tab and the top-bar navigation belong to other stories and are not planned.
  - |
    design-system/tokens.css lines 76-77 set --duration-fast and --duration-spin to the literal "[object Object]" (confirmed again this session), an invalid value, so spinner and skeleton animations and button transitions do not work as designed. The plan does not edit generated tokens; it needs a design-system fix.
  - |
    Open project-wide question: which browsers and screen sizes the dashboard must support. The code cannot answer it. The plan follows the UI guidelines (mobile-first at 375px, content up to container-max) and the prototype's breakpoints (48rem for navigation, 64rem for the two-column main row). Confirm the browser list before adding any end-to-end coverage.

estimated_points: 5

package_dependencies: []

notes: |
  ### Data & rollout

  None — no schema, stored data, seed or new setting; the work is a client-side loader, UI states and, at most, small additions to read-only API routes.

  Tokens: design-system/tokens.css and prototype-utils.css are loaded by apps/web/src/index.css lines 2-3, which apps/web/src/main.tsx imports. The classes this plan names are defined in prototype-utils.css (`.alert-warning` and `.alert-danger` at lines 132-133, `.select` at line 51; `.empty-state`, `.skeleton`, `.spinner`, `.card`, `.btn-*` in the same file). The prototype's inline-only rules (`.state-title`, `.alert-row`, `.alert-body`, `.failed`, `.main-row`, and the page header rules) are re-created in dashboard.css on the same tokens unless STORY-021 already has them.

  Why a section-based loader and not one overview request: a single request hides which part failed, so a partial banner and per-card retry would need a custom partial payload. Separate section requests with Promise.allSettled give partial failure directly.

  Estimate is 5 on the assumption STORY-021's routes and section displays exist on main. Raise it if step 0 shows the API lacks a watchlist or movers read.

  ```mermaid
  flowchart TD
    App[App.tsx] --> Dashboard[Dashboard.tsx]
    Dashboard --> Hook[useDashboardData.ts]
    Dashboard --> States[DashboardStates.tsx]
    Hook --> WebApi[dashboard/api.ts]
    WebApi -->|GET /market| Routes[routes/market.ts]
    AppTs[app.ts buildApp] --> Routes
    Routes --> Store[stores/market.ts]
    classDef touched fill:#f96,color:#000
    class App,Dashboard,Hook,States,WebApi,Routes,Store,AppTs touched
  ```
  App.tsx and app.ts exist in this worktree but without the market parts. routes/market.ts, stores/market.ts and the dashboard components arrive with STORY-021 (3e6f45d), so those nodes and edges are expected, not verified; confirm after step 0.

review_focus: |
  Hold the plan to refresh, loading, no-data, partial and total-failure behaviour; the watchlist-empty state, navigation, the Volume tab and the production data source are OUT. The riskiest area is the status rules in useDashboardData (all rejected versus some rejected versus empty, and stale responses), plus drift from STORY-021, which is not in this worktree: reviewers should check the code reuses its routes and components rather than duplicating them. The Refresh button deliberately does not follow the prototype's click-through to the error state; that was a review shortcut.
