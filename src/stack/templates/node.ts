import { StackTemplate } from '../types.ts'

export const nodeTemplate: StackTemplate = {
    name: 'node',
    description: 'Node.js application with PostgreSQL and Redis',
    dockerCompose: `version: '3.8'

services:
  app:
    image: node:18-alpine
    container_name: \${COMPOSE_PROJECT_NAME}-app
    ports:
      - "\${APP_PORT}:3000"
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./package-lock.json:/app/package-lock.json
    working_dir: /app
    environment:
      - NODE_ENV=\${NODE_ENV}
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
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
NODE_ENV=development

# Application
APP_PORT=\${APP_PORT}
JWT_SECRET=\${JWT_SECRET}

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
        'package.json': `{
  "name": "\${stackName}",
  "version": "1.0.0",
  "description": "",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}`,
        'src/index.js': `const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from \${stackName}!',
    environment: process.env.NODE_ENV 
  });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
    },
    directories: ['src', 'data'],
    variables: [
        {
            name: 'APP_PORT',
            description: 'Application port',
            default: '3000',
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
            name: 'JWT_SECRET',
            description: 'JWT signing secret',
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
                name: 'install-dependencies',
                command: 'npm install',
                description: 'Install Node.js dependencies'
            }
        ]
    }
}