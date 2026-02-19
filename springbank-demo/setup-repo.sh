#!/bin/bash

# SpringBank Demo - Repository Setup Script
# This script helps create a separate repository for SpringBank Demo
# Created by: Stephen Chijioke Okoronkwo | Shadowspark Technologies

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "  SpringBank Demo - Separate Repository Setup"
echo "  Shadowspark Technologies"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

print_success "Git is installed"

# Get current directory
CURRENT_DIR=$(pwd)
print_info "Current directory: $CURRENT_DIR"

# Check if we're in the springbank-demo folder
if [[ $CURRENT_DIR == *"springbank-demo"* ]]; then
    print_warning "You're already in the springbank-demo folder"
    DEMO_DIR=$CURRENT_DIR
else
    # Check if springbank-demo exists in current directory
    if [ -d "springbank-demo" ]; then
        DEMO_DIR="$CURRENT_DIR/springbank-demo"
        print_success "Found springbank-demo folder"
    else
        print_error "springbank-demo folder not found in current directory"
        echo "Please run this script from the springbank-website directory"
        exit 1
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Step 1: Create New Directory for Separate Repo"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Ask user for new directory location
read -p "Enter path for new repository (default: ~/springbank-demo-repo): " NEW_REPO_DIR
NEW_REPO_DIR=${NEW_REPO_DIR:-~/springbank-demo-repo}
NEW_REPO_DIR="${NEW_REPO_DIR/#\~/$HOME}"  # Expand ~ to home directory

if [ -d "$NEW_REPO_DIR" ]; then
    print_warning "Directory already exists: $NEW_REPO_DIR"
    read -p "Do you want to remove it and continue? (y/N): " REMOVE_DIR
    if [[ $REMOVE_DIR =~ ^[Yy]$ ]]; then
        rm -rf "$NEW_REPO_DIR"
        print_success "Removed existing directory"
    else
        print_error "Setup cancelled"
        exit 1
    fi
fi

# Create new directory
mkdir -p "$NEW_REPO_DIR"
print_success "Created directory: $NEW_REPO_DIR"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Step 2: Copy Files to New Directory"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Copy all files
cp -r "$DEMO_DIR/"* "$NEW_REPO_DIR/" 2>/dev/null || true
cp -r "$DEMO_DIR/".* "$NEW_REPO_DIR/" 2>/dev/null || true

# Remove .git if it exists (we'll create fresh)
rm -rf "$NEW_REPO_DIR/.git"

print_success "Files copied successfully"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Step 3: Initialize Git Repository"
echo "════════════════════════════════════════════════════════════════"
echo ""

cd "$NEW_REPO_DIR"

# Initialize git
git init
print_success "Initialized git repository"

# Check if .gitignore exists, if not create one
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'EOF'
# Node modules
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build artifacts
dist/
build/
*.min.js
*.min.css

# OS files
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# IDE files
.vscode/
.idea/
*.sublime-project
*.sublime-workspace

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
*.tmp

# Vercel
.vercel
EOF
    print_success "Created .gitignore file"
fi

# Add all files
git add .
print_success "Added all files to git"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Step 4: Create Initial Commit"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Create commit
git commit -m "Initial commit: SpringBank Premium Banking Demo

Created by: Stephen Chijioke Okoronkwo
Company: Shadowspark Technologies

Features:
- Interactive investment dashboard with Chart.js
- Portfolio tracking and analytics
- Money transfer system
- Security center
- Theme toggle (Dark/Light mode)
- Responsive design
- WCAG AA compliant

Technologies:
- HTML5, CSS3, JavaScript
- Chart.js for visualizations
- Font Awesome icons
- Google Fonts (Plus Jakarta Sans)

Designed for deployment to Vercel."

print_success "Created initial commit"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Step 5: Add Remote Repository"
echo "════════════════════════════════════════════════════════════════"
echo ""

print_info "Please create a new repository on GitHub:"
echo "  1. Go to: https://github.com/new"
echo "  2. Repository name: springbank-demo"
echo "  3. Description: Premium digital banking demo - Built by Shadowspark Technologies"
echo "  4. Make it Public or Private"
echo "  5. Do NOT initialize with README"
echo "  6. Click 'Create repository'"
echo ""

read -p "Enter your new repository URL (e.g., https://github.com/Shadow7user/springbank-demo.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    print_warning "No repository URL provided. You can add it later with:"
    echo "  cd $NEW_REPO_DIR"
    echo "  git remote add origin YOUR_REPO_URL"
    echo "  git push -u origin main"
else
    # Add remote
    git remote add origin "$REPO_URL"
    print_success "Added remote repository: $REPO_URL"
    
    # Set main branch
    git branch -M main
    print_success "Set main branch"
    
    echo ""
    read -p "Do you want to push to GitHub now? (y/N): " PUSH_NOW
    if [[ $PUSH_NOW =~ ^[Yy]$ ]]; then
        print_info "Pushing to GitHub..."
        git push -u origin main
        print_success "Pushed to GitHub successfully!"
    else
        print_info "You can push later with: git push -u origin main"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✓ Setup Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
print_success "Repository created at: $NEW_REPO_DIR"
echo ""
print_info "Next Steps:"
echo "  1. Your repository is ready at: $NEW_REPO_DIR"
echo "  2. Push to GitHub (if not done): cd $NEW_REPO_DIR && git push -u origin main"
echo "  3. Deploy to Vercel:"
echo "     - Visit: https://vercel.com"
echo "     - Import your GitHub repository"
echo "     - Click Deploy"
echo "  4. Or use Vercel CLI:"
echo "     - npm install -g vercel"
echo "     - cd $NEW_REPO_DIR"
echo "     - vercel --prod"
echo ""
print_info "Documentation:"
echo "  - Setup Guide: $NEW_REPO_DIR/SETUP_SEPARATE_REPO.md"
echo "  - Deployment Guide: $NEW_REPO_DIR/DEPLOYMENT.md"
echo "  - README: $NEW_REPO_DIR/README.md"
echo ""
print_success "Built with ❤️ by Stephen Chijioke Okoronkwo | Shadowspark Technologies"
echo ""
