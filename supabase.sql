-- Twitter Bot Database Schema for Supabase

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    views INTEGER DEFAULT 0,
    media JSONB DEFAULT '[]'::jsonb,
    posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP WITH TIME ZONE,
    tweet_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bot_config table
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN DEFAULT FALSE,
    min_posts_per_day INTEGER DEFAULT 7,
    max_posts_per_day INTEGER DEFAULT 15,
    start_time TIME DEFAULT '08:00:00',
    end_time TIME DEFAULT '22:00:00',
    posts_today INTEGER DEFAULT 0,
    last_post_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id SERIAL PRIMARY KEY,
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'skipped')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_posted ON posts(posted);
CREATE INDEX IF NOT EXISTS idx_posts_views ON posts(views DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_time ON scheduled_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_config_updated_at
    BEFORE UPDATE ON bot_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at
    BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default bot config
INSERT INTO bot_config (is_active, min_posts_per_day, max_posts_per_day, start_time, end_time)
VALUES (FALSE, 7, 15, '08:00:00', '22:00:00')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for authenticated users)
CREATE POLICY "Enable all operations for authenticated users" ON posts
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON bot_config
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON scheduled_posts
    FOR ALL
    USING (true)
    WITH CHECK (true);
