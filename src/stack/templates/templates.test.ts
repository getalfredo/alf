import { test, expect } from 'bun:test'
import { nodeTemplate, pythonTemplate, goTemplate } from './index.ts'
import { TemplateManager } from '../template-manager.ts'
import { mkdtemp, rmdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test('Node template has required structure', () => {
    expect(nodeTemplate.name).toBe('node')
    expect(nodeTemplate.description).toContain('Node.js')
    expect(nodeTemplate.dockerCompose).toContain('node:18-alpine')
    expect(nodeTemplate.dockerCompose).toContain('postgres:15-alpine')
    expect(nodeTemplate.dockerCompose).toContain('redis:7-alpine')
    expect(nodeTemplate.env).toContain('NODE_ENV')
    expect(nodeTemplate.variables).toBeDefined()
    expect(nodeTemplate.hooks).toBeDefined()
})

test('Python template has required structure', () => {
    expect(pythonTemplate.name).toBe('python')
    expect(pythonTemplate.description).toContain('Python')
    expect(pythonTemplate.dockerCompose).toContain('python:3.11-slim')
    expect(pythonTemplate.dockerCompose).toContain('postgres:15-alpine')
    expect(pythonTemplate.dockerCompose).toContain('redis:7-alpine')
    expect(pythonTemplate.env).toContain('DATABASE_URL')
    expect(pythonTemplate.variables).toBeDefined()
    expect(pythonTemplate.hooks).toBeDefined()
})

test('Go template has required structure', () => {
    expect(goTemplate.name).toBe('go')
    expect(goTemplate.description).toContain('Go')
    expect(goTemplate.dockerCompose).toContain('golang:1.21-alpine')
    expect(goTemplate.dockerCompose).toContain('postgres:15-alpine')
    expect(goTemplate.dockerCompose).toContain('redis:7-alpine')
    expect(goTemplate.env).toContain('DATABASE_URL')
    expect(goTemplate.variables).toBeDefined()
    expect(goTemplate.hooks).toBeDefined()
})

test('All templates have unique names', () => {
    const templates = [nodeTemplate, pythonTemplate, goTemplate]
    const names = templates.map(t => t.name)
    const uniqueNames = new Set(names)
    
    expect(uniqueNames.size).toBe(templates.length)
})

test('All templates have required variables', () => {
    const templates = [nodeTemplate, pythonTemplate, goTemplate]
    
    for (const template of templates) {
        expect(template.variables).toBeDefined()
        
        const variableNames = template.variables!.map(v => v.name)
        expect(variableNames).toContain('APP_PORT')
        expect(variableNames).toContain('DB_PORT')
        expect(variableNames).toContain('REDIS_PORT')
        expect(variableNames).toContain('DB_PASSWORD')
        
        // Check that secrets are generated
        const secrets = template.variables!.filter(v => v.generate === 'secret')
        expect(secrets.length).toBeGreaterThan(0)
    }
})

test('Node template generates valid files', async () => {
    const manager = new TemplateManager()
    const testDir = await mkdtemp(path.join(tmpdir(), 'node-template-test-'))
    
    try {
        const context = await manager.processTemplate(
            nodeTemplate,
            'test-node-stack',
            testDir,
            {}
        )
        
        // Test docker-compose interpolation
        const dockerCompose = manager.interpolateTemplate(nodeTemplate.dockerCompose, context.variables)
        expect(dockerCompose).toContain('${COMPOSE_PROJECT_NAME}-app')
        expect(dockerCompose).toContain('${COMPOSE_PROJECT_NAME}-db')
        expect(dockerCompose).toContain(`"${context.variables.APP_PORT}:3000"`)
        
        // Test env interpolation
        const env = manager.interpolateTemplate(nodeTemplate.env, context.variables)
        expect(env).toContain('COMPOSE_PROJECT_NAME=test-node-stack')
        expect(env).toContain(`APP_PORT=${context.variables.APP_PORT}`)
        expect(env).toContain('DB_NAME=test-node-stack_db')
        
        // Test package.json interpolation
        const packageJson = manager.interpolateTemplate(nodeTemplate.files!['package.json'], context.variables)
        const parsed = JSON.parse(packageJson)
        expect(parsed.name).toBe('test-node-stack')
        expect(parsed.dependencies).toHaveProperty('express')
        
        // Test index.js interpolation
        const indexJs = manager.interpolateTemplate(nodeTemplate.files!['src/index.js'], context.variables)
        expect(indexJs).toContain('Hello from test-node-stack!')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('Python template generates valid files', async () => {
    const manager = new TemplateManager()
    const testDir = await mkdtemp(path.join(tmpdir(), 'python-template-test-'))
    
    try {
        const context = await manager.processTemplate(
            pythonTemplate,
            'test-python-stack',
            testDir,
            {}
        )
        
        // Test requirements.txt
        const requirements = pythonTemplate.files!['requirements.txt']
        expect(requirements).toContain('fastapi')
        expect(requirements).toContain('uvicorn')
        expect(requirements).toContain('psycopg2-binary')
        expect(requirements).toContain('redis')
        
        // Test main.py interpolation
        const mainPy = manager.interpolateTemplate(pythonTemplate.files!['src/main.py'], context.variables)
        expect(mainPy).toContain('title="test-python-stack"')
        expect(mainPy).toContain('Hello from test-python-stack!')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('Go template generates valid files', async () => {
    const manager = new TemplateManager()
    const testDir = await mkdtemp(path.join(tmpdir(), 'go-template-test-'))
    
    try {
        const context = await manager.processTemplate(
            goTemplate,
            'test-go-stack',
            testDir,
            {}
        )
        
        // Test go.mod interpolation
        const goMod = manager.interpolateTemplate(goTemplate.files!['go.mod'], context.variables)
        expect(goMod).toContain('module test-go-stack')
        expect(goMod).toContain('github.com/gin-gonic/gin')
        expect(goMod).toContain('github.com/lib/pq')
        
        // Test main.go interpolation
        const mainGo = manager.interpolateTemplate(goTemplate.files!['main.go'], context.variables)
        expect(mainGo).toContain('Hello from test-go-stack!')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('Templates have valid hook configurations', () => {
    const templates = [nodeTemplate, pythonTemplate, goTemplate]
    
    for (const template of templates) {
        expect(template.hooks).toBeDefined()
        expect(template.hooks!.pre).toBeDefined()
        expect(template.hooks!.post).toBeDefined()
        
        // Check pre-hooks
        const preHooks = template.hooks!.pre!
        expect(preHooks.length).toBeGreaterThan(0)
        expect(preHooks[0].name).toBe('create-directories')
        expect(preHooks[0].command).toContain('mkdir')
        
        // Check post-hooks
        const postHooks = template.hooks!.post!
        expect(postHooks.length).toBeGreaterThan(0)
        
        if (template.name === 'node') {
            expect(postHooks.some(h => h.command.includes('npm install'))).toBe(true)
        } else if (template.name === 'python') {
            expect(postHooks.some(h => h.command.includes('python -m venv'))).toBe(true)
        } else if (template.name === 'go') {
            expect(postHooks.some(h => h.command.includes('go mod init'))).toBe(true)
        }
    }
})

test('Templates create required directories', () => {
    const templates = [nodeTemplate, pythonTemplate, goTemplate]
    
    for (const template of templates) {
        expect(template.directories).toBeDefined()
        expect(template.directories!.length).toBeGreaterThan(0)
        
        // All templates should have data directory for persistence
        expect(template.directories).toContain('data')
        
        // Most templates should have logs directory (except node in this case)
        if (template.name !== 'node') {
            expect(template.directories).toContain('logs')
        }
        
        if (template.name === 'node' || template.name === 'python') {
            expect(template.directories).toContain('src')
        }
    }
})