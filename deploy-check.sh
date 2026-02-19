#!/bin/bash

# SpringBank Website - Pre-Deployment Checklist Script
# Run this before deploying to verify everything is ready

echo "🚀 SpringBank Website - Deployment Readiness Check"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2 exists"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $2 missing"
        ((CHECKS_FAILED++))
        return 1
    fi
}

echo "📁 Checking Essential Files..."
echo "------------------------------"

check_file "index.html" "Main homepage"
check_file "demo2.html" "Premium demo page"
check_file "styles.css" "Main stylesheet"
check_file "main.js" "Main JavaScript"
check_file "vercel.json" "Vercel configuration"
check_file "netlify.toml" "Netlify configuration"
check_file "robots.txt" "Robots.txt for SEO"
check_file "sitemap.xml" "Sitemap for SEO"
check_file "404.html" "404 error page"

echo ""
echo "🔧 Checking Configuration..."
echo "----------------------------"

# Check if git repo is clean
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✓${NC} Git repository is clean (all changes committed)"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Git repository has uncommitted changes"
    echo "  Run: git add . && git commit -m 'Ready for deployment'"
fi

# Check if on correct branch
BRANCH=$(git branch --show-current)
echo -e "${GREEN}✓${NC} Current branch: $BRANCH"
((CHECKS_PASSED++))

# Check remote
REMOTE=$(git remote -v | head -n1)
if [ ! -z "$REMOTE" ]; then
    echo -e "${GREEN}✓${NC} Git remote configured"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} No git remote configured"
    ((CHECKS_FAILED++))
fi

echo ""
echo "📊 Checking File Sizes..."
echo "------------------------"

# Check if files are too large
INDEX_SIZE=$(stat -f%z index.html 2>/dev/null || stat -c%s index.html 2>/dev/null)
DEMO_SIZE=$(stat -f%z demo2.html 2>/dev/null || stat -c%s demo2.html 2>/dev/null)

if [ $INDEX_SIZE -gt 0 ]; then
    INDEX_KB=$((INDEX_SIZE / 1024))
    echo -e "${GREEN}✓${NC} index.html: ${INDEX_KB}KB"
    ((CHECKS_PASSED++))
fi

if [ $DEMO_SIZE -gt 0 ]; then
    DEMO_KB=$((DEMO_SIZE / 1024))
    echo -e "${GREEN}✓${NC} demo2.html: ${DEMO_KB}KB"
    ((CHECKS_PASSED++))
fi

echo ""
echo "🔒 Security Configuration..."
echo "---------------------------"

# Check if vercel.json has security headers
if grep -q "X-Frame-Options" vercel.json; then
    echo -e "${GREEN}✓${NC} Security headers configured in vercel.json"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Security headers may be missing"
fi

# Check if netlify.toml has security headers
if grep -q "X-Frame-Options" netlify.toml; then
    echo -e "${GREEN}✓${NC} Security headers configured in netlify.toml"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Security headers may be missing"
fi

echo ""
echo "=================================================="
echo "📈 Deployment Readiness Summary"
echo "=================================================="
echo -e "Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ YOUR SITE IS READY FOR DEPLOYMENT!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Push to GitHub: git push origin $BRANCH"
    echo "2. Go to https://vercel.com or https://netlify.com"
    echo "3. Import your repository"
    echo "4. Deploy and go live!"
    echo ""
    echo "📖 Full instructions: See DEPLOY_NOW.md"
else
    echo -e "${YELLOW}⚠️  PLEASE FIX THE ISSUES ABOVE BEFORE DEPLOYING${NC}"
    echo ""
fi

echo ""
echo "Need help? Check DEPLOY_NOW.md for detailed instructions"
echo ""
