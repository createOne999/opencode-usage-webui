CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp);
CREATE TABLE requests (
 id UUID PRIMARY KEY, session_id VARCHAR NOT NULL, project_id VARCHAR NOT NULL, agent VARCHAR,
 kind VARCHAR NOT NULL, provider VARCHAR NOT NULL, model VARCHAR NOT NULL, assistant_message_id VARCHAR,
 started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ, latency_ms BIGINT,
 status VARCHAR NOT NULL, error_type VARCHAR, error_message VARCHAR,
 uncached_input_tokens BIGINT NOT NULL DEFAULT 0, output_tokens BIGINT NOT NULL DEFAULT 0,
 reasoning_tokens BIGINT NOT NULL DEFAULT 0, cache_read_tokens BIGINT NOT NULL DEFAULT 0,
 cache_write_tokens BIGINT NOT NULL DEFAULT 0, usage_available BOOLEAN NOT NULL DEFAULT false,
 reported_cost_usd DOUBLE, estimated_cost_usd DOUBLE, estimated_cache_savings_usd DOUBLE,
 cost_source VARCHAR, request_payload VARIANT, response_payload VARIANT,
 created_at TIMESTAMPTZ DEFAULT current_timestamp
);
CREATE INDEX requests_session ON requests(session_id);
CREATE INDEX requests_started ON requests(started_at);
CREATE TABLE message_parts (
 request_id UUID NOT NULL, message_index INTEGER NOT NULL, part_index INTEGER NOT NULL,
 role VARCHAR NOT NULL, part_type VARCHAR NOT NULL, direction VARCHAR NOT NULL,
 text VARCHAR, estimated_tokens BIGINT NOT NULL, char_count BIGINT NOT NULL,
 tool_name VARCHAR, tool_call_id VARCHAR, blob_id VARCHAR, payload VARIANT,
 PRIMARY KEY (request_id, message_index, part_index)
);
CREATE TABLE tool_events (
 request_id UUID NOT NULL, session_id VARCHAR NOT NULL, tool_call_id VARCHAR NOT NULL,
 tool_name VARCHAR, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
 status VARCHAR, input VARIANT, output VARIANT, error VARCHAR,
 PRIMARY KEY(request_id, tool_call_id)
);
CREATE TABLE model_prices (
 provider VARCHAR NOT NULL, model VARCHAR NOT NULL, input_per_million DOUBLE NOT NULL,
 output_per_million DOUBLE NOT NULL, cache_read_per_million DOUBLE NOT NULL,
 cache_write_per_million DOUBLE NOT NULL, effective_from TIMESTAMPTZ NOT NULL,
 effective_to TIMESTAMPTZ, source VARCHAR NOT NULL,
 PRIMARY KEY(provider,model,effective_from)
);
-- Offline reference estimates, not live quotes or provider-billed amounts.
INSERT INTO model_prices VALUES
 ('openai','gpt-4o',2.5,10,1.25,0,'2025-01-01',NULL,'offline reference estimate: openai.com/api/pricing'),
 ('openai','gpt-4o-mini',0.15,0.6,0.075,0,'2025-01-01',NULL,'offline reference estimate: openai.com/api/pricing'),
 ('anthropic','claude-sonnet-4-20250514',3,15,0.3,3.75,'2025-05-22',NULL,'offline reference estimate: anthropic.com/pricing'),
 ('anthropic','claude-opus-4-20250514',15,75,1.5,18.75,'2025-05-22',NULL,'offline reference estimate: anthropic.com/pricing'),
 ('google','gemini-2.0-flash',0.1,0.4,0.025,0,'2025-02-01',NULL,'offline reference estimate: ai.google.dev/pricing'),
 ('openrouter','openai/gpt-4o',2.5,10,1.25,0,'2025-01-01',NULL,'offline reference estimate: openrouter.ai/openai/gpt-4o'),
 ('openrouter','anthropic/claude-sonnet-4',3,15,0.3,3.75,'2025-05-22',NULL,'offline reference estimate: openrouter.ai/anthropic/claude-sonnet-4');
CREATE TABLE blobs (
 blob_id VARCHAR PRIMARY KEY, sha256 VARCHAR NOT NULL, mime_type VARCHAR,
 byte_size BIGINT NOT NULL, relative_path VARCHAR NOT NULL, created_at TIMESTAMPTZ DEFAULT current_timestamp
);
