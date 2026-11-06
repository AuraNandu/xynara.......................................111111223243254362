CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, rank TEXT DEFAULT 'MEMBER', avatar_emoji TEXT DEFAULT '👽', banned INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', emoji TEXT DEFAULT '🪐', owner_id TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT DEFAULT 'text');
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, channel_id TEXT, dm_key TEXT, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL, content TEXT NOT NULL, flagged INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS follows (follower_id TEXT NOT NULL, following_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (follower_id, following_id));
CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, question TEXT NOT NULL, options TEXT NOT NULL, votes TEXT DEFAULT '{}', channel_id TEXT, created_by TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_msg_channel ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_dm ON messages(dm_key, created_at);
