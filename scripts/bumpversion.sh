#!/bin/bash

# Get current version from package.json
VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
MAJOR=$(echo $VERSION | cut -d. -f1)
MINOR=$(echo $VERSION | cut -d. -f2)
PATCH=$(echo $VERSION | cut -d. -f3)
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

# Update package.json
sed -i '' "s/\"version\": \"$VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update decky.pyi
sed -i '' "s/__version__ = '$VERSION'/__version__ = '$NEW_VERSION'/" decky.pyi

echo "Version bumped: $VERSION -> $NEW_VERSION"
