-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    gmail_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255), 
    image TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    history_id BIGINT, -- Gmail history ID for incremental sync
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending', -- pending, syncing, completed, failed
    total_emails INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_sync_status ON users(sync_status);

-- Email messages table (denormalized for analysis performance)
CREATE TABLE email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id VARCHAR(255) NOT NULL,
    gmail_thread_id VARCHAR(255) NOT NULL,
    subject TEXT,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipient_emails TEXT[], -- Array of recipient emails
    date TIMESTAMP NOT NULL,
    snippet TEXT,
    size_bytes INTEGER,
    labels TEXT[], -- Array of Gmail labels
    category VARCHAR(50), -- primary, social, promotions, updates, forums
    is_unread BOOLEAN DEFAULT false,
    has_attachment BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    is_starred BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    raw_headers JSONB, -- Store important headers as JSONB for querying
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, gmail_message_id)
);

-- Indexes for fast querying
CREATE INDEX idx_messages_user_id ON email_messages(user_id);
CREATE INDEX idx_messages_date ON email_messages(date DESC);
CREATE INDEX idx_messages_sender ON email_messages(sender_email);
CREATE INDEX idx_messages_category ON email_messages(category);
CREATE INDEX idx_messages_unread ON email_messages(is_unread) WHERE is_unread = true;
CREATE INDEX idx_messages_labels ON email_messages USING GIN(labels);
CREATE INDEX idx_messages_user_date ON email_messages(user_id, date DESC);

-- Composite index for common queries
CREATE INDEX idx_messages_user_category_date ON email_messages(user_id, category, date DESC);

-- Sender analysis table (pre-computed for performance)
CREATE TABLE sender_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    total_emails INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    first_email_date TIMESTAMP,
    last_email_date TIMESTAMP,
    avg_emails_per_month DECIMAL(10,2),
    categories JSONB, -- Distribution of categories
    has_unsubscribe BOOLEAN DEFAULT false,
    unsubscribe_url TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, sender_email)
);

CREATE INDEX idx_sender_stats_user ON sender_stats(user_id);
CREATE INDEX idx_sender_stats_total ON sender_stats(total_emails DESC);

-- Email attachments table
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    filename VARCHAR(500),
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    gmail_attachment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON email_attachments(message_id);
CREATE INDEX idx_attachments_size ON email_attachments(size_bytes DESC);

-- Sync jobs table (for background processing)
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- full_sync, incremental_sync, analysis
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0, -- Percentage 0-100
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_user ON sync_jobs(user_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);

-- Analysis cache table (for expensive computations)
CREATE TABLE analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, cache_key)
);

CREATE INDEX idx_analysis_cache_user_key ON analysis_cache(user_id, cache_key);
CREATE INDEX idx_analysis_cache_expires ON analysis_cache(expires_at);