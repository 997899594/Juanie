-- =====================================================
-- 2025年前沿DevOps平台数据库设计
-- 支持AI-Native、Platform Engineering、FinOps等现代化功能
-- =====================================================

-- =====================================================
-- 1. 核心身份认证与用户管理 (Identity & Access Management)
-- =====================================================

-- 用户表 (增强版)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    company TEXT,
    website TEXT,
    
    -- 开发者体验相关
    preferred_language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    theme_preference TEXT DEFAULT 'system', -- light/dark/system
    notification_preferences JSONB DEFAULT '{}',
    
    -- AI助手个性化
    ai_assistant_config JSONB DEFAULT '{}',
    coding_style_preferences JSONB DEFAULT '{}',
    
    -- 安全相关
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    security_keys JSONB DEFAULT '[]',
    last_security_audit TIMESTAMP,
    
    -- 审计字段
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    login_count INTEGER DEFAULT 0
);

-- OAuth账户表 (支持GitHub/GitLab等)
CREATE TABLE oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'github', 'gitlab', 'google', 'microsoft'
    provider_id TEXT NOT NULL,
    provider_username TEXT,
    provider_email TEXT,
    
    -- OAuth令牌
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    scope TEXT,
    
    -- 提供商特定数据
    provider_data JSONB DEFAULT '{}',
    
    -- 权限和能力
    permissions JSONB DEFAULT '[]',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(provider, provider_id)
);

-- 会话管理 (增强版)
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- 会话信息
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    location JSONB, -- 地理位置信息
    
    -- 安全相关
    is_trusted_device BOOLEAN DEFAULT FALSE,
    risk_score DECIMAL(3,2) DEFAULT 0.0, -- AI计算的风险评分
    
    -- 时间相关
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- API密钥管理
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- 显示用的前缀
    
    -- 权限控制
    scopes JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    allowed_ips JSONB DEFAULT '[]',
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. AI-Native DevOps 核心
-- =====================================================

-- AI助手配置
CREATE TABLE ai_assistants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER, -- 后面定义
    
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'code_review', 'security_scan', 'cost_optimizer', 'deployment_advisor'
    model_provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'local'
    model_name TEXT NOT NULL,
    
    -- AI配置
    system_prompt TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4000,
    custom_instructions JSONB DEFAULT '{}',
    
    -- 能力和权限
    capabilities JSONB DEFAULT '[]',
    permissions JSONB DEFAULT '[]',
    
    -- 性能指标
    accuracy_score DECIMAL(3,2),
    user_satisfaction DECIMAL(3,2),
    usage_stats JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI生成的建议和推荐
