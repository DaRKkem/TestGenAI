setup:
	cp .env.example .env

install:
	pip install -r backend/requirements.txt

run-backend:
	cd backend && uvicorn app.main:app --reload --reload-exclude "*.db" --reload-exclude "*.db-journal"

run-frontend:
	cd frontend && python -m http.server 5500