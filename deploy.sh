#!/bin/bash

echo "Generating Prisma client..."
npx prisma generate

echo "Building project..."
npm run build

echo "Committing changes..."
git add .
git commit -m "deploy" || true

echo "Pushing to GitHub..."
git push

echo "Deploying to Vercel..."
vercel --prodnpm run build && git add . && git commit -m "deploy" && git push && vercel --prod

