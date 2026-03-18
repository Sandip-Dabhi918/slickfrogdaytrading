-- ============================================================
-- Migration: Add user_id + Row Level Security
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. stock_profiles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE stock_profiles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill: if you have existing rows without a user, you can
-- assign them to a specific user or just leave NULL for now.
-- UPDATE stock_profiles SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;

ALTER TABLE stock_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles"
  ON stock_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles"
  ON stock_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
  ON stock_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
  ON stock_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. peer_groups  (scoped via stock_profiles FK)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE peer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view peer groups for own profiles"
  ON peer_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stock_profiles sp
      WHERE sp.id = peer_groups.profile_id
        AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert peer groups for own profiles"
  ON peer_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock_profiles sp
      WHERE sp.id = peer_groups.profile_id
        AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete peer groups for own profiles"
  ON peer_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stock_profiles sp
      WHERE sp.id = peer_groups.profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. alert_history
-- ─────────────────────────────────────────────────────────────
ALTER TABLE alert_history
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history"
  ON alert_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert history"
  ON alert_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. trade_journal
-- ─────────────────────────────────────────────────────────────
ALTER TABLE trade_journal
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE trade_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
  ON trade_journal FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON trade_journal FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trade_journal FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON trade_journal FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 5. price_history (session data — scoped per user)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price history"
  ON price_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own price history"
  ON price_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 6. signals
-- ─────────────────────────────────────────────────────────────
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
  ON signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals"
  ON signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Unique constraint: one profile per (ticker, user) instead
--    of the old global unique on ticker alone
-- ─────────────────────────────────────────────────────────────

-- Drop the old single-column unique if it exists
ALTER TABLE stock_profiles DROP CONSTRAINT IF EXISTS stock_profiles_ticker_key;

-- Add composite unique so the upsert onConflict works correctly
ALTER TABLE stock_profiles
  ADD CONSTRAINT stock_profiles_ticker_user_id_key UNIQUE (ticker, user_id);

-- ─────────────────────────────────────────────────────────────
-- 8. Indexes for performance
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_profiles_user_id    ON stock_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_user_id     ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_journal_user_id     ON trade_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user_id     ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_user_id           ON signals(user_id);
