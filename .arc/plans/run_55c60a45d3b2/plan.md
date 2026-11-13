summary: |
  Build the Market overview screen end to end: one range control (1D, 1W, 1M, 1Y; 1D by default) that drives
  four index stat cards (S&P 500, Nasdaq, Dow, VIX) and a price chart with a symbol selector (first watchlist
  symbol by default), a legend (green up entry, red down entry, one toggle chip per index) and VIX drawn on its
  own right-hand axis. Nothing in the repo provides market data or a watchlist today (searched apps/web/src and
  services/api/src for watchlist, quote, market, symbol: no hits), so the plan adds the data path too: a
  migration for instruments, price points and a read-only watchlist, two read-only Fastify routes
  (GET /watchlist, GET /market/overview), and the React screen with a hand-rolled SVG chart that follows the
  approved prototype. Stats and chart come from ONE overview response per (range, symbol), and the client drops
  any response that is not for the current selection, which answers the deferred stale-response question.
scope:
  - description: |
      API: range parsing/validation. `parseRange(input: unknown): RangeKey | null` for `'1D' | '1W' | '1M' | '1Y'`,
      plus `rangeStart(range: RangeKey, now: Date): Date` (1D = 24h back, 1W = 7d, 1M = 1 month, 1Y = 1 year)
      and `downsample<T>(points: T[], max: number): T[]` (even stride, always keeps first and last).
    files:
      - services/api/src/validation/market.ts
    rationale: |
      Mirrors services/api/src/validation/expense.ts: pure, unit-testable, no Fastify or DB.
  - description: |
      API: migration `002_create_market_data.sql` (re-runnable, like 001). Tables:
      `instruments(symbol text PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK (kind IN ('index','equity')))`,
      `price_points(symbol text NOT NULL REFERENCES instruments(symbol), at timestamptz NOT NULL, price numeric(14,4) NOT NULL, PRIMARY KEY (symbol, at))`,
      `watchlist_items(user_id uuid NOT NULL, symbol text NOT NULL REFERENCES instruments(symbol), position int NOT NULL, PRIMARY KEY (user_id, symbol))`.
      Seeds the four index instruments with `INSERT ... ON CONFLICT DO NOTHING`:
      ^GSPC "S&P 500", ^IXIC "Nasdaq", ^DJI "Dow", ^VIX "VIX". Nothing else is seeded: price points come from a feed
      that is out of scope (see open questions).
    files:
      - services/api/migrations/002_create_market_data.sql
    rationale: |
      The screen needs stored data to read. src/migrate.ts already applies every migrations/*.sql in name order.
  - description: |
      API: stores, same interface + pg implementation + fake-in-tests pattern as stores/categories.ts.
      ```ts
      export type Point = { at: string; value: number };
      export type Series = { symbol: string; name: string; points: Point[] };
      export interface MarketStore {
        /** Points inside [from, to], oldest first; null when the symbol is unknown. */
        series(symbol: string, from: Date, to: Date): Promise<Series | null>;
      }
      export type WatchlistItem = { symbol: string; name: string };
      export interface WatchlistStore { listForUser(userId: string): Promise<WatchlistItem[]> } // ORDER BY position
      ```
    files:
      - services/api/src/stores/market.ts
      - services/api/src/stores/watchlist.ts
    rationale: |
      Keeps SQL out of routes so route tests run on fakes (as test/unit/expenses.test.ts does).
  - description: |
      API: routes, registered in buildApp behind the existing `requireUser` preHandler (`AppOptions` gains
      `market?: MarketStore; watchlist?: WatchlistStore; now?: () => Date`).
      `GET /watchlist` returns `{ symbols: WatchlistItem[] }` for `req.userId`.
      `GET /market/overview?range=1D&symbol=AAPL` (`symbol` optional; omitted for an empty watchlist) returns
      ```ts
      type OverviewResponse = {
        range: RangeKey;
        symbol: { symbol: string; price: number | null; changePct: number | null; points: Point[] } | null;
        indices: { key: 'spx' | 'ndx' | 'dji' | 'vix'; name: string; level: number | null;
                   changePct: number | null; low: number | null; high: number | null; points: Point[] }[];
      };
      ```
      Always four indices in the order spx, ndx, dji, vix. `changePct = (last - first) / first * 100` over the window,
      `low`/`high` = min/max of the window, `level` = last point; all null (points []) when the window has no data.
      Points are downsampled to at most 120 per series. 400 `{ errors: { range } }` for a bad range and
      `{ errors: { symbol } }` when the symbol is not on the caller's watchlist; 401 when signed out.
    files:
      - services/api/src/routes/market.ts
      - services/api/src/routes/watchlist.ts
      - services/api/src/app.ts
    rationale: |
      One response per (range, symbol) means stats and chart can never disagree about the range.
  - description: |
      Web: data layer. `apps/web/src/market/api.ts` mirrors expenses/api.ts (`fetch('/watchlist')`,
      `fetch('/market/overview?range=...&symbol=...', { signal })`, throws `Error` on non-OK) and exports the
      `RangeKey`, `OverviewResponse` and `WatchlistItem` types.
      `apps/web/src/market/useMarketOverview.ts`:
      `useMarketOverview(range: RangeKey, symbol: string | null): { data: OverviewResponse | null }`.
      Each change of range or symbol aborts the previous request (AbortController) and a sequence check ignores any
      response whose request is no longer the latest, so a slow 1D reply can never overwrite a newer 1M one.
    files:
      - apps/web/src/market/api.ts
      - apps/web/src/market/useMarketOverview.ts
    rationale: |
      Resolves the deferred question on keeping range and symbol in sync between requests.
  - description: |
      Web: pure chart model, `apps/web/src/market/chart-model.ts`.
      `buildChartModel(data: OverviewResponse, visible: Record<IndexKey, boolean>): ChartModel` returns left-axis
      ticks (percent change since the start of the range, shared by the symbol and spx/ndx/dji), a separate right-axis
      scale for VIX computed only from VIX points, polyline point strings per visible index, and the symbol line
      split into segments each tagged `'up' | 'down'` (up when the next value is >= the previous), as in the
      prototype's `renderChart`. Also `format.ts`: `formatLevel(n, decimals)`, `formatChange(pct)` returning
      "▲ +0.84%" / "▼ −0.21%" (true minus sign U+2212 as in the prototype) and the matching badge variant.
    files:
      - apps/web/src/market/chart-model.ts
      - apps/web/src/market/format.ts
    rationale: |
      Keeps scale and up/down logic testable without rendering SVG.
  - description: |
      Web: components, built from the approved prototype (Stock Market Dashboard screen, default state).
      `MarketOverview.tsx` owns `range` (initial '1D'), `symbol` (initial = first watchlist symbol), `visible`
      (all four indices on). Layout: `.page-header` with `<h1>Market overview</h1>` and the Range `<select class="select">`
      (labelled "Range", options 1D/1W/1M/1Y), then `.grid` of four `IndexStatCard` (`.card.stat`: name, `.stat-value`
      level, `.badge-success`/`.badge-danger` change badge + "over 1 day/1 week/1 month/1 year", low/high row),
      then the chart `.card` (`PriceChart.tsx`): heading "AAPL price, 1 day", readout line, Symbol `<select class="select">`
      fed by the watchlist, `ChartLegend.tsx`, axis note, and the `<svg role="img">` with aria-label like the prototype.
      `ChartLegend`: `role="group" aria-label="Chart legend"`, `<span class="badge badge-success">▲ Increasing line</span>`,
      `<span class="badge badge-danger">▼ Decreasing line</span>`, then four `<button class="chip" aria-pressed>` toggles
      with a swatch (S&P 500, Nasdaq, Dow, "VIX (right axis)"). A visually-hidden `role="status" aria-live="polite"`
      region announces range, symbol and toggle changes ("Showing 1 week. Index stats and chart updated.").
      Leave out of this story, as the item says: Refresh button, Edit list, the Watchlist side panel, Top movers table,
      Price/Volume tabs, and the loading/empty/error views (siblings and the Watchlist epic). The chart card therefore
      takes the full content width. `App.tsx` renders `<MarketOverview />` above the existing `<AddExpenseForm />`.
    files:
      - apps/web/src/market/MarketOverview.tsx
      - apps/web/src/market/IndexStatCard.tsx
      - apps/web/src/market/PriceChart.tsx
      - apps/web/src/market/ChartLegend.tsx
      - apps/web/src/App.tsx
    rationale: |
      Implements ACs 1-15 on the real data path instead of the prototype's inline sample JSON.
  - description: |
      Web: styling. Tokens are already loaded: apps/web/src/index.css line 2 imports ../../../design-system/tokens.css and
      line 3 imports ../../../design-system/prototype-utils.css, which defines `.card`, `.grid`, `.select`, `.chip`,
      `.badge`, `.badge-success`, `.badge-danger`, `.stack`, `.cluster`, `.text-muted`, `.text-sm`, `.visually-hidden`.
      The prototype's own inline classes are not in the design system, so market.css defines them: `.overview`,
      `.page-header`, `.stat`, `.stat-value`, `.stat-badges`, `.stat-range`, `.chart-head`, `.symbol-field`, `.legend`,
      `.swatch`, `.plot`, `.gl`, `.ax`, `.ln`, `.ln-spx`, `.ln-ndx`, `.ln-dji`, `.ln-vix`, `.ln-sym`, `.up`, `.down`.
      The per-card sparklines (`.spark`) are not in any AC and are left out.
      Tokens used: --space-1..4, --color-fg, --color-fg-muted, --color-primary (spx line, h1), --color-accent (ndx line),
      --color-pink (dji line), --color-success (up), --color-danger (down), --color-border and --color-border-strong
      (grid and zero line), --font-size-sm/lg/xl, --font-weight-medium, --control-height-lg (select, chip), --opacity-disabled
      (swatch of a hidden index), --container-max, --focus-ring-width, --font-family-base, --radius-md.
      Index lines differ by colour and dash pattern (prototype assumption) because green/red are reserved for up/down.
    files:
      - apps/web/src/market/market.css
    rationale: |
      Only tokens; no hex/rgb literals. Imported from MarketOverview.tsx next to the component, like expenses/expense-form.css.
tests:
  - |
    AC 10, 1 (apps/web/src/market/MarketOverview.test.tsx, `vi.mock('./api')` like App.test.tsx): 1D is active on load, and picking
    another range makes it the active one.
    ```ts
    render(<MarketOverview />)
    const range = await screen.findByRole('combobox', { name: 'Range' })
    expect(range).toHaveValue('1D')
    fireEvent.change(range, { target: { value: '1M' } })
    expect(range).toHaveValue('1M')
    ```
  - |
    AC 2, 3 (same file): the fake `getOverview` is called with the new range and the stats and chart show that response.
    ```ts
    fireEvent.change(range, { target: { value: '1W' } })
    expect(getOverview).toHaveBeenLastCalledWith('1W', 'AAPL', expect.anything())
    expect(await screen.findAllByText(/over 1 week/)).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'AAPL price, 1 week' })).toBeInTheDocument()
    ```
  - |
    AC 4, 5 (same file): all four stat cards plus range control, and chart are on screen together.
    ```ts
    for (const n of ['S&P 500', 'Nasdaq', 'Dow', 'VIX']) expect(await screen.findByText(n, { selector: 'span' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Range' })).toBeVisible()
    expect(screen.getByRole('img', { name: /Line chart of AAPL/ })).toBeVisible()
    ```
  - |
    AC 6, 11 (same file): chart opens on the first watchlist symbol and follows the symbol selector.
    ```ts
    expect(await screen.findByRole('combobox', { name: 'Symbol' })).toHaveValue('AAPL')
    fireEvent.change(screen.getByRole('combobox', { name: 'Symbol' }), { target: { value: 'NVDA' } })
    expect(await screen.findByRole('heading', { name: /^NVDA price/ })).toBeInTheDocument()
    expect(getOverview).toHaveBeenLastCalledWith('1D', 'NVDA', expect.anything())
    ```
  - |
    AC 7, 14, 15 (apps/web/src/market/ChartLegend.test.tsx): legend renders with up and down entries, coloured by the status classes.
    ```ts
    expect(screen.getByRole('group', { name: 'Chart legend' })).toBeInTheDocument()
    expect(screen.getByText('▲ Increasing line')).toHaveClass('badge-success')
    expect(screen.getByText('▼ Decreasing line')).toHaveClass('badge-danger')
    ```
    jsdom does not resolve the stylesheet, so green and red are asserted through the design system's status classes, which map to
    `--color-success` and `--color-danger` in prototype-utils.css.
  - |
    AC 8, 9, 12 (same file and MarketOverview.test.tsx): all four lines present at first load; toggling a chip off removes that
    line and on restores it.
    ```ts
    expect(container.querySelectorAll('polyline.ln-spx, polyline.ln-ndx, polyline.ln-dji, polyline.ln-vix')).toHaveLength(4)
    const nasdaq = screen.getByRole('button', { name: 'Nasdaq' })
    expect(nasdaq).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(nasdaq)
    expect(nasdaq).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('polyline.ln-ndx')).toBeNull()
    fireEvent.click(nasdaq)
    expect(container.querySelector('polyline.ln-ndx')).not.toBeNull()
    ```
  - |
    AC 13 (apps/web/src/market/chart-model.test.ts): VIX has its own scale, independent of the other lines.
    ```ts
    const model = buildChartModel(overview({ vix: [14.5, 15.3], spx: [0, 0.84] }), allOn)
    expect(model.rightAxis!.ticks[0]).toBeGreaterThanOrEqual(13)   // VIX levels, not percent
    expect(model.leftAxis.ticks).toContain(0)
    expect(model.leftAxis.max).toBeLessThan(5)                    // unaffected by VIX at ~15
    expect(buildChartModel(overview(), { ...allOn, vix: false }).rightAxis).toBeNull()
    ```
    and in MarketOverview.test.tsx: `expect(screen.getByText(/Right axis: VIX level/)).toBeInTheDocument()`.
  - |
    AC 14, 15 logic (chart-model.test.ts): symbol segments are tagged up or down.
    ```ts
    const { segments } = buildChartModel(overview({ symbol: [0, 1, 0.5] }), allOn)
    expect(segments.map((s) => s.direction)).toEqual(['up', 'down'])
    ```
    format.test.ts: `expect(formatChange(0.84)).toEqual({ text: '▲ +0.84%', tone: 'success' })` and
    `expect(formatChange(-0.21)).toEqual({ text: '▼ −0.21%', tone: 'danger' })`.
  - |
    Deferred question, stale responses (apps/web/src/market/useMarketOverview.test.tsx): a slow earlier response must not overwrite a newer one.
    ```ts
    // getOverview('1D') resolves after getOverview('1M')
    rerender({ range: '1M' }); resolve1M(overview1M); resolve1D(overview1D)
    await waitFor(() => expect(result.current.data?.range).toBe('1M'))
    expect(firstCallSignal.aborted).toBe(true)
    ```
  - |
    API AC 4, 12 (services/api/test/unit/market.test.ts, FakeMarket/FakeWatchlist in the style of expenses.test.ts): overview returns the
    four indices in order, each with stats computed from its window.
    ```ts
    const res = await app.inject({ method: 'GET', url: '/market/overview?range=1D&symbol=AAPL' })
    expect(res.statusCode).toBe(200)
    expect(res.json().indices.map((i: { key: string }) => i.key)).toEqual(['spx', 'ndx', 'dji', 'vix'])
    expect(res.json().indices[0]).toMatchObject({ level: 5412.3, low: 5371.8, high: 5420.11, changePct: expect.closeTo(0.84, 2) })
    ```
  - |
    API AC 2, 3 (same file): each range queries its own window and the stats and series differ.
    ```ts
    await get('1W'); expect(market.calls.at(-1)!.from.toISOString()).toBe('2026-11-06T12:00:00.000Z') // now = 2026-11-13T12:00:00Z
    expect(rangeStart('1D', now).toISOString()).toBe('2026-11-12T12:00:00.000Z')
    ```
    validation unit tests: `expect(parseRange('2D')).toBeNull()`; `expect(downsample(range(500), 120)).toHaveLength(120)` keeping first and last.
  - |
    API AC 6, 11 and errors (same file): bad range gives 400, a symbol not on the watchlist gives 400, signed out gives 401, and `GET /watchlist`
    returns the caller's symbols in position order and nobody else's.
    ```ts
    expect((await get('9Y')).statusCode).toBe(400)
    expect((await get('1D', 'ZZZZ')).json()).toEqual({ errors: { symbol: 'Choose a symbol from your watchlist.' } })
    expect((await build(null).inject({ method: 'GET', url: '/watchlist' })).statusCode).toBe(401)
    expect(res.json().symbols.map((s: { symbol: string }) => s.symbol)).toEqual(['AAPL', 'MSFT'])
    ```
  - |
    Empty watchlist (same file, plus MarketOverview.test.tsx): no symbol still returns the four indices, and the screen disables the Symbol select.
    ```ts
    const res = await app.inject({ method: 'GET', url: '/market/overview?range=1D' })
    expect(res.json().symbol).toBeNull()
    expect(res.json().indices).toHaveLength(4)
    // web, getWatchlist resolves []
    expect(await screen.findByRole('combobox', { name: 'Symbol' })).toBeDisabled()
    ```
  - |
    Empty window (same file): an index with no points returns nulls and `points: []`, status 200, so the page does not break.
    ```ts
    expect(res.json().indices[3]).toMatchObject({ key: 'vix', level: null, changePct: null, points: [] })
    ```
  - |
    Existing data stays usable after migration 002 (services/api/test/unit/migrations.test.ts, string-level check since the unit suite has no database):
    ```ts
    const sql = await readFile('migrations/002_create_market_data.sql', 'utf8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS price_points/)
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/)
    expect(sql).not.toMatch(/ALTER TABLE expenses|DROP /i)
    ```
    App.test.tsx also keeps passing: its mock adds `vi.mock('./market/api', ...)` and still asserts `screen.getByRole('heading', { name: 'Add expense' })`.
assumptions_or_open_questions:
  - |
    ONE QUESTION STILL NEEDS A HUMAN (price data source). There is no market-price source in the repo, the ADR index (ADR-0001 to ADR-0009 cover an
    identity provider and an email provider, no market-data provider) or the item. Decision taken in this plan: the `price_points` table is the contract.
    This story reads it and ships no sample data and no ingestion. Recommended: raise a separate story for the feed (vendor, schedule, licence). Until
    it lands the screen shows empty values ("—") for every figure. Please confirm, or name a source and this plan grows an ingestion job.
  - |
    Decided, watchlist: the Watchlist epic owns editing, so this story adds only the `watchlist_items` table and a read-only `GET /watchlist`; that epic
    adds writes on the same table. An empty watchlist is handled without failing: `symbol` is optional on `GET /market/overview`, the response then has
    `symbol: null`, index stats and index lines still show, and the Symbol select is disabled. The proper empty state is a sibling story.
  - |
    Decided, prototype vs item scope: Refresh, the Watchlist side panel, Top movers, the Price/Volume tabs and the top bar are drawn in the prototype but
    named out of scope by the item (movers, refresh, non-happy states, watchlist editing) or have no AC, so they are not built. apps/web has no router or
    shell (App.tsx renders only the expense form), so `App.tsx` renders `<MarketOverview />` above the existing `<AddExpenseForm />` and a shell is left
    to its own story.
  - |
    Decided, prototype vs AC 1: the prototype uses a native labelled select for the range, which shows the chosen value as active. The plan follows the
    prototype, not a segmented control.
  - |
    Decided, deferred stale-response question: one `/market/overview` request per (range, symbol) so stats and chart come from the same response, plus abort
    and a latest-request check in `useMarketOverview`. A symbol change refetches the index stats too (same values); two endpoints would avoid that but
    bring the sync problem back.
  - |
    Decided, browsers and screen sizes (project-wide question): last two major versions of Chrome, Edge, Firefox and Safari, on desktop, iOS Safari and
    Android Chrome; no Internet Explorer. Layout is mobile-first from 375px up to `--container-max`; the chart scrolls horizontally inside `.plot` below its
    minimum width, as in the prototype. Nothing in the plan needs a browser-specific API beyond SVG, CSS grid and `AbortController`.
  - |
    Decided, design-system gaps. (1) `design-system/tokens.css` lines 76-77 set `--duration-fast` and `--duration-spin` to `[object Object]`, which is invalid,
    so market.css uses no transition or animation (flag to the design-system owner; not fixed here). (2) Values with no token are built from tokens:
    chart min-width = `calc(var(--container-max) / 2)` (560px as in the prototype); index line stroke = `var(--focus-ring-width)`; symbol line stroke =
    `calc(var(--focus-ring-width) + var(--border-width))`; dash patterns use `var(--space-1)`, `var(--space-2)`, `var(--focus-ring-width)` as lengths
    (ndx `var(--space-2) var(--space-1)`, dji `var(--focus-ring-width) var(--space-1)`, vix `var(--space-2) var(--space-1) var(--focus-ring-width) var(--space-1)`),
    so they differ slightly from the prototype's 6 3 / 2 3 / 8 3 2 3 but stay distinct. (3) `.page-header`, `.stat`, `.legend`, `.swatch` and the chart
    classes are only in the prototype's inline style, so market.css defines them on the same tokens.
  - |
    Decided, colour use: VIX is on a right-hand level axis and the other lines on a left-hand percent-change axis, as in the prototype. Green and red are
    used only for the symbol line segments, change badges and legend up/down entries; index lines differ by colour and dash pattern.
  - |
    Decided, number format: no currency symbol, as in the prototype. Levels use 2 decimals (VIX 1), formatted with `Intl.NumberFormat`.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: migration `002_create_market_data.sql` only creates three new tables (`IF NOT EXISTS`) and seeds four index rows. It does not
    touch `expenses` or `categories`, so existing rows are unaffected. No NOT NULL column is added to an existing table.
  - **Backfill / seed**: the four index instruments are seeded with `ON CONFLICT DO NOTHING`, so re-running `pnpm` migrate (services/api/src/migrate.ts) is safe.
    `price_points` and `watchlist_items` need real data from a feed and from the Watchlist epic; neither is backfilled here (open question 1 and 2).
  - **Settings**: none. No new env var or config file.
  - **Provisioning**: the feature shows data only once something writes `price_points` for ^GSPC, ^IXIC, ^DJI, ^VIX and for each watchlist symbol.
    Nothing in this plan creates that.
  - **Order and rollback**: run the migration before deploying the API that reads the tables. Roll back by dropping `watchlist_items`, `price_points`
    and `instruments` (nothing else references them); leaving them in place is harmless.

  ### Research

  - Styling is Tailwind 4 plus design-system CSS: apps/web/src/index.css line 1 `@import "tailwindcss"`, line 2 `tokens.css`, line 3 `prototype-utils.css`;
    vite.config.ts loads `@tailwindcss/vite`. No loading work is needed; new component CSS sits next to its component like expenses/expense-form.css.
  - API shape: routes are plugin factories taking stores and `requireUser` (routes/categories.ts), wired in `buildApp` (app.ts), tests inject fakes
    (test/unit/expenses.test.ts). The new code follows that. Web: `fetch` wrappers in expenses/api.ts, tests mock the api module (App.test.tsx).
  - No charting library is in apps/web/package.json; the chart is plain SVG as in the prototype, so no new dependency. Component tests use
    `@testing-library/react`; `@testing-library/user-event` is not in package.json, so the tests use `fireEvent` and do not add the package.
  - Test commands (narrow): `(cd services/api && pnpm run test -- test/unit/market.test.ts)` and `(cd apps/web && pnpm test -- src/market)`.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    App[apps/web/src/App.tsx]:::touched -->|renders dashboard| MO[market/MarketOverview.tsx]:::touched
    App --> AEF[expenses/AddExpenseForm.tsx]
    MO --> HOOK[market/useMarketOverview.ts]:::touched
    MO --> PC[market/PriceChart.tsx]:::touched
    MO --> ISC[market/IndexStatCard.tsx]:::touched
    PC --> LEG[market/ChartLegend.tsx]:::touched
    PC --> CM[market/chart-model.ts]:::touched
    HOOK --> WAPI[market/api.ts]:::touched
    WAPI -->|GET /watchlist, /market/overview| APP[services/api/src/app.ts]:::touched
    APP --> MR[routes/market.ts]:::touched
    APP --> WR[routes/watchlist.ts]:::touched
    APP --> AUTH[auth.ts requireUser]
    MR --> VAL[validation/market.ts]:::touched
    MR --> MS[stores/market.ts]:::touched
    WR --> WS[stores/watchlist.ts]:::touched
    MS --> DB[(migrations/002_create_market_data.sql)]:::touched
    WS --> DB
    MIG[src/migrate.ts] --> DB
  ```
review_focus: |
  All earlier open questions are now decided in the plan except the price-data source. IN: range control, four index stats, price chart with symbol selector, legend (up green, down red, index toggles) and VIX on its own axis, plus the
  read-only API and migration behind them. OUT: movers, refresh, loading/empty/error states, watchlist editing, Volume tab, top bar, and any price ingestion.
  Riskiest parts are the stale-response guard in `useMarketOverview` and the dual-axis maths in `chart-model.ts`; the biggest open item is that no market-data
  source exists, so the screen shows nulls until another story fills `price_points`. Re-defining the prototype's inline classes in market.css on tokens
  and the lack of a router/shell are deliberate and listed as open questions.
