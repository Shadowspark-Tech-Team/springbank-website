#!/bin/bash

echo "Cleaning cache..."
rm -rf .next

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate deploy

echo "Building Next.js..."
npm run build

echo "Committing changes..."
git add .
git commit -m "deploy update" || true

echo "Pushing to GitHub..."
git push

echo "Deploying to Vercel..."
vercel --prod

echo "Deployment complete."
