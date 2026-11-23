summary: |
  Add the approved "Top movers today" card to the Market overview: two read-only tables, Top gainers and Top losers (top 3 each, as in the prototype). Since STORY-021 merged, the repo already has `instruments` (kind `equity` or `index`) and `price_points` tables, a `MarketStore`, `GET /market/overview` and a `MarketOverview` screen, so movers are DERIVED from existing data and no new table is needed. A new `GET /market/movers` endpoint in the Web API (comp_web_api) reads each equity's first and last price over the same rolling 1D window the overview uses, ranks the changes, and returns the top 3 gainers and top 3 losers. The Web App (comp_web_app) gets a `MarketMovers` component, mounted in `MarketOverview` below the chart row, with the prototype's default, loading, movers-empty and error views. Rows are bare `<tr>` elements with no link, button, tabindex, role, handler, hover fill or pointer cursor, so a click changes nothing (ACs 3 and 4). TDD: API unit tests and web component tests come first.
scope:
  - description: |
      Store for the quotes movers are computed from, mirroring `stores/market.ts` (interface plus pg implementation) so tests can inject a fake. It returns one row per equity that has at least one price point in the window.
      ```ts
      export type Quote = { symbol: string; name: string; open: number; last: number };
      export interface MoverStore {
        /** First and last price inside [from, to] for every equity with a point there. */
        quotes(from: Date, to: Date): Promise<Quote[]>;
      }
      ```
      `pgMoverStore.quotes` runs one query:
      ```sql
      SELECT i.symbol, i.name, f.price AS open, l.price AS last
      FROM instruments i
      JOIN LATERAL (SELECT price FROM price_points WHERE symbol = i.symbol AND at BETWEEN $1 AND $2 ORDER BY at ASC LIMIT 1) f ON true
      JOIN LATERAL (SELECT price FROM price_points WHERE symbol = i.symbol AND at BETWEEN $1 AND $2 ORDER BY at DESC LIMIT 1) l ON true
      WHERE i.kind = 'equity'
      ```
      `numeric` columns come back as strings, so map them with `Number(...)` as `pgMarketStore` does. Index instruments (`^GSPC` and so on) are excluded by `kind = 'equity'`.
    files:
      - services/api/src/stores/movers.ts
    rationale: |
      Keeps SQL out of the route. Uses the existing `instruments` and `price_points` tables from `migrations/002_create_market_data.sql`; no schema change.
  - description: |
      Route plugin `moverRoutes` registering `GET /market/movers`, behind `requireUser` like `marketRoutes`. It takes the window from `rangeStart('1D', now)` (the same rolling day as the overview's 1D range), computes `changePct = (last - open) / open * 100` per quote (skip `open === 0`), drops zero changes, and ranks:
      ```ts
      export type Mover = { symbol: string; name: string; price: number; changePct: number };
      export const MOVERS_LIMIT = 3;

      export const moverRoutes =
        (deps: { movers: MoverStore; now: () => Date }, requireUser: preHandlerAsyncHookHandler): FastifyPluginAsync =>
        async (app) => {
          app.get('/market/movers', { preHandler: requireUser }, async () => {
            const to = deps.now();
            const quotes = await deps.movers.quotes(rangeStart('1D', to), to);
            const movers = quotes
              .filter((q) => q.open !== 0)
              .map((q) => ({ symbol: q.symbol, name: q.name, price: q.last, changePct: ((q.last - q.open) / q.open) * 100 }));
            const bySymbol = (a: Mover, b: Mover) => a.symbol.localeCompare(b.symbol);
            return {
              gainers: movers.filter((m) => m.changePct > 0).sort((a, b) => b.changePct - a.changePct || bySymbol(a, b)).slice(0, MOVERS_LIMIT),
              losers: movers.filter((m) => m.changePct < 0).sort((a, b) => a.changePct - b.changePct || bySymbol(a, b)).slice(0, MOVERS_LIMIT),
            };
          });
        };
      ```
      In `buildApp` (`services/api/src/app.ts`) extend `AppOptions` with `movers?: MoverStore`, import `moverRoutes` and `pgMoverStore`, and register next to `marketRoutes`:
      ```ts
      app.register(moverRoutes({ movers: opts.movers ?? pgMoverStore, now }, auth));
      ```
      reusing the existing `opts.now ?? (() => new Date())` (hoist it into a `const now` so both plugins share it).
    files:
      - services/api/src/routes/movers.ts
      - services/api/src/app.ts
    rationale: |
      Ranking in the route (not SQL) keeps the AC 1 and 2 behaviour unit-testable with a fake store, the way `market.test.ts` tests overview stats. A zero change is neither a gainer nor a loser.
  - description: |
      Web API client in the existing market module, same shape as `getWatchlist`:
      ```ts
      export type Mover = { symbol: string; name: string; price: number; changePct: number }
      export type MoversResponse = { gainers: Mover[]; losers: Mover[] }

      export async function getMovers(): Promise<MoversResponse> {
        const res = await fetch('/market/movers')
        if (!res.ok) throw new Error('Could not load movers')
        return res.json()
      }
      ```
    files:
      - apps/web/src/market/api.ts
    rationale: |
      Replaces the prototype's inline sample rows (SMCI, PLTR, INTC and so on) with real data; none of that sample data goes into production code.
  - description: |
      `MarketMovers` component (default export, no props), in `apps/web/src/market/`, building the prototype's `data-wf-id="movers"` section. It keeps `{ phase: 'loading' | 'ready' | 'error', data }` state, calls `getMovers()` on mount, and has a `load()` used by both the empty-state "Refresh" and the error "Try again".
      Default view (ready, at least one list non-empty):
      - `<section class="card stack" aria-labelledby="mv-title">` with `<h3 id="mv-title">Top movers today</h3>` and `<p class="text-muted text-sm m-0">Largest moves in today's session. For reference only.</p>` in a wrapping `<div>`.
      - `<div class="movers-grid">` with two `.movers-list` blocks, each an `<h4>` (`id="gain-title"` Top gainers, `id="lose-title"` Top losers) over `<div class="table-wrap"><table class="table" aria-labelledby=...>`.
      - Header row: Symbol, Name (`scope="col"`), then Last price, Change (`class="num"`).
      - Body rows: `<tr><th scope="row"><strong>SMCI</strong></th><td class="name">…</td><td class="num">41.20</td><td class="num"><span class="badge badge-success">▲ +6.8%</span></td></tr>`. Price via `formatLevel(price, 2)` from `./format`. The change text is built with `formatSignedPct(changePct, 1)` from `./format` plus the arrow (▲ with `badge-success` for gainers, ▼ with `badge-danger` for losers), so the arrow and sign carry the meaning, not only colour.
      - Rows are bare `<tr>`: no `onClick`, `<a>`, `<button>`, `tabIndex` or `role` (ACs 3 and 4).
      Other views, from the prototype's states:
      - Loading: `<p class="text-muted m-0" role="status">Loading market data…</p>` and a `.movers-grid` of two `.skeleton` blocks with `height: calc(var(--control-height-lg) * 4)` (set through a `.skeleton-movers` class in `movers.css`, not an inline px value).
      - Movers-empty (both lists empty): the card with the `h3` and `<div class="empty-state"><h4 class="m-0">No movers yet today</h4><p class="m-0">Gainers and losers appear once the market has traded for a while. Refresh to check again.</p><button type="button" class="btn btn-secondary">Refresh</button></div>`. That button is the prototype's own empty-state control and sits where there are no mover entries.
      - Error: inside the card, `<div class="alert alert-danger" role="alert">Top movers could not be loaded. Check your connection and try again.</div>` and a `.btn .btn-secondary` "Try again" that calls `load()`. The prototype's error state is a page-level banner owned by the overview; the card-level alert is the movers-only equivalent (see open questions).
      - One list empty and the other not: that list's table is replaced by `<p class="text-muted m-0">No gainers yet today</p>` (or `No losers yet today`).
    files:
      - apps/web/src/market/MarketMovers.tsx
    rationale: |
      Self-contained, so `useDashboardData` and its tests stay untouched. `MarketOverview` only renders it in the `ready` and `partial` statuses, so the header Refresh and range changes (which pass through `loading`) unmount and remount it and therefore refetch it.
  - description: |
      Styles for the pieces the prototype defines only in its own inline `<style>` (lines 944-950 of the prototype) or not at all, on tokens only. `.card`, `.stack`, `.table`, `.badge-success`, `.badge-danger`, `.alert-danger`, `.empty-state`, `.skeleton`, `.btn-secondary`, `.text-muted`, `.text-sm` and `.m-0` already come from `design-system/prototype-utils.css`, which `apps/web/src/index.css` imports on line 3 after `tokens.css` on line 2, so nothing to import for those. `.table-wrap` and `.num` are NOT defined in `prototype-utils.css` (checked), so they are defined here.
      ```css
      .movers-grid { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 48rem) { .movers-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .movers-list { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
      .movers-list h4 { margin: 0; font-size: var(--font-size-lg); color: var(--color-fg); }
      .movers-list .table td, .movers-list .table th { cursor: default; }
      .movers-list .table .name { overflow-wrap: anywhere; }
      .table-wrap { overflow-x: auto; }
      .num { text-align: right !important; font-variant-numeric: tabular-nums; }
      .skeleton-movers { height: calc(var(--control-height-lg) * 4); border-radius: var(--radius-lg); }
      ```
      No `:hover` rule on rows and no pointer cursor. Tokens used: `--space-2`, `--space-4`, `--font-size-lg`, `--color-fg`, `--control-height-lg`, `--radius-lg`. The 48rem breakpoint is copied from the prototype, which has no token for it (`dashboard-states.css` uses 64rem the same way). `MarketMovers.tsx` imports `./movers.css`, as `MarketOverview.tsx` imports `./market.css`.
    files:
      - apps/web/src/market/movers.css
    rationale: |
      Same pattern as `market.css` and `dashboard-states.css`. Tokens load through `apps/web/src/index.css` lines 2-3 (with Tailwind on line 1).
  - description: |
      Mount the card in `MarketOverview.tsx`, below the chart row (as in the prototype), for the `ready` and `partial` statuses only. Today `sections` is `data && (...)`, so render movers outside it:
      ```tsx
      {status === 'ready' && (<>{sections}<MarketMovers /></>)}
      {status === 'partial' && (
        <>
          <PartialFailureBanner failed={failed} onRetryAll={refresh} />
          {sections}
          <MarketMovers />
          {failed.map(...)}
        </>
      )}
      ```
      It is not shown in `loading`, `no-data` or total `error`. Extend the `LoadingState` in `DashboardStates.tsx` with the prototype's loading movers space: `<div className="movers-grid"><div className="skeleton skeleton-movers" /><div className="skeleton skeleton-movers" /></div>` after the main row (the `.movers-grid` and `.skeleton-movers` rules live in `movers.css`, so `DashboardStates.tsx` also imports `./movers.css`). Update the `TotalFailureState` body line to "The range, index stats, chart and movers will return once the data loads." to match the prototype (line 1175); check that no existing test pins the old string (a grep of the market tests found none).
      Update mocks that would otherwise call a missing export: `vi.mock('./api', () => ({ getOverview: vi.fn(), getWatchlist: vi.fn(), getMovers: vi.fn() }))` in `MarketOverview.test.tsx` with `vi.mocked(getMovers).mockResolvedValue({ gainers: [], losers: [] })` in its `beforeEach`; add `getMovers: vi.fn().mockReturnValue(new Promise(() => {}))` to the `./market/api` mock in `App.test.tsx`.
    files:
      - apps/web/src/market/MarketOverview.tsx
      - apps/web/src/market/DashboardStates.tsx
      - apps/web/src/market/MarketOverview.test.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      `App.tsx` already renders `<MarketOverview />` (from STORY-021), so it needs no change. Without the mock updates the existing tests would hit a real `fetch` or a missing mock export.
tests:
  - |
    AC 1 and 2, API, written first and failing: `services/api/test/unit/movers.test.ts` (new, vitest, same style as `market.test.ts`, with `FakeMovers implements MoverStore` and `buildApp({ resolveUserId: async () => 'user-1', movers, now: () => now })`, `now = new Date('2026-11-13T12:00:00Z')`). Seed 5 rising equities, 5 falling ones, one flat (open equals last) and one with `open: 0`.
    ```ts
    const res = await app.inject({ method: 'GET', url: '/market/movers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.gainers.map((m: { symbol: string }) => m.symbol)).toEqual(['A', 'B', 'C']); // biggest rise first
    expect(body.losers.map((m: { symbol: string }) => m.symbol)).toEqual(['X', 'Y', 'Z']);  // biggest fall first
    expect(body.gainers[0]).toEqual({ symbol: 'A', name: 'Alpha', price: 110, changePct: 10 });
    ```
    Also: the flat symbol and the `open: 0` symbol appear in neither list; each list is capped at 3; and the store is asked for the overview's 1D window, `expect(movers.calls).toEqual([{ from: new Date('2026-11-12T12:00:00Z'), to: now }])`. With nothing seeded, `expect(res.json()).toEqual({ gainers: [], losers: [] })`.
  - |
    Permissions, API (same file): `expect((await buildApp({ resolveUserId: async () => undefined, movers }).inject({ method: 'GET', url: '/market/movers' })).statusCode).toBe(401)`.
  - |
    AC 1 and 2, web: `apps/web/src/market/MarketMovers.test.tsx` (new, vitest and Testing Library, `vi.mock('./api', () => ({ getMovers: vi.fn() }))` as `MarketOverview.test.tsx` does). With `getMovers` resolving 3 gainers (SMCI +6.8, PLTR +4.1, AMD +2.5) and 3 losers (INTC −4.2, WBA −3.6, PFE −2.2):
    ```tsx
    render(<MarketMovers />)
    const gainers = await screen.findByRole('table', { name: 'Top gainers' })
    const losers = screen.getByRole('table', { name: 'Top losers' })
    expect(within(gainers).getAllByRole('row')).toHaveLength(4) // header + 3
    expect(within(gainers).getByRole('rowheader', { name: 'SMCI' })).toBeInTheDocument()
    expect(within(gainers).getByText('▲ +6.8%')).toBeInTheDocument()
    expect(within(losers).getByText('▼ −4.2%')).toBeInTheDocument()
    ```
  - |
    AC 3, web (same file): clicking an entry changes nothing. `@testing-library/user-event` is NOT installed (`apps/web/package.json` has only `@testing-library/react` and `jest-dom`), so use `fireEvent`, which needs no new dependency.
    ```tsx
    const { container } = render(<MarketMovers />)
    const row = (await screen.findByRole('rowheader', { name: 'SMCI' })).closest('tr')!
    const before = container.innerHTML
    const hash = window.location.hash
    fireEvent.click(row)
    expect(container.innerHTML).toBe(before)
    expect(window.location.hash).toBe(hash)
    expect(getMovers).toHaveBeenCalledTimes(1)
    ```
  - |
    AC 4, web (same file): entries are not links or buttons and take no focus. Rendered with data present, so the empty-state "Refresh" and error "Try again" buttons are not in the DOM.
    ```tsx
    const section = (await screen.findByRole('heading', { name: 'Top movers today' })).closest('section')!
    expect(within(section).queryByRole('link')).toBeNull()
    expect(within(section).queryByRole('button')).toBeNull()
    section.querySelectorAll('tbody tr').forEach((tr) => {
      expect(tr.querySelector('a, button, [tabindex], [role]')).toBeNull()
      expect(tr).not.toHaveAttribute('onclick')
      expect(tr).not.toHaveAttribute('role')
      expect(tr).not.toHaveAttribute('tabindex')
    })
    ```
  - |
    States from the prototype, web (same file). Loading: with a pending `getMovers`, `expect(screen.getByRole('status')).toHaveTextContent('Loading market data…')`. Movers-empty: with `{ gainers: [], losers: [] }`, `expect(await screen.findByText('No movers yet today')).toBeInTheDocument()`, and clicking "Refresh" calls `getMovers` a second time. Error: with a rejected promise, `expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')`; after `fireEvent.click(screen.getByRole('button', { name: 'Try again' }))` `getMovers` has been called twice and `await screen.findByRole('table', { name: 'Top gainers' })` passes. One side empty: `expect(await screen.findByText('No losers yet today')).toBeInTheDocument()`.
  - |
    Integration into the overview, web: add to `MarketOverview.test.tsx`: with `getMovers` resolved, `expect(await screen.findByRole('heading', { name: 'Top movers today' })).toBeInTheDocument()`; with `getOverview` returning the empty overview (no-data status) and with both `getWatchlist` and `getOverview` rejected, `expect(screen.queryByRole('heading', { name: 'Top movers today' })).not.toBeInTheDocument()`. Existing tests in that file and `App.test.tsx` still pass with the updated mocks.
  - |
    Store: the repo has no database test harness for market data (only fake stores in `test/unit`, and `test/integration/expenses-list.test.ts` for expenses), so the SQL (first and last price per equity, index instruments excluded) is covered through the fake plus code review of the query. If the implementer can run the integration setup used by `expenses-list.test.ts`, add one test that inserts two equities and one index with price points and asserts `pgMoverStore.quotes` returns only the equities with the right `open` and `last`.
  - |
    Verification, narrow forms of the project's test command: `(cd services/api && pnpm run test -- test/unit/movers.test.ts test/unit/market.test.ts) && (cd apps/web && pnpm test -- src/market/MarketMovers.test.tsx src/market/MarketOverview.test.tsx src/App.test.tsx)`, then `pnpm run typecheck` in `services/api` and `apps/web`.
assumptions_or_open_questions:
  - |
    Volume column dropped from the approved design. The prototype's tables show Symbol, Name, Last price, Change and Volume, but nothing in the repo stores volume (`price_points` has only symbol, at, price; `instruments` has symbol, name, kind). Inventing a volume column or feed is out of scope for this story, so this plan builds four columns. Reviewer decision: accept four columns, or add a nullable volume source (a migration plus an ingestion path, a larger piece of work that should be its own story).
  - |
    Where do equity quotes come from? `migrations/002_create_market_data.sql` seeds only the four index instruments, and I found no code that inserts equity rows or price points (searched for `price_points` and `INSERT INTO` across the repo, excluding `node_modules`). So until something populates equities, `/market/movers` returns empty lists and the card shows "No movers yet today". This plan does not invent a seed or feed; who fills them (provider integration, scheduled job, another story) needs a reviewer decision.
  - |
    Movers use the same rolling 24 hour window as the overview's 1D range (`rangeStart('1D', now)`), so the card agrees with the stats above it and does not go empty just after UTC midnight. Change is last price against the first price in the window. "Today's" session boundaries in a market timezone are not specified.
  - |
    Prototype conflict, minor: the prototype's movers-empty state has a "Refresh" button, but AC 3 and 4 say entries are not buttons. The button is in the empty state, where there are no entries, so I treat them as compatible. The same applies to the error "Try again" button.
  - |
    Error and loading placement. The prototype shows the error as a page-level banner owned by the overview (STORY-021, already built as `TotalFailureState` and `PartialFailureBanner`). Here the movers card owns its own loading skeleton and its own `alert-danger` with "Try again", so a failed `/market/movers` does not turn the whole dashboard into an error. Movers are not part of `useDashboardData`'s partial or total failure logic. Reviewer decision if movers failure should instead feed the page banner.
  - |
    Because the card is only mounted in the `ready` and `partial` statuses, a range change or the header Refresh refetches movers too (they remount), and movers load after the overview rather than in parallel. Accepted for simplicity; folding movers into `useDashboardData` would avoid the waterfall at the cost of changing its status logic and tests.
  - |
    `GET /market/movers` uses `requireUser` like `/market/overview`. `noUser` is the default resolver until the accounts story lands, so the endpoint returns 401 in the real app until then, as the other market routes do. If market data should be public, drop the preHandler.
  - |
    Browser and screen-size support (project-wide open question from the epic): the plan follows the UI guidelines' mobile-first 375px layout and the prototype's single column below 48rem and two columns from 48rem. No other browser or size target is assumed.
  - |
    Prices are shown without a currency symbol, as in the prototype. Percent change is shown to one decimal in the UI (6.8%).
  - |
    Design-system note: `design-system/tokens.css` may define `--duration-fast` and `--duration-spin` with invalid values, which would stop the `.skeleton` pulse; I did not re-check this on this pass, it is pre-existing and out of scope, and the skeleton still renders as a static block.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: None changed. No migration: movers are computed at read time from the existing `instruments` and `price_points` tables (`services/api/migrations/002_create_market_data.sql`). No stored rows, documents or payloads change shape.
  - **Backfill / seed**: none. No fixture is shipped; with no equity price points the endpoint returns two empty lists and the card shows its empty state (see the open question on the quote source).
  - **Settings**: none added.
  - **Provisioning**: the existing migrations must already have run (`migrate()` in `services/api/src/migrate.ts`) so `instruments` and `price_points` exist. Equity rows and price points must be loaded by something outside this story.
  - **Order and rollback**: deploy the API first, then the web app. The card shows its own error view if `/market/movers` is missing, so an old API does not break the page. Rollback: redeploy the previous builds; there is no schema to undo.

  ### UI sources

  Read from the approved prototype `TESTING-13-NOV-STORY-022-design.html`: the `<section data-wf-id="movers">` (lines 1094-1128, two tables with `aria-labelledby`, `scope="row"` symbol cells, badges with arrow and sign), the `movers-empty` state (1131-1141), the movers part of the `loading` state (1153-1156, skeletons at `calc(var(--control-height-lg) * 4)`), the `error` state (1170-1178), and its inline movers styles (944-950). Tokens load through `apps/web/src/index.css` (`@import "../../../design-system/tokens.css"` on line 2, `prototype-utils.css` on line 3, Tailwind on line 1). Status colours appear only through `.badge-success` and `.badge-danger` for up and down, as the UI guidelines reserve them. The prototype's header, index stats, chart and watchlist belong to STORY-021 and already exist in `MarketOverview`.

  ### Why the plan differs from the earlier draft

  The earlier draft assumed no market data existed and added a `market_movers` table and a `/movers` route. STORY-021 has since merged and added `instruments`, `price_points`, `MarketStore`, `/market/overview` and `MarketOverview`, so this plan reuses them: no new table, a `/market/movers` route beside the other market routes, and the card mounted in `MarketOverview`.

  ```mermaid
  flowchart TD
    MO[market/MarketOverview.tsx] --> MM[market/MarketMovers.tsx]
    MO --> DS[market/DashboardStates.tsx]
    MM --> MApi[market/api.ts getMovers]
    MM --> MCss[market/movers.css]
    MM --> Fmt[market/format.ts]
    MApi -->|GET /market/movers| Route[routes/movers.ts]
    Route --> Store[stores/movers.ts]
    Route --> Val[validation/market.ts rangeStart]
    Store --> Tbl[(instruments, price_points)]
    AppTs[services/api/src/app.ts buildApp] --> Route
    AppTs --> Auth[auth.ts requireUser]
    classDef touched fill:#f96,color:#000
    class MO,MM,DS,MApi,MCss,Route,Store,AppTs touched
  ```
  Touched nodes: `MarketMovers`, `movers.css`, `api.ts` and `routes/movers.ts` and `stores/movers.ts` are the new feature; `MarketOverview` mounts the card; `DashboardStates` gets the movers loading skeleton and one copy line; `app.ts` registers the route. `format.ts`, `validation/market.ts`, `auth.ts` and the tables are existing and only reused.
review_focus: |
  IN: the movers card only (top 3 gainers and losers, display-only), its `GET /market/movers` endpoint and store derived from existing `instruments` and `price_points`, and the card's loading, empty and error views. OUT: range, index stats, chart, watchlist and header Refresh (STORY-021, already built), quote ingestion or seed data, and any new table. Riskiest parts are ACs 3 and 4 (check that no row carries a handler, link, button, `tabindex`, `role`, hover fill or pointer cursor) and the ranking logic (zero change and `open === 0` excluded, ties broken by symbol). Deliberate: the Volume column from the prototype is dropped because no volume data exists, and the empty-state "Refresh" and error "Try again" buttons sit outside the mover entries.
