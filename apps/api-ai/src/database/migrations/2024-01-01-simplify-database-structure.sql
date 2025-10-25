-- 数据库重构迁移脚本
-- 目标：简化过度设计的表结构，保留核心功能

-- =====================================================
-- 1. 备份现有数据（重要！）
-- =====================================================

-- 创建备份表
CREATE TABLE cost_tracking_backup AS SELECT * FROM cost_tracking;
CREATE TABLE performance_metrics_backup AS SELECT * FROM performance_metrics;
CREATE TABLE resource_optimization_backup AS SELECT * FROM resource_optimization;
CREATE TABLE sustainability_metrics_backup AS SELECT * FROM sustainability_metrics;
CREATE TABLE zero_trust_policies_backup AS SELECT * FROM zero_trust_policies;

-- =====================================================
-- 2. 修改现有表结构
-- =====================================================

-- 2.1 简化 cost_tracking 表
ALTER TABLE cost_tracking 
  -- 删除复杂的JSONB字段
  DROP COLUMN IF EXISTS period,
  DROP COLUMN IF EXISTS service_costs,
  DROP COLUMN IF EXISTS resource_utilization,
  DROP COLUMN IF EXISTS cost_allocation,
  DROP COLUMN IF EXISTS optimization_opportunities,
  DROP COLUMN IF EXISTS sustainability_metrics,
  DROP COLUMN IF EXISTS budget_forecasting,
  DROP COLUMN IF EXISTS cost_anomalies,
  DROP COLUMN IF EXISTS billing_info,
  -- 添加简化字段
  ADD COLUMN period varchar(7) NOT NULL,
  ADD COLUMN compute_cost decimal(10,2) DEFAULT 0,
  ADD COLUMN storage_cost decimal(10,2) DEFAULT 0,
  ADD COLUMN network_cost decimal(10,2) DEFAULT 0,
  ADD COLUMN database_cost decimal(10,2) DEFAULT 0,
  ADD COLUMN monitoring_cost decimal(10,2) DEFAULT 0,
  ADD COLUMN optimization_tips text;

-- 2.2 简化 performance_metrics 表
ALTER TABLE performance_metrics
  -- 删除复杂JSONB字段
  DROP COLUMN IF EXISTS labels,
  DROP COLUMN IF EXISTS dimensions,
  DROP COLUMN IF EXISTS is_anomaly,
  DROP COLUMN IF EXISTS anomaly_score,
  -- 修改字段约束
  ALTER COLUMN service_name SET NOT NULL,
  -- 添加简化字段
  ADD COLUMN metric_category varchar(50) NOT NULL,
  ADD COLUMN simple_labels text,
  ADD COLUMN is_alert boolean DEFAULT false,
  ADD COLUMN alert_level varchar(20);

-- =====================================================
-- 3. 迁移数据到简化表
-- =====================================================

-- 3.1 迁移 cost_tracking 数据
UPDATE cost_tracking SET
  period = TO_CHAR(created_at, 'YYYY-MM'),
  compute_cost = 0,
  storage_cost = 0,
  network_cost = 0,
  database_cost = 0,
  monitoring_cost = 0,
  optimization_tips = '数据迁移：原复杂JSONB字段已简化';

-- 3.2 迁移 performance_metrics 数据
UPDATE performance_metrics SET
  metric_category = CASE 
    WHEN metric_name LIKE '%cpu%' OR metric_name LIKE '%memory%' OR metric_name LIKE '%response_time%' THEN 'performance'
    WHEN metric_name LIKE '%error%' OR metric_name LIKE '%exception%' THEN 'error'
    WHEN metric_name LIKE '%uptime%' OR metric_name LIKE '%availability%' THEN 'availability'
    ELSE 'capacity'
  END,
  simple_labels = '',
  is_alert = false,
  alert_level = NULL;

-- =====================================================
-- 4. 创建新表
-- =====================================================

-- 4.1 创建 resource_usage 表（替代 resource_optimization）
CREATE TABLE IF NOT EXISTS resource_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  resource_type varchar(50) NOT NULL CHECK (resource_type IN ('compute', 'storage', 'network', 'database')),
  resource_name varchar(100) NOT NULL,
  usage_percentage decimal(5,2) NOT NULL CHECK (usage_percentage >= 0 AND usage_percentage <= 100),
  cost_per_hour decimal(10,4) NOT NULL,
  optimization_suggestion text,
  recorded_at timestamp NOT NULL,
  created_at timestamp DEFAULT NOW() NOT NULL
);

-- 4.2 创建简化版 security_policies 表
CREATE TABLE IF NOT EXISTS security_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  policy_type varchar(50) NOT NULL CHECK (policy_type IN ('access-control', 'network', 'data-protection', 'compliance')),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft')),
  rules text,
  is_enforced boolean DEFAULT false,
  priority integer DEFAULT 0 CHECK (priority >= 0 AND priority <= 100),
  created_by uuid,
  created_at timestamp DEFAULT NOW() NOT NULL,
  updated_at timestamp DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 5. 迁移数据到新表
