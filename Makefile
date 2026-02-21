# Makefile for AmEx Sync Docker image management
# Handles versioning, building, and publishing Docker images

# Ensure commands fail on error
.ONESHELL:
SHELL := /bin/bash
.SHELLFLAGS := -e -u -o pipefail -c

# Docker configuration
DOCKER_USERNAME = sathyabhat
BACKEND_IMAGE = $(DOCKER_USERNAME)/amex-sync-backend
WEB_IMAGE = $(DOCKER_USERNAME)/amex-sync-web

# Version files
BACKEND_VERSION_FILE = .version-backend
WEB_VERSION_FILE = .version-web

# Read current versions
BACKEND_VERSION = $(shell cat $(BACKEND_VERSION_FILE))
WEB_VERSION = $(shell cat $(WEB_VERSION_FILE))

# Colors for output
COLOR_RESET = \033[0m
COLOR_BOLD = \033[1m
COLOR_GREEN = \033[32m
COLOR_BLUE = \033[34m
COLOR_YELLOW = \033[33m

.PHONY: help version build-backend build-web build push-backend push-web push clean test

# Default target
help:
	@printf "$(COLOR_BOLD)AmEx Sync Docker Image Management$(COLOR_RESET)\n"
	@printf "\n"
	@printf "$(COLOR_BLUE)Available targets:$(COLOR_RESET)\n"
	@printf "  $(COLOR_GREEN)version$(COLOR_RESET)              - Show current versions\n"
	@printf "  $(COLOR_GREEN)build-backend$(COLOR_RESET)        - Build backend Docker image with auto-increment\n"
	@printf "  $(COLOR_GREEN)build-web$(COLOR_RESET)            - Build web Docker image with auto-increment\n"
	@printf "  $(COLOR_GREEN)build$(COLOR_RESET)                - Build both images with auto-increment\n"
	@printf "  $(COLOR_GREEN)push-backend$(COLOR_RESET)         - Push backend image to Docker Hub\n"
	@printf "  $(COLOR_GREEN)push-web$(COLOR_RESET)             - Push web image to Docker Hub\n"
	@printf "  $(COLOR_GREEN)push$(COLOR_RESET)                 - Push both images to Docker Hub\n"
	@printf "  $(COLOR_GREEN)release-backend$(COLOR_RESET)      - Build and push backend (auto-increment)\n"
	@printf "  $(COLOR_GREEN)release-web$(COLOR_RESET)          - Build and push web (auto-increment)\n"
	@printf "  $(COLOR_GREEN)release$(COLOR_RESET)              - Build and push both images\n"
	@printf "  $(COLOR_GREEN)test$(COLOR_RESET)                 - Run tests before building\n"
	@printf "  $(COLOR_GREEN)clean$(COLOR_RESET)                - Remove local Docker images\n"
	@printf "\n"
	@printf "$(COLOR_YELLOW)Current versions:$(COLOR_RESET)\n"
	@printf "  Backend: $(BACKEND_VERSION)\n"
	@printf "  Web:     $(WEB_VERSION)\n"

# Show current versions
version:
	@printf "$(COLOR_BOLD)Current Versions:$(COLOR_RESET)\n"
	@printf "  Backend: $(COLOR_GREEN)$(BACKEND_VERSION)$(COLOR_RESET)\n"
	@printf "  Web:     $(COLOR_GREEN)$(WEB_VERSION)$(COLOR_RESET)\n"

# Increment version (patch level)
increment-backend-version:
	@printf "$(COLOR_BLUE)Incrementing backend version...$(COLOR_RESET)\n"
	@CURRENT=$$(cat $(BACKEND_VERSION_FILE)); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	PATCH=$$(echo $$CURRENT | cut -d. -f3); \
	NEW_PATCH=$$((PATCH + 1)); \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH"; \
	echo $$NEW_VERSION > $(BACKEND_VERSION_FILE); \
	printf "$(COLOR_GREEN)Backend version: $$CURRENT → $$NEW_VERSION$(COLOR_RESET)\n"

increment-web-version:
	@printf "$(COLOR_BLUE)Incrementing web version...$(COLOR_RESET)\n"
	@CURRENT=$$(cat $(WEB_VERSION_FILE)); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	PATCH=$$(echo $$CURRENT | cut -d. -f3); \
	NEW_PATCH=$$((PATCH + 1)); \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH"; \
	echo $$NEW_VERSION > $(WEB_VERSION_FILE); \
	printf "$(COLOR_GREEN)Web version: $$CURRENT → $$NEW_VERSION$(COLOR_RESET)\n"

# Build backend Docker image
build-backend: increment-backend-version
	@NEW_VERSION=$$(cat $(BACKEND_VERSION_FILE))
	@printf "$(COLOR_BLUE)Building backend image $(BACKEND_IMAGE):$$NEW_VERSION...$(COLOR_RESET)\n"
	@if docker build -t $(BACKEND_IMAGE):$$NEW_VERSION -t $(BACKEND_IMAGE):latest -f Dockerfile . ; then \
		printf "$(COLOR_GREEN)✓ Backend image built: $(BACKEND_IMAGE):$$NEW_VERSION$(COLOR_RESET)\n"; \
	else \
		printf "$(COLOR_RESET)\n"; \
		echo "❌ $(COLOR_BOLD)Backend build failed!$(COLOR_RESET)\n"; \
		printf "$(COLOR_YELLOW)Reverting version increment...$(COLOR_RESET)\n"; \
		PREV_VERSION=$$(echo $$NEW_VERSION | awk -F. '{$$NF=$$NF-1; print $$1"."$$2"."$$NF}'); \
		echo $$PREV_VERSION > $(BACKEND_VERSION_FILE); \
		printf "$(COLOR_YELLOW)Version reverted to $$PREV_VERSION$(COLOR_RESET)\n"; \
		exit 1; \
	fi

# Build web Docker image
build-web: increment-web-version
	@NEW_VERSION=$$(cat $(WEB_VERSION_FILE))
	@printf "$(COLOR_BLUE)Building web image $(WEB_IMAGE):$$NEW_VERSION...$(COLOR_RESET)\n"
	@if cd web && docker build -t $(WEB_IMAGE):$$NEW_VERSION -t $(WEB_IMAGE):latest -f Dockerfile.prod . ; then \
		printf "$(COLOR_GREEN)✓ Web image built: $(WEB_IMAGE):$$NEW_VERSION$(COLOR_RESET)\n"; \
	else \
		printf "$(COLOR_RESET)\n"; \
		echo "❌ $(COLOR_BOLD)Web build failed!$(COLOR_RESET)\n"; \
		printf "$(COLOR_YELLOW)Reverting version increment...$(COLOR_RESET)\n"; \
		PREV_VERSION=$$(echo $$NEW_VERSION | awk -F. '{$$NF=$$NF-1; print $$1"."$$2"."$$NF}'); \
		echo $$PREV_VERSION > $(WEB_VERSION_FILE); \
		printf "$(COLOR_YELLOW)Version reverted to $$PREV_VERSION$(COLOR_RESET)\n"; \
		exit 1; \
	fi

# Build both images
build: build-backend build-web
	@printf "$(COLOR_GREEN)✓ All images built successfully$(COLOR_RESET)\n"

# Push backend image to Docker Hub
push-backend:
	@VERSION=$$(cat $(BACKEND_VERSION_FILE))
	@printf "$(COLOR_BLUE)Pushing backend image $(BACKEND_IMAGE):$$VERSION...$(COLOR_RESET)\n"
	@if ! docker image inspect $(BACKEND_IMAGE):$$VERSION >/dev/null 2>&1; then \
		echo "❌ $(COLOR_BOLD)Error: Image $(BACKEND_IMAGE):$$VERSION not found!$(COLOR_RESET)\n"; \
		printf "$(COLOR_YELLOW)Run 'make build-backend' first$(COLOR_RESET)\n"; \
		exit 1; \
	fi
	@if ! docker image inspect $(BACKEND_IMAGE):latest >/dev/null 2>&1; then \
		echo "❌ $(COLOR_BOLD)Error: Image $(BACKEND_IMAGE):latest not found!$(COLOR_RESET)\n"; \
		printf "$(COLOR_YELLOW)Run 'make build-backend' first$(COLOR_RESET)\n"; \
		exit 1; \
	fi
	docker push $(BACKEND_IMAGE):$$VERSION
	docker push $(BACKEND_IMAGE):latest
	@printf "$(COLOR_GREEN)✓ Backend image pushed: $(BACKEND_IMAGE):$$VERSION$(COLOR_RESET)\n"

# Push web image to Docker Hub
push-web:
	@VERSION=$$(cat $(WEB_VERSION_FILE))
	@printf "$(COLOR_BLUE)Pushing web image $(WEB_IMAGE):$$VERSION...$(COLOR_RESET)\n"
	@if ! docker image inspect $(WEB_IMAGE):$$VERSION >/dev/null 2>&1; then \
		echo "❌ $(COLOR_BOLD)Error: Image $(WEB_IMAGE):$$VERSION not found!$(COLOR_RESET)\n"; \
		printf "$(COLOR_YELLOW)Run 'make build-web' first$(COLOR_RESET)\n"; \
		exit 1; \
	fi
	@if ! docker image inspect $(WEB_IMAGE):latest >/dev/null 2>&1; then \
		echo "❌ $(COLOR_BOLD)Error: Image $(WEB_IMAGE):latest not found!$(COLOR_RESET)\n"; \
		printf "$(COLOR_YELLOW)Run 'make build-web' first$(COLOR_RESET)\n"; \
		exit 1; \
	fi
	docker push $(WEB_IMAGE):$$VERSION
	docker push $(WEB_IMAGE):latest
	@printf "$(COLOR_GREEN)✓ Web image pushed: $(WEB_IMAGE):$$VERSION$(COLOR_RESET)\n"

# Push both images
push: push-backend push-web
	@printf "$(COLOR_GREEN)✓ All images pushed successfully$(COLOR_RESET)\n"

# Build and push backend (release)
release-backend: test build-backend push-backend
	@VERSION=$$(cat $(BACKEND_VERSION_FILE)); \
	printf "$(COLOR_GREEN)✓ Backend release complete: $(BACKEND_IMAGE):$$VERSION$(COLOR_RESET)\n"

# Build and push web (release)
release-web: build-web push-web
	@VERSION=$$(cat $(WEB_VERSION_FILE)); \
	printf "$(COLOR_GREEN)✓ Web release complete: $(WEB_IMAGE):$$VERSION$(COLOR_RESET)\n"

# Build and push both images (full release)
release: test build push
	@BACKEND_VERSION=$$(cat $(BACKEND_VERSION_FILE)); \
	WEB_VERSION=$$(cat $(WEB_VERSION_FILE)); \
	echo ""; \
	printf "$(COLOR_BOLD)$(COLOR_GREEN)✓ Release complete!$(COLOR_RESET)\n"; \
	echo "  Backend: $(BACKEND_IMAGE):$$BACKEND_VERSION"; \
	echo "  Web:     $(WEB_IMAGE):$$WEB_VERSION"

# Run tests
test:
	@printf "$(COLOR_BLUE)Running tests...$(COLOR_RESET)\n"
	@npm test
	@printf "$(COLOR_GREEN)✓ Tests passed$(COLOR_RESET)\n"

# Clean local Docker images
clean:
	@printf "$(COLOR_YELLOW)Removing local Docker images...$(COLOR_RESET)\n"
	-docker rmi $(BACKEND_IMAGE):$(BACKEND_VERSION)
	-docker rmi $(BACKEND_IMAGE):latest
	-docker rmi $(WEB_IMAGE):$(WEB_VERSION)
	-docker rmi $(WEB_IMAGE):latest
	@printf "$(COLOR_GREEN)✓ Local images removed$(COLOR_RESET)\n"

# Build without incrementing (for testing)
build-backend-no-increment:
	@VERSION=$$(cat $(BACKEND_VERSION_FILE))
	@printf "$(COLOR_BLUE)Building backend image $(BACKEND_IMAGE):$$VERSION (no increment)...$(COLOR_RESET)\n"
	docker build -t $(BACKEND_IMAGE):$$VERSION -t $(BACKEND_IMAGE):latest -f Dockerfile .
	@printf "$(COLOR_GREEN)✓ Backend image built: $(BACKEND_IMAGE):$$VERSION$(COLOR_RESET)\n"

build-web-no-increment:
	@VERSION=$$(cat $(WEB_VERSION_FILE))
	@printf "$(COLOR_BLUE)Building web image $(WEB_IMAGE):$$VERSION (no increment)...$(COLOR_RESET)\n"
	cd web && docker build -t $(WEB_IMAGE):$$VERSION -t $(WEB_IMAGE):latest -f Dockerfile.prod .
	@printf "$(COLOR_GREEN)✓ Web image built: $(WEB_IMAGE):$$VERSION$(COLOR_RESET)\n"

# Docker login helper
login:
	@printf "$(COLOR_BLUE)Logging in to Docker Hub...$(COLOR_RESET)\n"
	@docker login
	@printf "$(COLOR_GREEN)✓ Logged in$(COLOR_RESET)\n"
