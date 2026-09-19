-- Runs once when the local Postgres volume is first created.
-- Separate database for API integration tests so they never touch development data.
CREATE DATABASE fieldmate_test OWNER fieldmate;
