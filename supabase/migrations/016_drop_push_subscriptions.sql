-- Drop the push_subscriptions table: the web-push feature was removed (no sender
-- ever existed), so the table only accumulated dead subscription rows. Safe to drop.
DROP TABLE IF EXISTS push_subscriptions;
