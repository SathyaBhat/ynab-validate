# Makefile Quick Reference

## Common Commands

### Most Used
```bash
make                    # Show help
make version            # Check current versions
make release            # Full release: test + build + push both images
```

### Build Images
```bash
make build              # Build both images (auto-increment)
make build-backend      # Build backend only (auto-increment)
make build-web          # Build web only (auto-increment)
```

### Push to Docker Hub
```bash
make push               # Push both images
make push-backend       # Push backend only
make push-web           # Push web only
```

### Individual Release Workflows
```bash
make release-backend    # Test + build + push backend
make release-web        # Build + push web
```

## Version Management

- Backend version: `.version-backend` (currently 0.0.2)
- Web version: `.version-web` (currently 0.0.4)
- Each build **automatically increments** the patch version
- Format: `MAJOR.MINOR.PATCH`

## Published Images

- `sathyabhat/amex-sync-backend:0.0.2` (and `:latest`)
- `sathyabhat/amex-sync-web:0.0.4` (and `:latest`)

## Typical Workflow

```bash
# 1. Make code changes and commit
git add .
git commit -m "feat: your changes"

# 2. Run tests locally (optional, release does this)
npm test

# 3. Build and push with auto-increment
make release

# 4. Commit version bump
git add .version-*
git commit -m "chore: bump versions"
git push

# 5. Deploy updated images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Advanced Usage

### Build Without Increment (Testing)
```bash
make build-backend-no-increment
make build-web-no-increment
```

### Manual Version Control
```bash
# Set specific version
echo "1.0.0" > .version-backend
make build-backend-no-increment
```

### Login to Docker Hub
```bash
make login
# or
docker login
```

### Clean Local Images
```bash
make clean
```

## Troubleshooting

**Problem:** Tests fail during release
```bash
# Skip tests and build manually
make build push
```

**Problem:** Permission denied when pushing
```bash
make login
```

**Problem:** Need to rebuild without version change
```bash
make build-backend-no-increment
make build-web-no-increment
```

See [DOCKER_RELEASE.md](DOCKER_RELEASE.md) for comprehensive documentation.
