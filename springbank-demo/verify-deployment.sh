#!/bin/bash

# SpringBank Demo - Pre-Deployment Verification Script
# Checks if all necessary files and configurations are ready for deployment
# Created by: Stephen Chijioke Okoronkwo | Shadowspark Technologies

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo "════════════════════════════════════════════════════════════════"
echo "  SpringBank Demo - Deployment Verification"
echo "  Shadowspark Technologies"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $1 ${RED}(MISSING)${NC}"
        ((FAILED++))
        return 1
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $1/ ${RED}(MISSING)${NC}"
        ((FAILED++))
        return 1
    fi
}

# Function to check file content
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $3"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $3 ${YELLOW}(WARNING)${NC}"
        ((WARNINGS++))
        return 1
    fi
}

echo "Checking Essential Files..."
echo "─────────────────────────────────────────────────────────────"
check_file "index.html"
check_file "vercel.json"
check_file "README.md"
check_file ".gitignore"
echo ""

echo "Checking Asset Directories..."
echo "─────────────────────────────────────────────────────────────"
check_dir "assets"
check_dir "assets/css"
check_dir "assets/js"
echo ""

echo "Checking CSS Files..."
echo "─────────────────────────────────────────────────────────────"
check_file "assets/css/main.css"
check_file "assets/css/components.css"
check_file "assets/css/animations.css"
echo ""

echo "Checking JavaScript Files..."
echo "─────────────────────────────────────────────────────────────"
check_file "assets/js/main.js"
check_file "assets/js/charts.js"
check_file "assets/js/ui.js"
echo ""

echo "Checking Documentation Files..."
echo "─────────────────────────────────────────────────────────────"
check_file "DEPLOYMENT.md"
check_file "SETUP_SEPARATE_REPO.md"
check_file "QUICKSTART.md"
echo ""

echo "Verifying Configuration..."
echo "─────────────────────────────────────────────────────────────"
check_content "vercel.json" "headers" "vercel.json contains security headers"
check_content "index.html" "Chart.js" "index.html includes Chart.js"
check_content "index.html" "SpringBank" "index.html contains SpringBank branding"
check_content "index.html" "Shadowspark" "index.html has Shadowspark attribution"
echo ""

echo "Checking HTML Structure..."
echo "─────────────────────────────────────────────────────────────"
if [ -f "index.html" ]; then
    # Check for required sections
    if grep -q "Investment Portfolio" index.html; then
        echo -e "${GREEN}✓${NC} Investment Portfolio section exists"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Investment Portfolio section not found"
        ((WARNINGS++))
    fi
    
    if grep -q "assetAllocationChart" index.html; then
        echo -e "${GREEN}✓${NC} Asset Allocation Chart configured"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Asset Allocation Chart not found"
        ((WARNINGS++))
    fi
    
    if grep -q "portfolioGrowthChart" index.html; then
        echo -e "${GREEN}✓${NC} Portfolio Growth Chart configured"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Portfolio Growth Chart not found"
        ((WARNINGS++))
    fi
    
    if grep -q "calculateInvestment" index.html; then
        echo -e "${GREEN}✓${NC} Investment Calculator function exists"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Investment Calculator function not found"
        ((WARNINGS++))
    fi
fi
echo ""

echo "Checking File Sizes..."
echo "─────────────────────────────────────────────────────────────"
if [ -f "index.html" ]; then
    SIZE=$(wc -c < "index.html")
    if [ $SIZE -gt 1000 ]; then
        echo -e "${GREEN}✓${NC} index.html size: $(numfmt --to=iec $SIZE)"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} index.html is too small (might be corrupted)"
        ((FAILED++))
    fi
fi

if [ -f "assets/css/main.css" ]; then
    SIZE=$(wc -c < "assets/css/main.css")
    if [ $SIZE -gt 500 ]; then
        echo -e "${GREEN}✓${NC} main.css size: $(numfmt --to=iec $SIZE)"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} main.css seems small"
        ((WARNINGS++))
    fi
fi
echo ""

echo "Checking Git Configuration..."
echo "─────────────────────────────────────────────────────────────"
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Git repository initialized"
    ((PASSED++))
    
    if git remote -v | grep -q "origin"; then
        echo -e "${GREEN}✓${NC} Git remote 'origin' configured"
        ((PASSED++))
        REMOTE_URL=$(git remote get-url origin)
        echo -e "  ${BLUE}→${NC} Remote: $REMOTE_URL"
    else
        echo -e "${YELLOW}⚠${NC} No git remote configured (optional for local testing)"
        ((WARNINGS++))
    fi
    
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠${NC} Uncommitted changes detected"
        ((WARNINGS++))
        echo -e "  ${BLUE}→${NC} Run: git add . && git commit -m 'Prepare for deployment'"
    else
        echo -e "${GREEN}✓${NC} No uncommitted changes"
        ((PASSED++))
    fi
else
    echo -e "${RED}✗${NC} Not a git repository"
    ((FAILED++))
    echo -e "  ${BLUE}→${NC} Run: git init"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
echo "  Verification Summary"
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Passed:${NC} $PASSED"
echo -e "${YELLOW}⚠ Warnings:${NC} $WARNINGS"
echo -e "${RED}✗ Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 Perfect! Everything is ready for deployment!${NC}"
        echo ""
        echo "Next Steps:"
        echo "  1. Push to GitHub: git push origin main"
        echo "  2. Deploy to Vercel: vercel --prod"
        echo "  3. Or use Vercel Dashboard: https://vercel.com"
    else
        echo -e "${YELLOW}⚠ Ready for deployment with warnings${NC}"
        echo "Review warnings above. Most are optional."
        echo ""
        echo "To deploy anyway:"
        echo "  vercel --prod"
    fi
    exit 0
else
    echo -e "${RED}✗ Deployment verification failed!${NC}"
    echo "Please fix the issues above before deploying."
    echo ""
    echo "For help:"
    echo "  - Check SETUP_SEPARATE_REPO.md"
    echo "  - Check QUICKSTART.md"
    echo "  - Email: wonderstevie702@gmail.com"
    exit 1
fi
