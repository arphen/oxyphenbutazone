.PHONY: run

run:
	@echo "Starting backend and frontend..."
	@trap 'kill 0' EXIT; \
	(cd backend && .venv/bin/python manage.py runserver) & \
	(cd frontend && npm run dev) & \
	wait