CREATE TABLE ai_recommendations (
    id SERIAL PRIMARY KEY,
    assistant_id INTEGER REFERENCES ai_assistants(id),
    context_type TEXT NOT NULL, -- 'code', 'security', 'performance', 'cost'
    context_id INTEGER NOT NULL, -- 关联的具体对象ID
    
    -- 推荐内容
    title TEXT NOT NULL,
    description TEXT,
    recommendation_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- 分类和标签
    category TEXT,
    tags JSONB DEFAULT '[]',
    
    -- 用户反馈
    user_feedback TEXT, -- 'accepted', 'rejected', 'modified'
    feedback_reason TEXT,
    applied_at TIMESTAMP,
    
    -- 影响评估
    estimated_impact JSONB DEFAULT '{}', -- 成本节省、性能提升等
    actual_impact JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- 代码分析结果
CREATE TABLE code_analysis_results (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER, -- 后面定义
    commit_hash TEXT NOT NULL,
    branch TEXT,
    
    -- 分析配置
    analyzer_type TEXT NOT NULL, -- 'security', 'quality', 'performance', 'ai_review'
    analyzer_version TEXT,
    
    -- 分析结果
    overall_score DECIMAL(3,2),
    issues_found INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    security_vulnerabilities INTEGER DEFAULT 0,
    
    -- 详细结果
    findings JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',
    
    -- AI增强分析
    ai_summary TEXT,
    ai_priority_recommendations JSONB DEFAULT '[]',
    
    -- 趋势分析
    improvement_trend JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. Platform Engineering & Developer Experience
-- =====================================================

-- 组织和团队
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    
    -- 组织设置
    settings JSONB DEFAULT '{}',
    billing_info JSONB DEFAULT '{}',
    
    -- 订阅和限制
    plan_type TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    usage_limits JSONB DEFAULT '{}',
    current_usage JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    
    -- 团队配置
    default_permissions JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

CREATE TABLE team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    
    -- 专业技能标签
    skills JSONB DEFAULT '[]',
    expertise_areas JSONB DEFAULT '[]',
    
    joined_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(team_id, user_id)
);

-- 项目管理 (现代化版本)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id),
    
    -- 基本信息
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    logo_url TEXT,
    
    -- 项目分类
    project_type TEXT DEFAULT 'application', -- 'application', 'library', 'infrastructure', 'data'
    technology_stack JSONB DEFAULT '[]',
    programming_languages JSONB DEFAULT '[]',
    
    -- 业务信息
    business_criticality TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    compliance_requirements JSONB DEFAULT '[]',
    
    -- 状态管理
    status TEXT DEFAULT 'active', -- 'active', 'maintenance', 'deprecated', 'archived'
    health_status TEXT DEFAULT 'unknown', -- 'healthy', 'warning', 'critical', 'unknown'
    
    -- 开发者体验
    onboarding_guide TEXT,
    documentation_url TEXT,
    getting_started_template TEXT,
    
    -- AI和自动化配置
    ai_assistant_enabled BOOLEAN DEFAULT TRUE,
    auto_security_scanning BOOLEAN DEFAULT TRUE,
    auto_dependency_updates BOOLEAN DEFAULT FALSE,
    
    -- 可观测性配置
    monitoring_config JSONB DEFAULT '{}',
    alerting_config JSONB DEFAULT '{}',
    
    -- 成本和资源
    cost_center TEXT,
    budget_limit DECIMAL(10,2),
    resource_quotas JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

-- 服务目录 (Service Catalog)
CREATE TABLE service_catalog (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 服务信息
    service_name TEXT NOT NULL,
    service_type TEXT NOT NULL, -- 'api', 'web', 'worker', 'database', 'cache'
    version TEXT,
    
    -- API规范
    api_spec_url TEXT,
    api_spec_type TEXT, -- 'openapi', 'graphql', 'grpc'
    api_spec JSONB,
    
    -- 依赖关系
    dependencies JSONB DEFAULT '[]',
    dependents JSONB DEFAULT '[]',
    
    -- 运维信息
    owner_team_id INTEGER REFERENCES teams(id),
    on_call_contacts JSONB DEFAULT '[]',
    runbook_url TEXT,
    
    -- SLA和指标
    sla_targets JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    
    -- 成本信息
    estimated_monthly_cost DECIMAL(10,2),
    actual_monthly_cost DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 黄金路径模板 (Golden Path Templates)
CREATE TABLE golden_path_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'web_app', 'api_service', 'data_pipeline', 'ml_model'
    
    -- 技术栈
    technology_stack JSONB NOT NULL,
    framework_version TEXT,
    
    -- 模板内容
    template_files JSONB NOT NULL, -- 文件结构和内容
    configuration JSONB DEFAULT '{}',
    
    -- 最佳实践
    best_practices JSONB DEFAULT '[]',
    security_guidelines JSONB DEFAULT '[]',
    performance_guidelines JSONB DEFAULT '[]',
    
    -- 自动化配置
    ci_cd_template JSONB DEFAULT '{}',
    monitoring_template JSONB DEFAULT '{}',
    security_template JSONB DEFAULT '{}',
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2),
    user_rating DECIMAL(3,2),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 4. 代码仓库和版本控制
-- =====================================================

