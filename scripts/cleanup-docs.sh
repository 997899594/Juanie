#!/bin/bash

# 文档整理脚本
# 将历史重构文档移动到归档目录

set -e

echo "📦 开始整理文档..."

# 移动 GitOps 相关文档
echo "📁 移动 GitOps 重构文档..."
mv docs/architecture/GITOPS-* docs/archive/refactoring/gitops/ 2>/dev/null || true
mv docs/architecture/gitops-* docs/archive/refactoring/gitops/ 2>/dev/null || true

# 移动 Projects 相关文档
echo "📁 移动 Projects 重构文档..."
mv docs/architecture/PROJECTS-* docs/archive/refactoring/projects/ 2>/dev/null || true
mv docs/architecture/project-initialization-* docs/archive/refactoring/projects/ 2>/dev/null || true

# 移动 RBAC 相关文档
echo "📁 移动 RBAC 重构文档..."
mv docs/architecture/RBAC-* docs/archive/refactoring/rbac/ 2>/dev/null || true
mv docs/architecture/PERMISSION-* docs/archive/refactoring/rbac/ 2>/dev/null || true
mv docs/architecture/TEAM-* docs/archive/refactoring/rbac/ 2>/dev/null || true

# 移动 Core 相关文档
echo "📁 移动 Core 重构文档..."
mv docs/architecture/CORE-* docs/archive/refactoring/core/ 2>/dev/null || true
mv docs/architecture/core-* docs/archive/refactoring/core/ 2>/dev/null || true

# 移动 Business 相关文档
echo "📁 移动 Business 重构文档..."
mv docs/architecture/BUSINESS-* docs/archive/refactoring/business/ 2>/dev/null || true
mv docs/architecture/business-flux-* docs/archive/refactoring/business/ 2>/dev/null || true
mv docs/architecture/business-service-* docs/archive/refactoring/business/ 2>/dev/null || true

# 移动通用重构文档
echo "📁 移动通用重构文档..."
mv docs/architecture/*REFACTORING* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/*-refactoring-* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/ARCHITECTURE-REFACTORING-* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/layered-architecture-fix-* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/layered-architecture-violations.md docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 DAY 系列文档
echo "📁 移动 DAY 系列文档..."
mv docs/architecture/DAY* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/SESSION-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 DEPLOYMENTS 相关文档
echo "📁 移动 Deployments 文档..."
mv docs/architecture/DEPLOYMENTS-* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/deployment-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 authentication 相关文档
echo "📁 移动 Authentication 文档..."
mv docs/architecture/authentication-refactoring-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 initialization 相关文档
echo "📁 移动 Initialization 文档..."
mv docs/architecture/initialization-* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/初始化* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 progress 相关文档
echo "📁 移动 Progress 文档..."
mv docs/architecture/progress-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 encryption/storage 相关文档
echo "📁 移动 Encryption/Storage 文档..."
mv docs/architecture/encryption-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 error 相关文档
echo "📁 移动 Error 文档..."
mv docs/architecture/error-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 PACKAGES 相关文档
echo "📁 移动 Packages 文档..."
mv docs/architecture/PACKAGES-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 CRITICAL 相关文档
echo "📁 移动 Critical 文档..."
mv docs/architecture/CRITICAL-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 PROJECT_STATUS 文档
echo "📁 移动 Status 文档..."
mv docs/architecture/PROJECT_STATUS-* docs/archive/refactoring/general/ 2>/dev/null || true
mv docs/architecture/PROJECT_SLIMMING_* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 monorepo 相关文档
echo "📁 移动 Monorepo 文档..."
mv docs/architecture/monorepo-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 upstream tools 相关文档
echo "📁 移动 Upstream Tools 文档..."
mv docs/architecture/upstream-* docs/archive/refactoring/general/ 2>/dev/null || true

# 移动 troubleshooting 中的中文文档
echo "📁 移动 Troubleshooting 中文文档..."
mv docs/troubleshooting/废弃* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/深度* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/项目* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/最终* docs/archive/troubleshooting/ 2>/dev/null || true

# 移动 troubleshooting 中的重构文档
echo "📁 移动 Troubleshooting 重构文档..."
mv docs/troubleshooting/*-refactoring* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/*-fix-summary* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/authentication-refactoring-* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/git-credentials-service-refactoring.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/project-initialization-worker-refactoring* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/typescript-cache-issue-gitops-refactoring.md docs/archive/troubleshooting/ 2>/dev/null || true

# 移动 troubleshooting 中的临时修复文档
echo "📁 移动 Troubleshooting 临时修复文档..."
mv docs/troubleshooting/api-gateway-startup-fix-summary.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/multi-tenant-complete-fix-summary.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/multi-tenant-github-packages-fix.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/multi-tenant-issues-audit.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/template-rendering-complete-fix.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/template-variables-missing-fix.md docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/initialization-progress-and-imagepullsecret-fixes.md docs/archive/troubleshooting/ 2>/dev/null || true

# 移动 troubleshooting 中的成功记录
echo "📁 移动 Troubleshooting 成功记录..."
mv docs/troubleshooting/project-initialization-success-* docs/archive/troubleshooting/ 2>/dev/null || true
mv docs/troubleshooting/rrr-project-deployment-success.md docs/archive/troubleshooting/ 2>/dev/null || true

# 移动已完成的规格
echo "📁 移动已完成的规格..."
mv .kiro/specs/api-gateway-cleanup docs/archive/specs/ 2>/dev/null || true
mv .kiro/specs/business-layer-cleanup docs/archive/specs/ 2>/dev/null || true
mv .kiro/specs/upstream-tools-migration docs/archive/specs/ 2>/dev/null || true
mv .kiro/specs/architecture-improvements docs/archive/specs/ 2>/dev/null || true

echo "✅ 文档整理完成！"
echo ""
echo "📊 统计信息："
echo "  GitOps: $(ls docs/archive/refactoring/gitops/ 2>/dev/null | wc -l) 个文件"
echo "  Projects: $(ls docs/archive/refactoring/projects/ 2>/dev/null | wc -l) 个文件"
echo "  RBAC: $(ls docs/archive/refactoring/rbac/ 2>/dev/null | wc -l) 个文件"
echo "  Core: $(ls docs/archive/refactoring/core/ 2>/dev/null | wc -l) 个文件"
echo "  Business: $(ls docs/archive/refactoring/business/ 2>/dev/null | wc -l) 个文件"
echo "  General: $(ls docs/archive/refactoring/general/ 2>/dev/null | wc -l) 个文件"
echo "  Troubleshooting: $(ls docs/archive/troubleshooting/ 2>/dev/null | wc -l) 个文件"
echo "  Specs: $(ls docs/archive/specs/ 2>/dev/null | wc -l) 个目录"
echo ""
echo "📁 当前文档数量："
echo "  Architecture: $(ls docs/architecture/*.md 2>/dev/null | wc -l) 个文件"
echo "  Troubleshooting: $(ls docs/troubleshooting/*.md 2>/dev/null | wc -l) 个文件"
