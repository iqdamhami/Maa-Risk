-- ============================================================
-- ماء ريسك (Mā’ Risk) — Database Schema
-- Engine: PostgreSQL 15+ with PostGIS extension
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,          -- argon2 / bcrypt
    full_name       VARCHAR(120) NOT NULL,
    role            VARCHAR(30) NOT NULL DEFAULT 'analyst'
                    CHECK (role IN ('admin', 'planner', 'analyst', 'funder', 'viewer')),
    organization    VARCHAR(200),
    preferred_lang  CHAR(2) DEFAULT 'ar' CHECK (preferred_lang IN ('ar', 'en', 'fr')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
-- 2. PROJECTS (وحدة العمل الأساسية)
-- ============================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    region_name     VARCHAR(200),                   -- اسم المنطقة/الحوض
    bbox            GEOMETRY(Polygon, 4326),        -- حدود تقريبية
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'archived')),
    current_step    SMALLINT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_bbox ON projects USING GIST (bbox);

CREATE TABLE project_members (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'editor'
                    CHECK (role IN ('owner', 'editor', 'viewer')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- ============================================================
-- 3. DATA INGESTION (الوحدة 1)
-- ============================================================

CREATE TABLE datasets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(250) NOT NULL,
    data_type       VARCHAR(40) NOT NULL
                    CHECK (data_type IN (
                        'climate_rainfall', 'climate_temperature', 'drought_index',
                        'water_surface', 'water_groundwater', 'health',
                        'demographic', 'spatial', 'other'
                    )),
    source_name     VARCHAR(200),
    source_url      TEXT,
    coverage_start  DATE,
    coverage_end    DATE,
    spatial_resolution VARCHAR(80),
    temporal_resolution VARCHAR(40),                -- e.g. monthly, daily
    quality_level   VARCHAR(20) NOT NULL DEFAULT 'medium'
                    CHECK (quality_level IN ('high', 'medium', 'low', 'uncertain')),
    license_note    TEXT,
    notes           TEXT,
    is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
    file_path       TEXT,                           -- مسار الملف المخزّن
    file_format     VARCHAR(20),                    -- csv, geojson, netcdf, ...
    file_size_bytes BIGINT,
    metadata_json   JSONB DEFAULT '{}',
    uploaded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_datasets_project ON datasets(project_id);
CREATE INDEX idx_datasets_type ON datasets(data_type);

-- قياسات نقطية زمنية (أمطار، حرارة، SPI...)
CREATE TABLE time_series_observations (
    id              BIGSERIAL PRIMARY KEY,
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    observed_at     TIMESTAMPTZ NOT NULL,
    location        GEOMETRY(Point, 4326),
    location_name   VARCHAR(150),
    variable        VARCHAR(60) NOT NULL,           -- rainfall_mm, temp_c, spi, ...
    value           DOUBLE PRECISION NOT NULL,
    unit            VARCHAR(30),
    quality_flag    VARCHAR(20) DEFAULT 'ok'
);

CREATE INDEX idx_ts_dataset_time ON time_series_observations(dataset_id, observed_at);
CREATE INDEX idx_ts_location ON time_series_observations USING GIST (location);

-- بيانات جدولية عامة (صحة، سكان...)
CREATE TABLE tabular_records (
    id              BIGSERIAL PRIMARY KEY,
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    region_code     VARCHAR(50),
    region_name     VARCHAR(150),
    attributes      JSONB NOT NULL DEFAULT '{}',
    geom            GEOMETRY(MultiPolygon, 4326),
    recorded_at     DATE
);

CREATE INDEX idx_tabular_dataset ON tabular_records(dataset_id);
CREATE INDEX idx_tabular_geom ON tabular_records USING GIST (geom);

-- ============================================================
-- 4. RISK ASSESSMENT (الوحدة 2)
-- ============================================================

CREATE TABLE risk_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL DEFAULT 'تحليل افتراضي',
    time_horizon    VARCHAR(20) NOT NULL
                    CHECK (time_horizon IN ('short', 'medium', 'long')),  -- 1-5 / 5-15 / 15-30
    climate_scenario VARCHAR(20) NOT NULL DEFAULT 'SSP2-4.5',
    confidence_level SMALLINT NOT NULL DEFAULT 95 CHECK (confidence_level IN (90, 95, 99)),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    water_scarcity_score   DOUBLE PRECISION,       -- 0–1
    drought_score          DOUBLE PRECISION,
    health_vulnerability   DOUBLE PRECISION,
    composite_score        DOUBLE PRECISION,
    uncertainty_json       JSONB,                  -- { water: 0.12, drought: 0.18, ... }
    forecast_json          JSONB,                  -- توقعات حسب السنة
    model_version          VARCHAR(40),
    run_by                 UUID REFERENCES users(id),
    started_at             TIMESTAMPTZ,
    completed_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_project ON risk_analyses(project_id);

CREATE TABLE risk_zone_scores (
    id              BIGSERIAL PRIMARY KEY,
    analysis_id     UUID NOT NULL REFERENCES risk_analyses(id) ON DELETE CASCADE,
    region_name     VARCHAR(150),
    geom            GEOMETRY(MultiPolygon, 4326),
    water_score     DOUBLE PRECISION,
    drought_score   DOUBLE PRECISION,
    health_score    DOUBLE PRECISION,
    composite       DOUBLE PRECISION,
    population      INTEGER,
    vulnerable_groups JSONB                        -- { children: 0.3, women: 0.25, pastoralists: 0.4 }
);

CREATE INDEX idx_risk_zone_geom ON risk_zone_scores USING GIST (geom);

-- ============================================================
-- 5. SOLUTIONS (الوحدة 4)
-- ============================================================

CREATE TABLE solution_catalog (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(40) NOT NULL UNIQUE,    -- rainwater, valleys, pastures...
    name_ar         VARCHAR(150) NOT NULL,
    name_en         VARCHAR(150) NOT NULL,
    name_fr         VARCHAR(150),
    description_ar  TEXT,
    description_en  TEXT,
    category        VARCHAR(40),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE project_solutions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    solution_id     UUID NOT NULL REFERENCES solution_catalog(id),
    selected        BOOLEAN NOT NULL DEFAULT FALSE,
    water_saved_m3_year    DOUBLE PRECISION,
    cost_impl_usd          DOUBLE PRECISION,
    cost_maint_usd_year    DOUBLE PRECISION,
    benefit_usd_year       DOUBLE PRECISION,
    env_score              DOUBLE PRECISION,       -- 0–10
    health_score           DOUBLE PRECISION,
    equity_score           DOUBLE PRECISION,
    total_score            DOUBLE PRECISION,
    notes                  TEXT,
    sort_order             SMALLINT DEFAULT 0,
    UNIQUE (project_id, solution_id)
);

CREATE INDEX idx_proj_sol_project ON project_solutions(project_id);

-- ============================================================
-- 6. COSTING & FINANCING (الوحدة 5)
-- ============================================================

CREATE TABLE cost_estimates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    analysis_id     UUID REFERENCES risk_analyses(id),
    total_impl_usd  DOUBLE PRECISION,
    total_maint_usd_year DOUBLE PRECISION,
    total_benefit_usd_year DOUBLE PRECISION,
    cost_benefit_ratio DOUBLE PRECISION,
    phase1_funding_usd DOUBLE PRECISION,
    funding_gap_usd DOUBLE PRECISION,
    funding_sources JSONB,                         -- ["GCF", "IsDB", ...]
    currency        CHAR(3) DEFAULT 'USD',
    assumptions_json JSONB,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investment_proposals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_estimate_id UUID REFERENCES cost_estimates(id),
    title           VARCHAR(250) NOT NULL,
    summary         TEXT,
    content_json    JSONB,                         -- هيكل المقترح
    status          VARCHAR(20) DEFAULT 'draft'
                    CHECK (status IN ('draft', 'review', 'submitted', 'approved')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. REPORTS (الوحدة 6)
-- ============================================================

CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(250) NOT NULL,
    audience        VARCHAR(30) NOT NULL
                    CHECK (audience IN ('planners', 'municipalities', 'funders', 'full')),
    language        CHAR(2) NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'fr')),
    detail_level    VARCHAR(20) NOT NULL DEFAULT 'standard'
                    CHECK (detail_level IN ('summary', 'standard', 'full')),
    include_sections JSONB NOT NULL DEFAULT '["risks","maps","solutions","costs","recommendations"]',
    content_json    JSONB,
    file_path       TEXT,                          -- PDF / DOCX المُصدَّر
    file_format     VARCHAR(10),
    status          VARCHAR(20) DEFAULT 'draft'
                    CHECK (status IN ('draft', 'generating', 'ready', 'failed')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_project ON reports(project_id);

-- ============================================================
-- 8. AUDIT & ACTIVITY
-- ============================================================

CREATE TABLE activity_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    action          VARCHAR(60) NOT NULL,           -- login, upload_dataset, run_analysis...
    entity_type     VARCHAR(40),
    entity_id       UUID,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_project ON activity_log(project_id, created_at DESC);

-- ============================================================
-- 9. SEED: Solution catalog
-- ============================================================

INSERT INTO solution_catalog (code, name_ar, name_en, name_fr, category) VALUES
('rainwater',  'حصاد مياه الأمطار', 'Rainwater harvesting', 'Collecte des eaux de pluie', 'water'),
('valleys',    'استعادة الأودية',   'Valley restoration',   'Restauration des oueds', 'ecosystem'),
('pastures',   'تأهيل المراعي',    'Pasture rehabilitation','Réhabilitation des parcours', 'land'),
('agroforest', 'الزراعة الحرجية',  'Agroforestry',         'Agroforesterie', 'land'),
('irrigation', 'تحسين كفاءة الري', 'Irrigation efficiency', 'Efficacité de l''irrigation', 'water');

-- ============================================================
-- 10. HELPER: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_datasets_updated BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cost_updated BEFORE UPDATE ON cost_estimates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON investment_proposals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
