.PHONY: api-install api-dev api-test api-lint web-install web-dev up down

api-install:
	cd apps/api && pip install -e '.[dev]'

api-dev:
	cd apps/api && uvicorn app.main:app --reload

api-test:
	cd apps/api && pytest

api-lint:
	cd apps/api && ruff check .

web-install:
	cd apps/web && npm install

web-dev:
	cd apps/web && npm run dev

up:
	docker compose up --build

down:
	docker compose down
