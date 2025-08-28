import { StackTemplate } from '../types.ts'

export const goTemplate: StackTemplate = {
    name: 'go',
    description: 'Go application with PostgreSQL and Redis',
    dockerCompose: `version: '3.8'

services:
  app:
    image: golang:1.21-alpine
    container_name: \${COMPOSE_PROJECT_NAME}-app
    ports:
      - "\${APP_PORT}:8080"
    volumes:
      - .:/app
    working_dir: /app
    environment:
      - CGO_ENABLED=1
      - DATABASE_URL=\${DATABASE_URL}
    command: go run main.go
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
        'go.mod': `module \${stackName}

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/lib/pq v1.10.9
    github.com/go-redis/redis/v8 v8.11.5
)`,
        'main.go': `package main

import (
    "log"
    "net/http"
    "os"

    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "message": "Hello from \${stackName}!",
            "database_url": os.Getenv("DATABASE_URL"),
        })
    })

    r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "status": "healthy",
        })
    })

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("Server starting on port %s", port)
    r.Run(":" + port)
}`
    },
    directories: ['data', 'logs'],
    variables: [
        {
            name: 'APP_PORT',
            description: 'Application port',
            default: '8080',
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
        }
    ],
    hooks: {
        pre: [
            {
                name: 'create-directories',
                command: 'mkdir -p data logs',
                description: 'Create required directories'
            }
        ],
        post: [
            {
                name: 'init-go-module',
                command: 'go mod init \${stackName}',
                description: 'Initialize Go module'
            },
            {
                name: 'download-dependencies',
                command: 'go mod tidy',
                description: 'Download Go dependencies'
            }
        ]
    }
}