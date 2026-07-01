#!/bin/bash

# Determine the commit message, or use a default one.
MSG="${1:-System update $(date '+%Y-%m-%d %H:%M')}"

# Run git commands.
echo "Staging all changes..."
git add .

echo "Creating commit with message: $MSG"
git commit -m "$MSG"

echo "Pushing code..."
git push

echo "Push completed!"
