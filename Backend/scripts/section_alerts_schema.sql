CREATE TABLE IF NOT EXISTS section_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_code TEXT NOT NULL,
    term TEXT,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    emailed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_section_alerts_user_id ON section_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_section_alerts_section_id ON section_alerts(section_id);
CREATE INDEX IF NOT EXISTS idx_section_alerts_emailed_at ON section_alerts(emailed_at);
