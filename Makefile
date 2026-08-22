PYTHON ?= python3
LUA ?= $(shell command -v lua5.4 2>/dev/null || command -v lua)
GO ?= go
CARGO ?= cargo
PWSH ?= $(shell command -v pwsh 2>/dev/null || command -v powershell)
RUBY ?= ruby
CONFTEST ?= conftest

.PHONY: help check check-python check-pytest check-lua check-go check-rust check-spec check-powershell check-ruby check-rego

help:
	@echo "MathsMine3 polyglot checks"
	@echo "  make check              Run every language tool"
	@echo "  make check-python       Training Gherkin + invariants"
	@echo "  make check-pytest       Economy simulator (MM3, dice, legend wall)"
	@echo "  make check-lua          Rank table parity (JS/Kotlin)"
	@echo "  make check-go           API/proto linters + loadgen tests"
	@echo "  make check-rust         mm3-math crate tests"
	@echo "  make check-spec         Python/Rust spec dump must match"
	@echo "  make check-powershell   Windows AVD helper syntax"
	@echo "  make check-ruby         Play listing assets + copy limits"
	@echo "  python3 tools/balance/farming.py --input tools/balance/fixtures/farming_snapshot.json"
	@echo "  go run -C tools ./cmd/lb-report -base https://mathsmine3.xyz"
	@echo "Additive only (do not replace JS/Kotlin/PLpgSQL): HTML WebView offline, SQL farming snapshot, Windows .cmd"

check: check-python check-pytest check-lua check-go check-rust check-spec check-powershell check-ruby check-rego

check-python:
	$(PYTHON) tools/balance/check.py

check-pytest:
	cd tools/balance && $(PYTHON) -m pytest -q

check-lua:
	$(LUA) packages/game-tables/check_parity.lua

check-go:
	$(GO) run -C tools ./cmd/api-lint
	$(GO) run -C tools ./cmd/protocol-lint
	$(GO) test -C tools ./cmd/loadgen ./cmd/lb-report

check-rust:
	$(CARGO) test --manifest-path packages/mm3-math/Cargo.toml

check-spec:
	@tmpdir=$$(mktemp -d); \
	$(PYTHON) tools/balance/check.py --dump > "$$tmpdir/python.json"; \
	$(CARGO) run --quiet --manifest-path packages/mm3-math/Cargo.toml --bin dump-spec > "$$tmpdir/rust.json"; \
	diff -u "$$tmpdir/python.json" "$$tmpdir/rust.json"; \
	rm -rf "$$tmpdir"; \
	echo "ok  training spec python ↔ rust"

check-powershell:
	@if [ -n "$(PWSH)" ]; then \
		$(PWSH) -NoProfile -File scripts/windows/Connect-FreakingAI.ps1 -SyntaxCheck; \
	else \
		echo "skip  pwsh not installed"; \
	fi

check-ruby:
	$(RUBY) fastlane/verify_listing.rb

check-rego:
	@if command -v $(CONFTEST) >/dev/null 2>&1; then \
		$(CONFTEST) test --policy policy/github .github/workflows; \
	else \
		echo "skip  conftest not installed"; \
	fi
