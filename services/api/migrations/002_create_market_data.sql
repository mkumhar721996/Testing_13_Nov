CREATE TABLE IF NOT EXISTS instruments (
  symbol text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('index', 'equity'))
);

CREATE TABLE IF NOT EXISTS price_points (
  symbol text NOT NULL REFERENCES instruments (symbol),
  at timestamptz NOT NULL,
  price numeric(14, 4) NOT NULL,
  PRIMARY KEY (symbol, at)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  user_id uuid NOT NULL,
  symbol text NOT NULL REFERENCES instruments (symbol),
  position int NOT NULL,
  PRIMARY KEY (user_id, symbol)
);

INSERT INTO instruments (symbol, name, kind) VALUES
  ('^GSPC', 'S&P 500', 'index'),
  ('^IXIC', 'Nasdaq', 'index'),
  ('^DJI', 'Dow', 'index'),
  ('^VIX', 'VIX', 'index')
ON CONFLICT DO NOTHING;
