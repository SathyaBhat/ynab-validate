# Makefile Error Handling

## Overview

The Makefile includes comprehensive error handling to prevent broken builds and maintain version consistency.

## Error Handling Features

### 1. Build Failure Detection

When a Docker build fails:
- **Version is automatically reverted** to the previous value
- **Build process stops immediately**
- **Clear error message** displayed
- **No broken tags created**

Example:
```bash
$ make build-backend
Incrementing backend version...
Backend version: 0.0.2 → 0.0.3
Building backend image sathyabhat/amex-sync-backend:0.0.3...
[Docker build fails]
❌ Backend build failed!
Reverting version increment...
Version reverted to 0.0.2
```

### 2. Push Validation

Before pushing to Docker Hub:
- **Verifies versioned tag exists** (e.g., 0.0.3)
- **Verifies :latest tag exists**
- **Stops if either tag is missing**
- **Prevents partial pushes**

Example:
```bash
$ make push-backend
Pushing backend image sathyabhat/amex-sync-backend:0.0.2...
❌ Error: Image sathyabhat/amex-sync-backend:latest not found!
Run 'make build-backend' first
```

### 3. Shell Error Propagation

The Makefile uses strict shell settings:
```makefile
.ONESHELL:
SHELL := /bin/bash
.SHELLFLAGS := -e -u -o pipefail -c
```

This ensures:
- **`-e`**: Exit immediately if a command fails
- **`-u`**: Treat unset variables as errors
- **`-o pipefail`**: Fail if any command in a pipeline fails

### 4. Command Chaining

Commands are chained with proper error handling:
- **`if/then/else`**: For conditional execution and error recovery
- **No semicolon chaining**: Prevents silent failures
- **Explicit error messages**: Clear indication of what went wrong

## What This Prevents

### Before Error Handling
```bash
# Version incremented: 0.0.2 → 0.0.3
# Docker build fails
# ❌ Version file shows 0.0.3 but no image built
# ❌ Next build would increment to 0.0.4, skipping 0.0.3
# ❌ Version numbers out of sync with actual builds
```

### After Error Handling
```bash
# Version incremented: 0.0.2 → 0.0.3
# Docker build fails
# ✓ Version automatically reverted to 0.0.2
# ✓ Next build correctly tries 0.0.3 again
# ✓ Version numbers stay in sync
```

## Recovery Scenarios

### Scenario 1: Build Failure
**Problem:** Docker build fails (missing dependency, syntax error, etc.)

**What happens:**
1. Version increment is reverted
2. Error message displayed
3. Make exits with error code 1
4. Version files remain consistent

**Recovery:**
1. Fix the build issue
2. Run `make build-backend` again
3. Version will increment correctly

### Scenario 2: Partial Build
**Problem:** One image builds but the other fails

**What happens:**
- Each image has independent error handling
- Failed image reverts its version
- Successful image keeps its new version
- Make exits with error for the failed build

**Recovery:**
```bash
# Backend succeeded (0.0.2 → 0.0.3)
# Web failed (stayed at 0.0.4)
# Fix web issue and run:
make build-web
# Web will now build as 0.0.5
```

### Scenario 3: Missing Image on Push
**Problem:** Trying to push without building first

**What happens:**
1. Image existence check fails
2. Clear error message shown
3. Suggested command displayed
4. No push attempted

**Recovery:**
```bash
make build-backend  # Build the image first
make push-backend   # Then push
```

## Testing Error Handling

### Test Build Failure Recovery
```bash
# Save current version
CURRENT=$(cat .version-backend)

# Create a broken Dockerfile
echo "FROM nonexistent:broken" > Dockerfile

# Try to build (will fail and revert)
make build-backend

# Check version was reverted
cat .version-backend  # Should match $CURRENT

# Restore Dockerfile
git checkout Dockerfile
```

### Test Push Validation
```bash
# Remove :latest tag
docker rmi sathyabhat/amex-sync-backend:latest

# Try to push (will fail with clear error)
make push-backend

# Rebuild to fix
make build-backend
make push-backend  # Now succeeds
```

## Best Practices

### 1. Always Check Build Output
Even with error handling, review build logs for warnings:
```bash
make build-backend 2>&1 | tee build.log
```

### 2. Use Release Targets
Release targets include tests and proper sequencing:
```bash
make release        # Tests → Build → Push
make release-backend  # Backend with tests
```

### 3. Verify Before Manual Version Changes
If manually editing version files:
```bash
# Check current state
make version

# Edit version file
echo "1.0.0" > .version-backend

# Build without increment
make build-backend-no-increment
```

### 4. Monitor Version Consistency
After any failures:
```bash
# Check versions
make version

# Check built images
docker images | grep amex-sync

# Verify they match
```

## Troubleshooting

### "Version already incremented but build failed"
This shouldn't happen with the new error handling, but if it does:
```bash
# Check current version
make version

# Manually decrement
echo "0.0.2" > .version-backend

# Try build again
make build-backend
```

### "Tags out of sync"
If versioned tag exists but :latest doesn't:
```bash
# Re-tag the image
docker tag sathyabhat/amex-sync-backend:0.0.2 sathyabhat/amex-sync-backend:latest

# Then push
make push-backend
```

### "Build succeeds but tag not created"
This indicates a Docker issue, not a Makefile issue:
```bash
# Check Docker daemon
docker info

# Check disk space
df -h

# Try building directly
docker build -t test:latest .
```

## Summary

The improved error handling ensures:
✅ **Version consistency** - Never get out of sync
✅ **Early failure detection** - Stop immediately on errors
✅ **Automatic recovery** - Revert versions on failure
✅ **Clear error messages** - Know exactly what went wrong
✅ **Safe operations** - Validate before pushing

This makes the build process more reliable and prevents the scenario where version files show a build that doesn't exist.