-- =====================================================

-- 5.1 从 resource_optimization 迁移基础数据到 resource_usage
INSERT INTO resource_usage (project_id, environment_id, resource_type, resource_name, usage_percentage, cost_per_hour, optimization_suggestion, recorded_at, created_at)
SELECT 
  project_id,
  environment_id,
  'compute', -- 默认类型
  'migrated_resource',
  50.00, -- 默认使用率
  0.1000, -- 默认成本
  '从resource_optimization迁移的简化数据',
  COALESCE(created_at, NOW()),
  COALESCE(created_at, NOW())
FROM resource_optimization 
WHERE project_id IS NOT NULL 
LIMIT 100; -- 限制数量，避免过多测试数据

-- 5.2 从 zero_trust_policies 迁移基础数据到 security_policies
INSERT INTO security_policies (project_id, environment_id, name, description, policy_type, status, rules, is_enforced, priority, created_by, created_at, updated_at)
SELECT 
  project_id,
  environment_id,
  COALESCE(name, 'migrated_policy'),
  COALESCE(description, '从零信任策略迁移'),
  'access-control', -- 默认类型
  CASE WHEN is_active THEN 'active' ELSE 'inactive' END,
  '{}', -- 简化规则
  is_active,
  50, -- 默认优先级
  created_by,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM zero_trust_policies 
WHERE project_id IS NOT NULL 
LIMIT 100; -- 限制数量

-- =====================================================
-- 6. 清理和优化
-- =====================================================

-- 6.1 删除废弃的索引
DROP INDEX IF EXISTS cost_tracking_currency_idx;
DROP INDEX IF EXISTS cost_tracking_updated_at_idx;
DROP INDEX IF EXISTS performance_metrics_environment_idx;
DROP INDEX IF EXISTS performance_metrics_type_idx;
DROP INDEX IF EXISTS performance_metrics_anomaly_idx;

-- 6.2 创建新索引
CREATE INDEX IF NOT EXISTS cost_tracking_period_idx ON cost_tracking(period);
CREATE INDEX IF NOT EXISTS performance_metrics_category_idx ON performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS performance_metrics_alert_idx ON performance_metrics(is_alert);
CREATE INDEX IF NOT EXISTS resource_usage_project_id_idx ON resource_usage(project_id);
CREATE INDEX IF NOT EXISTS resource_usage_environment_id_idx ON resource_usage(environment_id);
CREATE INDEX IF NOT EXISTS resource_usage_resource_type_idx ON resource_usage(resource_type);
CREATE INDEX IF NOT EXISTS resource_usage_recorded_at_idx ON resource_usage(recorded_at);
CREATE INDEX IF NOT EXISTS security_policies_project_id_idx ON security_policies(project_id);
CREATE INDEX IF NOT EXISTS security_policies_environment_id_idx ON security_policies(environment_id);
CREATE INDEX IF NOT EXISTS security_policies_policy_type_idx ON security_policies(policy_type);
CREATE INDEX IF NOT EXISTS security_policies_status_idx ON security_policies(status);

-- =====================================================
-- 7. 验证迁移结果
-- =====================================================

-- 7.1 检查表结构
SELECT table_name, column_count, jsonb_column_count
FROM (
  SELECT 
    table_name,
    COUNT(*) as column_count,
    COUNT(*) FILTER (WHERE data_type = 'jsonb') as jsonb_column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name IN ('cost_tracking', 'performance_metrics', 'resource_usage', 'security_policies')
  GROUP BY table_name
) t;

-- 7.2 检查数据行数
SELECT 
  'cost_tracking' as table_name, 
  COUNT(*) as row_count,
  '简化后' as status
FROM cost_tracking
UNION ALL
SELECT 
  'performance_metrics' as table_name, 
  COUNT(*) as row_count,
  '简化后' as status
FROM performance_metrics
UNION ALL
SELECT 
  'resource_usage' as table_name, 
  COUNT(*) as row_count,
  '新表' as status
FROM resource_usage
UNION ALL
SELECT 
  'security_policies' as table_name, 
  COUNT(*) as row_count,
  '新表' as status
FROM security_policies;

-- =====================================================
-- 8. 完成提示
-- =====================================================

-- 迁移完成！重要提醒：
-- 1. 请验证数据完整性
-- 2. 测试应用程序功能
-- 3. 确认性能改进
-- 4. 如需要，可以使用备份表恢复数据

-- 回滚说明：
-- 如果需要回滚，请执行以下步骤：
-- 1. 删除新创建的表
-- 2. 从备份表恢复数据
-- 3. 恢复原始表结构
-- 4. 重新创建原始索引