-- 代码仓库 (增强版)
CREATE TABLE repositories (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 仓库信息
    provider TEXT NOT NULL, -- 'github', 'gitlab', 'bitbucket'
    provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    clone_url TEXT NOT NULL,
    web_url TEXT NOT NULL,
    
    -- 分支管理
    default_branch TEXT DEFAULT 'main',
    protected_branches JSONB DEFAULT '[]',
    branch_protection_rules JSONB DEFAULT '{}',
    
    -- 仓库配置
    is_private BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    
    -- 自动化配置
    auto_merge_enabled BOOLEAN DEFAULT FALSE,
    auto_delete_branches BOOLEAN DEFAULT TRUE,
    require_code_review BOOLEAN DEFAULT TRUE,
    require_status_checks BOOLEAN DEFAULT TRUE,
    
    -- 同步状态
    last_sync_at TIMESTAMP,
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'failed'
    sync_error TEXT,
    
    -- 统计信息
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    issues_count INTEGER DEFAULT 0,
    pull_requests_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(provider, provider_id)
);

-- 提交分析 (AI增强)
CREATE TABLE commit_analysis (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    commit_hash TEXT NOT NULL,
    
    -- 提交信息
    author_email TEXT,
    author_name TEXT,
    commit_message TEXT,
    commit_date TIMESTAMP,
    
    -- AI分析结果
    sentiment_score DECIMAL(3,2), -- 提交消息情感分析
    complexity_score DECIMAL(3,2), -- 代码复杂度
    risk_score DECIMAL(3,2), -- 风险评估
    
    -- 变更分析
    files_changed INTEGER,
    lines_added INTEGER,
    lines_deleted INTEGER,
    change_type TEXT, -- 'feature', 'bugfix', 'refactor', 'docs', 'test'
    
    -- 质量指标
    test_coverage_change DECIMAL(5,2),
    performance_impact JSONB DEFAULT '{}',
    security_impact JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(repository_id, commit_hash)
);

-- =====================================================
-- 5. CI/CD 和部署管理
-- =====================================================

-- 流水线定义
CREATE TABLE pipelines (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    repository_id INTEGER REFERENCES repositories(id),
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- 流水线配置
    config_source TEXT DEFAULT 'repository', -- 'repository', 'ui', 'api'
    config_path TEXT DEFAULT '.github/workflows',
    pipeline_config JSONB NOT NULL,
    
    -- 触发条件
    triggers JSONB DEFAULT '{}', -- push, pr, schedule, manual
    trigger_branches JSONB DEFAULT '[]',
    trigger_paths JSONB DEFAULT '[]',
    
    -- AI优化
    ai_optimization_enabled BOOLEAN DEFAULT TRUE,
    auto_parallelization BOOLEAN DEFAULT TRUE,
    smart_caching BOOLEAN DEFAULT TRUE,
    
    -- 状态和统计
    is_active BOOLEAN DEFAULT TRUE,
    success_rate DECIMAL(3,2),
    average_duration INTEGER, -- 秒
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 流水线执行记录
CREATE TABLE pipeline_runs (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
    
    -- 触发信息
    trigger_type TEXT NOT NULL, -- 'push', 'pull_request', 'schedule', 'manual'
    trigger_user_id INTEGER REFERENCES users(id),
    trigger_data JSONB DEFAULT '{}',
    
    -- 执行信息
    run_number INTEGER NOT NULL,
    commit_hash TEXT,
    branch TEXT,
    
    -- 状态管理
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'cancelled'
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    duration INTEGER, -- 秒
    
    -- 资源使用
    compute_units_used DECIMAL(10,2),
    estimated_cost DECIMAL(10,2),
    carbon_footprint DECIMAL(10,4), -- kg CO2
    
    -- AI分析
    failure_prediction_score DECIMAL(3,2),
    optimization_suggestions JSONB DEFAULT '[]',
    
    -- 结果数据
    artifacts JSONB DEFAULT '[]',
    test_results JSONB DEFAULT '{}',
    security_scan_results JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 环境管理 (现代化)
CREATE TABLE environments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- 'development', 'staging', 'production'
    display_name TEXT,
    description TEXT,
    
    -- 环境类型和配置
    environment_type TEXT NOT NULL, -- 'development', 'testing', 'staging', 'production'
    cloud_provider TEXT, -- 'aws', 'gcp', 'azure', 'local'
    region TEXT,
    
    -- 基础设施配置
    infrastructure_config JSONB DEFAULT '{}',
    compute_resources JSONB DEFAULT '{}',
    network_config JSONB DEFAULT '{}',
    
    -- 环境状态
    status TEXT DEFAULT 'unknown', -- 'healthy', 'degraded', 'down', 'unknown'
    health_check_url TEXT,
    last_health_check TIMESTAMP,
    
    -- 访问控制
    access_restrictions JSONB DEFAULT '{}',
    allowed_users JSONB DEFAULT '[]',
    allowed_teams JSONB DEFAULT '[]',
    
    -- 成本和资源限制
    resource_quotas JSONB DEFAULT '{}',
    cost_budget DECIMAL(10,2),
    auto_scaling_config JSONB DEFAULT '{}',
    
    -- 合规和安全
    compliance_requirements JSONB DEFAULT '[]',
    security_policies JSONB DEFAULT '[]',
    data_classification TEXT DEFAULT 'internal',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, name)
);

