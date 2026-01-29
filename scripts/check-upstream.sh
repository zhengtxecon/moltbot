#!/usr/bin/env bash
set -euo pipefail

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 检查上游更新..."
git fetch origin main --quiet

# 计算差异
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
AHEAD=$(git rev-list --count origin/main..HEAD)
BEHIND=$(git rev-list --count HEAD..origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✓ 已是最新${NC}"
    exit 0
fi

echo ""
echo -e "本地领先: ${AHEAD} commits"
echo -e "本地落后: ${YELLOW}${BEHIND} commits${NC}"
echo ""

# 显示上游新 commit
if [ "$BEHIND" -gt 0 ]; then
    echo "📥 上游新增 commits:"
    git log --oneline HEAD..origin/main
    echo ""

    # 检查关键文件变更
    echo "📋 关键文件检查:"
    CHANGED_FILES=$(git diff --name-only HEAD..origin/main)

    check_file() {
        if echo "$CHANGED_FILES" | grep -q "$1"; then
            echo -e "  ${YELLOW}⚠️  $1 有改动${NC}"
            return 1
        else
            echo -e "  ${GREEN}✓  $1 无改动${NC}"
            return 0
        fi
    }

    NEEDS_REVIEW=0
    check_file "Dockerfile" || NEEDS_REVIEW=1
    check_file "docker-compose.yml" || NEEDS_REVIEW=1
    check_file "extensions/msteams/" || NEEDS_REVIEW=1
    check_file "src/agents/session-write-lock" || NEEDS_REVIEW=1
    check_file "AGENTS.md" || NEEDS_REVIEW=1

    echo ""
    if [ "$NEEDS_REVIEW" -eq 1 ]; then
        echo -e "${YELLOW}⚠️  有关键文件变更，建议手动检查差异后再更新${NC}"
        echo "   运行: git diff HEAD..origin/main -- <file>"
    else
        echo -e "${GREEN}✓ 关键文件无冲突，可以安全更新${NC}"
    fi
fi
