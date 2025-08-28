import { StackTemplate } from '../types.ts'

export const pythonTemplate: StackTemplate = {
    name: 'python',
    description: 'Python application with PostgreSQL and Redis',
    dockerCompose: `version: '3.8'

services:
  app:
    image: python:3.11-slim
    container_name: \${COMPOSE_PROJECT_NAME}-app
    ports:
      - "\${APP_PORT}:8000"
    volumes:
      - ./src:/app/src
      - ./requirements.txt:/app/requirements.txt
    working_dir: /app
    environment:
      - PYTHONPATH=/app
      - DATABASE_URL=\${DATABASE_URL}
      - SECRET_KEY=\${SECRET_KEY}
    command: python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    container_name: \${COMPOSE_PROJECT_NAME}-db
    environment:
      - POSTGRES_DB=\${DB_NAME}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    ports:
      - "\${DB_PORT}:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: \${COMPOSE_PROJECT_NAME}-redis
    ports:
      - "\${REDIS_PORT}:6379"
    volumes:
      - redis_data:/data

volumes:
  db_data:
  redis_data:
`,
    env: `# Project Configuration
COMPOSE_PROJECT_NAME=\${stackName}

# Application
APP_PORT=\${APP_PORT}
SECRET_KEY=\${SECRET_KEY}

# Database
DB_NAME=\${stackName}_db
DB_USER=postgres
DB_PASSWORD=\${DB_PASSWORD}
DB_PORT=\${DB_PORT}
DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@localhost:\${DB_PORT}/\${DB_NAME}

# Redis
REDIS_PORT=\${REDIS_PORT}
REDIS_URL=redis://localhost:\${REDIS_PORT}
`,
    files: {
        'requirements.txt': `fastapi==0.104.1
uvicorn[standard]==0.24.0
psycopg2-binary==2.9.9
redis==5.0.1
python-dotenv==1.0.0`,
        'src/main.py': `from fastapi import FastAPI
import os

app = FastAPI(title="\${stackName}")

@app.get("/")
def read_root():
    return {
        "message": "Hello from \${stackName}!",
        "database_url": os.getenv("DATABASE_URL", "not configured"),
        "redis_url": os.getenv("REDIS_URL", "not configured")
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}`,
        'src/__init__.py': ''
    },
    directories: ['src', 'data', 'logs'],
    variables: [
        {
            name: 'APP_PORT',
            description: 'Application port',
            default: '8000',
            type: 'number'
        },
        {
            name: 'DB_PORT',
            description: 'Database port',
            default: '5432',
            type: 'number'
        },
        {
            name: 'REDIS_PORT',
            description: 'Redis port',
            default: '6379',
            type: 'number'
        },
        {
            name: 'DB_PASSWORD',
            description: 'Database password',
            type: 'secret',
            generate: 'secret'
        },
        {
            name: 'SECRET_KEY',
            description: 'Application secret key',
            type: 'secret',
            generate: 'secret'
        }
    ],
    hooks: {
        pre: [
            {
                name: 'create-directories',
                command: 'mkdir -p src data logs',
                description: 'Create required directories'
            }
        ],
        post: [
            {
                name: 'create-venv',
                command: 'python -m venv venv',
                description: 'Create virtual environment'
            },
            {
                name: 'install-dependencies',
                command: 'pip install -r requirements.txt',
                description: 'Install Python dependencies',
                workingDir: './venv/bin'
            }
        ]
    }
}