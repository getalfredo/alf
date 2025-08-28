import { test, expect } from 'bun:test'
import { TemplateManager } from './template-manager.ts'
import { StackTemplate } from './types.ts'

test('TemplateManager can register and retrieve templates', () => {
    const manager = new TemplateManager()
    const testTemplate: StackTemplate = {
        name: 'test',
        description: 'Test template',
        dockerCompose: 'version: "3.8"',
        env: 'TEST=value'
    }

    manager.registerTemplate(testTemplate)
    
    expect(manager.getTemplate('test')).toEqual(testTemplate)
    expect(manager.getTemplate('nonexistent')).toBeUndefined()
})

test('TemplateManager lists all registered templates', () => {
    const manager = new TemplateManager()
    const template1: StackTemplate = {
        name: 'node',
        description: 'Node.js template',
        dockerCompose: 'version: "3.8"',
        env: 'NODE_ENV=development'
    }
    const template2: StackTemplate = {
        name: 'python',
        description: 'Python template',
        dockerCompose: 'version: "3.8"',
        env: 'PYTHON_ENV=development'
    }

    manager.registerTemplate(template1)
    manager.registerTemplate(template2)
    
    const templates = manager.listTemplates()
    expect(templates).toHaveLength(2)
    expect(templates).toContainEqual(template1)
    expect(templates).toContainEqual(template2)
})

test('TemplateManager interpolates template strings', () => {
    const manager = new TemplateManager()
    const template = 'Hello ${name}, your port is ${port}'
    const variables = { name: 'world', port: '3000' }
    
    const result = manager.interpolateTemplate(template, variables)
    
    expect(result).toBe('Hello world, your port is 3000')
})

test('TemplateManager handles missing variables in interpolation', () => {
    const manager = new TemplateManager()
    const template = 'Hello ${name}, your port is ${missing}'
    const variables = { name: 'world' }
    
    const result = manager.interpolateTemplate(template, variables)
    
    expect(result).toBe('Hello world, your port is ${missing}')
})

test('TemplateManager generates variables correctly', async () => {
    const manager = new TemplateManager()
    const template: StackTemplate = {
        name: 'test',
        description: 'Test template',
        dockerCompose: '',
        env: '',
        variables: [
            {
                name: 'TEST_SECRET',
                description: 'Test secret',
                type: 'secret',
                generate: 'secret'
            },
            {
                name: 'TEST_UUID',
                description: 'Test UUID',
                type: 'string',
                generate: 'uuid'
            },
            {
                name: 'TEST_DEFAULT',
                description: 'Test with default',
                type: 'string',
                default: 'default-value'
            },
            {
                name: 'TEST_PROVIDED',
                description: 'Test provided value',
                type: 'string'
            }
        ]
    }

    const context = await manager.processTemplate(
        template, 
        'test-stack', 
        '/tmp/test',
        { TEST_PROVIDED: 'user-provided' }
    )

    expect(context.variables.stackName).toBe('test-stack')
    expect(context.variables.stackDir).toBe('/tmp/test')
    expect(context.variables.TEST_SECRET).toBeDefined()
    expect(context.variables.TEST_SECRET).toHaveLength(64) // 32 bytes in hex
    expect(context.variables.TEST_UUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(context.variables.TEST_DEFAULT).toBe('default-value')
    expect(context.variables.TEST_PROVIDED).toBe('user-provided')
})

test('TemplateManager throws error for required missing variables', async () => {
    const manager = new TemplateManager()
    const template: StackTemplate = {
        name: 'test',
        description: 'Test template',
        dockerCompose: '',
        env: '',
        variables: [
            {
                name: 'REQUIRED_VAR',
                description: 'Required variable',
                type: 'string'
            }
        ]
    }

    expect(async () => {
        await manager.processTemplate(template, 'test-stack', '/tmp/test', {})
    }).toThrow('Variable REQUIRED_VAR is required but not provided')
})

test('TemplateManager converts variable types correctly', async () => {
    const manager = new TemplateManager()
    const template: StackTemplate = {
        name: 'test',
        description: 'Test template',
        dockerCompose: '',
        env: '',
        variables: [
            {
                name: 'NUMBER_VAR',
                description: 'Number variable',
                type: 'number'
            },
            {
                name: 'BOOLEAN_VAR',
                description: 'Boolean variable',
                type: 'boolean'
            }
        ]
    }

    const context = await manager.processTemplate(
        template, 
        'test-stack', 
        '/tmp/test',
        { NUMBER_VAR: '42', BOOLEAN_VAR: 'true' }
    )

    expect(context.variables.NUMBER_VAR).toBe(42)
    expect(context.variables.BOOLEAN_VAR).toBe(true)
})

test('TemplateManager generates different random values', () => {
    const manager = new TemplateManager()
    
    // Test secret generation
    const secret1 = manager['generateValue']('secret')
    const secret2 = manager['generateValue']('secret')
    expect(secret1).not.toBe(secret2)
    expect(secret1).toHaveLength(64)
    
    // Test UUID generation
    const uuid1 = manager['generateValue']('uuid')
    const uuid2 = manager['generateValue']('uuid')
    expect(uuid1).not.toBe(uuid2)
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    
    // Test random generation
    const random1 = manager['generateValue']('random')
    const random2 = manager['generateValue']('random')
    expect(random1).not.toBe(random2)
})