-- 部署记录 (AI增强)
CREATE TABLE deployments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    pipeline_run_id INTEGER REFERENCES pipeline_runs(id),
    
    -- 部署信息
    version TEXT,
    commit_hash TEXT,
    commit_message TEXT,
    branch TEXT,
    
    -- 部署策略
    deployment_strategy TEXT DEFAULT 'rolling', -- 'blue_green', 'canary', 'rolling', 'recreate'
    rollback_strategy TEXT DEFAULT 'automatic',
    
    -- 状态管理
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'rolled_back'
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    
    -- 用户信息
    deployed_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    
    -- AI预测和分析
    success_probability DECIMAL(3,2), -- AI预测的成功概率
    risk_assessment JSONB DEFAULT '{}',
    performance_prediction JSONB DEFAULT '{}',
    
    -- 实际结果
    performance_metrics JSONB DEFAULT '{}',
    error_rate DECIMAL(5,4),
    response_time_p95 INTEGER, -- 毫秒
    
    -- 成本和资源
    deployment_cost DECIMAL(10,2),
    resource_usage JSONB DEFAULT '{}',
    carbon_footprint DECIMAL(10,4),
    
    -- 回滚信息
    rollback_reason TEXT,
    rolled_back_at TIMESTAMP,
    rollback_duration INTEGER, -- 秒
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 6. 可观测性 3.0 (AI驱动)
-- =====================================================

-- 智能监控配置
CREATE TABLE monitoring_configs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    environment_id INTEGER REFERENCES environments(id),
    service_name TEXT,
    
    -- 监控类型
    monitor_type TEXT NOT NULL, -- 'uptime', 'performance', 'error_rate', 'custom'
    
    -- 配置参数
    check_interval INTEGER DEFAULT 60, -- 秒
    timeout INTEGER DEFAULT 30, -- 秒
    retry_count INTEGER DEFAULT 3,
    
    -- 检查配置
    check_config JSONB NOT NULL,
    
    -- AI增强
    ai_anomaly_detection BOOLEAN DEFAULT TRUE,
    baseline_learning_enabled BOOLEAN DEFAULT TRUE,
    auto_threshold_adjustment BOOLEAN DEFAULT TRUE,
    
    -- 阈值配置
    warning_threshold JSONB DEFAULT '{}',
    critical_threshold JSONB DEFAULT '{}',
    
    -- 通知配置
    notification_channels JSONB DEFAULT '[]',
    escalation_policy JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 智能告警
