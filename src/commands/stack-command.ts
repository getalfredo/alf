import { BaseCommand } from './base-command.ts'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import os from 'os'

export class StackCommand extends BaseCommand {
    async execute(stackName: string): Promise<void> {
        if (!stackName) {
            throw new Error('Stack name is required')
        }

        const stacksDir = path.join(os.homedir(), 'stacks')
        const stackDir = path.join(stacksDir, stackName)

        // Create the stacks directory and specific stack directory
        await mkdir(stackDir, { recursive: true })

        // Generate docker-compose.yml content
        const dockerComposeContent = `version: '3.8'

services:
  app:
    image: node:18-alpine
    container_name: \${COMPOSE_PROJECT_NAME}-app
    ports:
      - "\${APP_PORT:-3000}:3000"
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./package-lock.json:/app/package-lock.json
    working_dir: /app
    environment:
      - NODE_ENV=\${NODE_ENV:-development}
      - DATABASE_URL=\${DATABASE_URL}
    command: npm run dev
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
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: \${COMPOSE_PROJECT_NAME}-redis
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data

volumes:
  db_data:
  redis_data:
`

        // Generate .env content
        const envContent = `# Project Configuration
COMPOSE_PROJECT_NAME=${stackName}
NODE_ENV=development

# Application
APP_PORT=3000

# Database
DB_NAME=${stackName}_db
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_PORT=5432
DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@localhost:\${DB_PORT}/\${DB_NAME}

# Redis
REDIS_PORT=6379
REDIS_URL=redis://localhost:\${REDIS_PORT}
`

        // Write files
        const dockerComposePath = path.join(stackDir, 'docker-compose.yml')
        const envPath = path.join(stackDir, '.env')

        await writeFile(dockerComposePath, dockerComposeContent, 'utf8')
        await writeFile(envPath, envContent, 'utf8')

        console.log(`✅ Stack "${stackName}" created successfully at ${stackDir}`)
        console.log(`   - docker-compose.yml`)
        console.log(`   - .env`)
        console.log(`\nTo start the stack:`)
        console.log(`   cd ${stackDir}`)
        console.log(`   docker-compose up -d`)
    }
}