CREATE TABLE intelligent_alerts (
    id SERIAL PRIMARY KEY,
    monitor_config_id INTEGER REFERENCES monitoring_configs(id),
    
    -- 告警信息
    alert_type TEXT NOT NULL, -- 'anomaly', 'threshold', 'prediction', 'correlation'
    severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
    title TEXT NOT NULL,
    description TEXT,
    
    -- AI分析
    ai_confidence DECIMAL(3,2) NOT NULL,
    root_cause_analysis JSONB DEFAULT '{}',
    correlation_analysis JSONB DEFAULT '[]',
    impact_assessment JSONB DEFAULT '{}',
    
    -- 预测性告警
    prediction_horizon INTEGER, -- 分钟
    probability_score DECIMAL(3,2),
    
    -- 自动修复
    auto_remediation_available BOOLEAN DEFAULT FALSE,
    remediation_actions JSONB DEFAULT '[]',
    auto_remediation_applied BOOLEAN DEFAULT FALSE,
    
    -- 状态管理
    status TEXT DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'suppressed'
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    -- 通知状态
    notifications_sent JSONB DEFAULT '[]',
    escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 性能指标 (时序数据)
CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    environment_id INTEGER REFERENCES environments(id),
    service_name TEXT,
    
    -- 指标信息
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram', 'summary'
    
    -- 数值数据
    value DECIMAL(15,6) NOT NULL,
    unit TEXT,
    
    -- 标签和维度
    labels JSONB DEFAULT '{}',
    dimensions JSONB DEFAULT '{}',
    
    -- 时间戳
    timestamp TIMESTAMP NOT NULL,
    
    -- AI分析标记
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_score DECIMAL(3,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建时序数据的分区表
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics (timestamp DESC);
CREATE INDEX idx_performance_metrics_project_service ON performance_metrics (project_id, service_name, timestamp DESC);

-- =====================================================
-- 7. 安全和合规 (Zero Trust)
-- =====================================================

-- 安全策略
CREATE TABLE security_policies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    project_id INTEGER REFERENCES projects(id),
    
    policy_name TEXT NOT NULL,
    policy_type TEXT NOT NULL, -- 'access_control', 'data_protection', 'network', 'compliance'
    
    -- 策略内容
    policy_rules JSONB NOT NULL,
    enforcement_level TEXT DEFAULT 'warn', -- 'block', 'warn', 'log'
    
    -- 适用范围
    applies_to JSONB DEFAULT '{}', -- 环境、服务、用户组等
    exceptions JSONB DEFAULT '[]',
    
    -- AI增强
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3,2),
    auto_update_enabled BOOLEAN DEFAULT FALSE,
    
    -- 合规框架
    compliance_frameworks JSONB DEFAULT '[]', -- 'SOC2', 'GDPR', 'HIPAA', 'PCI-DSS'
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 漏洞扫描结果
CREATE TABLE vulnerability_scans (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    repository_id INTEGER REFERENCES repositories(id),
    
    -- 扫描信息
    scan_type TEXT NOT NULL, -- 'sast', 'dast', 'dependency', 'container', 'infrastructure'
    scanner_name TEXT NOT NULL,
    scanner_version TEXT,
    
    -- 扫描目标
    target_type TEXT NOT NULL, -- 'code', 'container', 'deployment', 'infrastructure'
    target_identifier TEXT NOT NULL,
    
    -- 扫描结果
    total_vulnerabilities INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    
    -- 详细发现
    findings JSONB DEFAULT '[]',
    
    -- AI增强分析
    ai_risk_assessment JSONB DEFAULT '{}',
    ai_remediation_suggestions JSONB DEFAULT '[]',
    false_positive_predictions JSONB DEFAULT '[]',
    
    -- 修复状态
    remediation_status JSONB DEFAULT '{}',
    
    scan_started_at TIMESTAMP,
    scan_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 零信任访问策略
CREATE TABLE zero_trust_policies (
    id SERIAL PRIMARY KEY,
    resource_type TEXT NOT NULL, -- 'project', 'environment', 'service', 'data'
    resource_id INTEGER NOT NULL,
    
    -- 访问条件
    user_conditions JSONB DEFAULT '{}', -- 用户属性要求
    device_conditions JSONB DEFAULT '{}', -- 设备要求
    network_conditions JSONB DEFAULT '{}', -- 网络位置要求
    time_conditions JSONB DEFAULT '{}', -- 时间限制
    
    -- 持续验证
    continuous_verification BOOLEAN DEFAULT TRUE,
    verification_interval INTEGER DEFAULT 3600, -- 秒
    risk_threshold DECIMAL(3,2) DEFAULT 0.7,
    
    -- 自适应访问
    adaptive_access BOOLEAN DEFAULT TRUE,
    ai_risk_scoring BOOLEAN DEFAULT TRUE,
    
    -- 审计要求
    audit_all_access BOOLEAN DEFAULT TRUE,
    log_failed_attempts BOOLEAN DEFAULT TRUE,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 8. FinOps 和可持续性
-- =====================================================

-- 成本跟踪
CREATE TABLE cost_tracking (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    project_id INTEGER REFERENCES projects(id),
    environment_id INTEGER REFERENCES environments(id),
    
    -- 成本信息
    resource_type TEXT NOT NULL, -- 'compute', 'storage', 'network', 'database', 'ai_services'
    resource_identifier TEXT,
    
    -- 成本数据
    cost_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- 使用量数据
    usage_quantity DECIMAL(15,6),
    usage_unit TEXT,
    
    -- 标签和分类
    cost_center TEXT,
    business_unit TEXT,
    tags JSONB DEFAULT '{}',
    
    -- AI优化建议
    optimization_opportunities JSONB DEFAULT '[]',
    potential_savings DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 可持续性指标
CREATE TABLE sustainability_metrics (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    environment_id INTEGER REFERENCES environments(id),
    deployment_id INTEGER REFERENCES deployments(id),
    
    -- 能源消耗
    energy_consumption_kwh DECIMAL(10,4), -- 千瓦时
    renewable_energy_percentage DECIMAL(5,2), -- 可再生能源占比
    
    -- 碳排放
    carbon_emissions_kg DECIMAL(10,4), -- 公斤CO2当量
    carbon_intensity DECIMAL(10,6), -- 每单位计算的碳排放
    
    -- 效率指标
    compute_efficiency_score DECIMAL(3,2), -- 计算效率评分
    resource_utilization DECIMAL(5,2), -- 资源利用率
    
    -- 优化建议
    green_optimization_suggestions JSONB DEFAULT '[]',
    estimated_emission_reduction DECIMAL(10,4),
    
    -- 认证和标准
    green_certifications JSONB DEFAULT '[]',
    sustainability_score DECIMAL(3,2),
    
    measurement_period_start TIMESTAMP NOT NULL,
    measurement_period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 资源优化建议
CREATE TABLE resource_optimization (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    environment_id INTEGER REFERENCES environments(id),
    
    -- 优化类型
    optimization_type TEXT NOT NULL, -- 'rightsizing', 'scheduling', 'auto_scaling', 'spot_instances'
    
    -- 当前状态
    current_configuration JSONB NOT NULL,
    current_cost DECIMAL(10,2),
    current_performance JSONB DEFAULT '{}',
    
    -- 推荐配置
    recommended_configuration JSONB NOT NULL,
    estimated_cost DECIMAL(10,2),
    estimated_performance JSONB DEFAULT '{}',
    
    -- 节省预估
    cost_savings DECIMAL(10,2),
    performance_impact JSONB DEFAULT '{}',
    risk_assessment JSONB DEFAULT '{}',
    
    -- AI分析
    ai_confidence DECIMAL(3,2) NOT NULL,
    ai_reasoning TEXT,
    
    -- 实施状态
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'implemented', 'rejected'
    implemented_at TIMESTAMP,
    actual_savings DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- =====================================================
-- 9. 开发者体验和协作
-- =====================================================

-- 开发者体验指标
CREATE TABLE developer_experience_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    
    -- 行为数据
    action_type TEXT NOT NULL, -- 'deploy', 'build', 'test', 'debug', 'review'
    action_context JSONB DEFAULT '{}',
    
    -- 时间指标
    start_time TIMESTAMP NOT NULL,
    completion_time TIMESTAMP,
    duration_seconds INTEGER,
    
    -- 成功指标
    success BOOLEAN,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- 满意度
    user_satisfaction INTEGER, -- 1-5 评分
    feedback_text TEXT,
    
    -- 工具和环境
    tool_used TEXT,
    environment_context JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 知识库和文档
CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    project_id INTEGER REFERENCES projects(id),
    
    -- 文档信息
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'markdown', -- 'markdown', 'html', 'plain_text'
    
    -- 分类和标签
    category TEXT, -- 'runbook', 'api_docs', 'troubleshooting', 'best_practices'
    tags JSONB DEFAULT '[]',
    
    -- AI增强
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_summary TEXT,
    auto_update_enabled BOOLEAN DEFAULT FALSE,
    
    -- 使用统计
    view_count INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    unhelpful_votes INTEGER DEFAULT 0,
    
    -- 维护信息
    author_id INTEGER REFERENCES users(id),
    last_updated_by INTEGER REFERENCES users(id),
    review_required BOOLEAN DEFAULT FALSE,
    next_review_date DATE,
    
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 10. 高级功能和扩展
-- =====================================================

-- 特性标志管理
CREATE TABLE feature_flags (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    
    -- 标志信息
    flag_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- 标志类型
    flag_type TEXT DEFAULT 'boolean', -- 'boolean', 'string', 'number', 'json'
    default_value JSONB,
    
    -- 目标规则
    targeting_rules JSONB DEFAULT '[]',
    rollout_percentage DECIMAL(5,2) DEFAULT 0.0,
    
    -- 环境配置
    environment_overrides JSONB DEFAULT '{}',
    
    -- AI优化
    ai_optimization_enabled BOOLEAN DEFAULT TRUE,
    performance_impact_tracking BOOLEAN DEFAULT TRUE,
    auto_rollback_conditions JSONB DEFAULT '{}',
    
    -- 状态管理
    is_active BOOLEAN DEFAULT TRUE,
    archived_at TIMESTAMP,
    
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, flag_key)
);

-- 实验和A/B测试
CREATE TABLE experiments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    feature_flag_id INTEGER REFERENCES feature_flags(id),
    
    -- 实验信息
    name TEXT NOT NULL,
    hypothesis TEXT,
    success_metrics JSONB DEFAULT '[]',
    
    -- 实验配置
    traffic_allocation DECIMAL(5,2) DEFAULT 50.0, -- 百分比
    control_variant JSONB NOT NULL,
    test_variants JSONB DEFAULT '[]',
    
    -- 时间配置
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    duration_days INTEGER,
    
    -- 统计配置
    minimum_sample_size INTEGER,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    statistical_power DECIMAL(3,2) DEFAULT 0.80,
    
    -- AI分析
    ai_analysis_enabled BOOLEAN DEFAULT TRUE,
    real_time_monitoring BOOLEAN DEFAULT TRUE,
    auto_stop_conditions JSONB DEFAULT '{}',
    
    -- 结果
    results JSONB DEFAULT '{}',
    statistical_significance BOOLEAN,
    winner_variant TEXT,
    
    status TEXT DEFAULT 'draft', -- 'draft', 'running', 'completed', 'stopped'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 事件和审计日志
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    
    -- 事件信息
    event_type TEXT NOT NULL, -- 'user_action', 'system_event', 'security_event', 'ai_action'
    event_category TEXT NOT NULL,
    event_name TEXT NOT NULL,
    
    -- 主体信息
    actor_type TEXT NOT NULL, -- 'user', 'system', 'ai_assistant', 'api_key'
    actor_id TEXT NOT NULL,
    actor_details JSONB DEFAULT '{}',
    
    -- 目标信息
    target_type TEXT, -- 'project', 'deployment', 'user', 'configuration'
    target_id TEXT,
    target_details JSONB DEFAULT '{}',
    
    -- 事件详情
    event_data JSONB DEFAULT '{}',
    changes JSONB DEFAULT '{}', -- before/after 状态
    
    -- 上下文信息
    session_id TEXT,
    request_id TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- 安全相关
    risk_score DECIMAL(3,2),
    security_flags JSONB DEFAULT '[]',
    
    -- 合规相关
    compliance_relevant BOOLEAN DEFAULT FALSE,
    retention_period INTEGER, -- 天数
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建审计日志的索引
CREATE INDEX idx_audit_logs_event_type_time ON audit_logs (event_type, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_type, actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id, created_at DESC);

-- =====================================================
-- 创建必要的索引和约束
-- =====================================================

-- 性能优化索引
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_oauth_accounts_provider_user ON oauth_accounts (provider, user_id);
CREATE INDEX idx_projects_org_status ON projects (organization_id, status);
CREATE INDEX idx_deployments_project_env_time ON deployments (project_id, environment_id, created_at DESC);
CREATE INDEX idx_pipeline_runs_pipeline_time ON pipeline_runs (pipeline_id, created_at DESC);
CREATE INDEX idx_cost_tracking_project_period ON cost_tracking (project_id, billing_period_start, billing_period_end);

-- 全文搜索索引
CREATE INDEX idx_knowledge_base_search ON knowledge_base USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_projects_search ON projects USING gin(to_tsvector('english', name || ' ' || display_name || ' ' || COALESCE(description, '')));

-- =====================================================
-- 创建视图和函数
-- =====================================================

-- 项目健康状况视图
CREATE VIEW project_health_dashboard AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.health_status,
    COUNT(DISTINCT d.id) as total_deployments,
    COUNT(DISTINCT CASE WHEN d.status = 'success' THEN d.id END) as successful_deployments,
    AVG(CASE WHEN d.status = 'success' THEN EXTRACT(EPOCH FROM (d.finished_at - d.started_at)) END) as avg_deployment_time,
    COUNT(DISTINCT va.id) as open_vulnerabilities,
    COUNT(DISTINCT CASE WHEN va.critical_count > 0 THEN va.id END) as critical_vulnerabilities,
    SUM(ct.cost_amount) as monthly_cost
FROM projects p
LEFT JOIN deployments d ON p.id = d.project_id AND d.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN vulnerability_scans va ON p.id = va.project_id AND va.created_at >= NOW() - INTERVAL '7 days'
LEFT JOIN cost_tracking ct ON p.id = ct.project_id AND ct.billing_period_start >= DATE_TRUNC('month', NOW())
WHERE p.status = 'active'
GROUP BY p.id, p.name, p.status, p.health_status;

-- AI推荐优先级函数
CREATE OR REPLACE FUNCTION calculate_recommendation_priority(
    confidence_score DECIMAL,
    estimated_impact JSONB,
    urgency_factors JSONB
) RETURNS TEXT AS $$
BEGIN
    -- 基于AI置信度、预估影响和紧急因素计算优先级
    IF confidence_score >= 0.9 AND (estimated_impact->>'cost_savings')::DECIMAL > 1000 THEN
        RETURN 'critical';
    ELSIF confidence_score >= 0.7 AND (estimated_impact->>'performance_improvement')::DECIMAL > 0.2 THEN
        RETURN 'high';
    ELSIF confidence_score >= 0.5 THEN
        RETURN 'medium';
    ELSE
        RETURN 'low';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入默认的AI助手类型
INSERT INTO ai_assistants (user_id, name, type, model_provider, model_name, system_prompt, capabilities) VALUES
(NULL, 'Code Review Assistant', 'code_review', 'openai', 'gpt-4', 'You are an expert code reviewer focusing on security, performance, and best practices.', '["code_analysis", "security_scan", "performance_review"]'),
(NULL, 'Security Scanner', 'security_scan', 'openai', 'gpt-4', 'You are a security expert identifying vulnerabilities and suggesting fixes.', '["vulnerability_detection", "security_recommendations", "compliance_check"]'),
(NULL, 'Cost Optimizer', 'cost_optimizer', 'openai', 'gpt-4', 'You are a FinOps expert optimizing cloud costs and resource usage.', '["cost_analysis", "resource_optimization", "sustainability_recommendations"]'),
(NULL, 'Deployment Advisor', 'deployment_advisor', 'openai', 'gpt-4', 'You are a DevOps expert providing deployment strategies and risk assessments.', '["deployment_strategy", "risk_assessment", "performance_prediction"]');

-- 插入默认的黄金路径模板
INSERT INTO golden_path_templates (organization_id, name, description, category, technology_stack, template_files, best_practices) VALUES
(NULL, 'Modern Web Application', 'Full-stack web application with React, Node.js, and PostgreSQL', 'web_app', 
 '["react", "nodejs", "postgresql", "docker", "kubernetes"]',
 '{"frontend": {"framework": "react", "typescript": true}, "backend": {"framework": "express", "database": "postgresql"}, "infrastructure": {"containerization": "docker", "orchestration": "kubernetes"}}',
 '["Use TypeScript for type safety", "Implement comprehensive testing", "Set up CI/CD pipeline", "Enable monitoring and logging", "Follow security best practices"]');

COMMENT ON DATABASE postgres IS '2025年前沿DevOps平台数据库 - 支持AI-Native、Platform Engineering、FinOps等现代化功能';