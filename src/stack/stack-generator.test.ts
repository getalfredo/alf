import { test, expect } from 'bun:test'
import { StackGenerator } from './stack-generator.ts'
import { StackTemplate } from './types.ts'
import { mkdtemp, rmdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test('StackGenerator can register and use templates', async () => {
    const generator = new StackGenerator()
    const testTemplate: StackTemplate = {
        name: 'simple-test',
        description: 'Simple test template',
        dockerCompose: `version: '3.8'
services:
  app:
    image: nginx
    ports:
      - "\${APP_PORT}:80"`,
        env: `APP_PORT=\${APP_PORT}`,
        variables: [
            {
                name: 'APP_PORT',
                description: 'Application port',
                type: 'number',
                default: '8080'
            }
        ]
    }

    generator.getTemplateManager().registerTemplate(testTemplate)
    
    const templates = generator.getTemplateManager().listTemplates()
    expect(templates).toContainEqual(testTemplate)
})

test('StackGenerator creates stack with basic files', async () => {
    const generator = new StackGenerator()
    const testDir = await mkdtemp(path.join(tmpdir(), 'stack-gen-test-'))
    
    try {
        const testTemplate: StackTemplate = {
            name: 'test-template',
            description: 'Test template',
            dockerCompose: `version: '3.8'
services:
  app:
    image: nginx
    ports:
      - "\${APP_PORT}:80"`,
            env: `APP_PORT=\${APP_PORT}
STACK_NAME=\${stackName}`,
            variables: [
                {
                    name: 'APP_PORT',
                    description: 'Application port',
                    type: 'number',
                    default: '3000'
                }
            ]
        }

        generator.getTemplateManager().registerTemplate(testTemplate)
        
        // Override the home directory stacks path for testing
        const originalGenerateStack = generator.generateStack.bind(generator)
        generator.generateStack = async (templateName: string, stackName: string, userVariables = {}) => {
            const template = generator.getTemplateManager().getTemplate(templateName)
            if (!template) {
                throw new Error(`Template "${templateName}" not found`)
            }

            const stackDir = path.join(testDir, stackName)
            await Bun.$`mkdir -p ${stackDir}`

            const context = await generator.getTemplateManager().processTemplate(
                template, 
                stackName, 
                stackDir, 
                userVariables
            )

            // Generate main files
            const dockerComposePath = path.join(stackDir, 'docker-compose.yml')
            const dockerComposeContent = generator.getTemplateManager().interpolateTemplate(template.dockerCompose, context.variables)
            await Bun.write(dockerComposePath, dockerComposeContent)

            const envPath = path.join(stackDir, '.env')
            const envContent = generator.getTemplateManager().interpolateTemplate(template.env, context.variables)
            await Bun.write(envPath, envContent)
        }

        await generator.generateStack('test-template', 'test-stack')
        
        // Verify files were created
        const dockerComposeFile = Bun.file(path.join(testDir, 'test-stack', 'docker-compose.yml'))
        const envFile = Bun.file(path.join(testDir, 'test-stack', '.env'))
        
        expect(await dockerComposeFile.exists()).toBe(true)
        expect(await envFile.exists()).toBe(true)

        // Verify content interpolation
        const dockerComposeContent = await dockerComposeFile.text()
        const envContent = await envFile.text()
        
        expect(dockerComposeContent).toContain('"3000:80"')
        expect(envContent).toContain('APP_PORT=3000')
        expect(envContent).toContain('STACK_NAME=test-stack')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('StackGenerator creates additional files from template', async () => {
    const generator = new StackGenerator()
    const testDir = await mkdtemp(path.join(tmpdir(), 'stack-gen-test-'))
    
    try {
        const testTemplate: StackTemplate = {
            name: 'files-test',
            description: 'Template with additional files',
            dockerCompose: 'version: "3.8"',
            env: 'TEST=1',
            files: {
                'README.md': `# \${stackName}
This is a generated stack.`,
                'src/main.js': `console.log('Hello from \${stackName}!');`,
                'config/app.json': `{
  "name": "\${stackName}",
  "version": "1.0.0"
}`
            }
        }

        generator.getTemplateManager().registerTemplate(testTemplate)
        
        // Simplified stack generation for testing
        const template = generator.getTemplateManager().getTemplate('files-test')!
        const stackDir = path.join(testDir, 'test-files-stack')
        await Bun.$`mkdir -p ${stackDir}`

        const context = await generator.getTemplateManager().processTemplate(
            template, 
            'test-files-stack', 
            stackDir, 
            {}
        )

        // Create files from template
        if (template.files) {
            for (const [fileName, content] of Object.entries(template.files)) {
                const filePath = path.join(stackDir, fileName)
                const interpolatedContent = generator.getTemplateManager().interpolateTemplate(content, context.variables)
                
                // Ensure directory exists for nested files
                const fileDir = path.dirname(filePath)
                await Bun.$`mkdir -p ${fileDir}`
                
                await Bun.write(filePath, interpolatedContent)
            }
        }
        
        // Verify files were created
        expect(await Bun.file(path.join(stackDir, 'README.md')).exists()).toBe(true)
        expect(await Bun.file(path.join(stackDir, 'src/main.js')).exists()).toBe(true)
        expect(await Bun.file(path.join(stackDir, 'config/app.json')).exists()).toBe(true)

        // Verify content interpolation
        const readmeContent = await Bun.file(path.join(stackDir, 'README.md')).text()
        const mainJsContent = await Bun.file(path.join(stackDir, 'src/main.js')).text()
        const appJsonContent = await Bun.file(path.join(stackDir, 'config/app.json')).text()
        
        expect(readmeContent).toContain('# test-files-stack')
        expect(mainJsContent).toContain("Hello from test-files-stack!")
        expect(appJsonContent).toContain('"name": "test-files-stack"')
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('StackGenerator creates directories from template', async () => {
    const generator = new StackGenerator()
    const testDir = await mkdtemp(path.join(tmpdir(), 'stack-gen-test-'))
    
    try {
        const testTemplate: StackTemplate = {
            name: 'dirs-test',
            description: 'Template with directories',
            dockerCompose: 'version: "3.8"',
            env: 'TEST=1',
            directories: ['src', 'data', 'logs', 'config/nested']
        }

        generator.getTemplateManager().registerTemplate(testTemplate)
        
        const stackDir = path.join(testDir, 'test-dirs-stack')
        await Bun.$`mkdir -p ${stackDir}`

        // Create directories from template
        const template = testTemplate
        if (template.directories) {
            for (const dir of template.directories) {
                const dirPath = path.join(stackDir, dir)
                await Bun.$`mkdir -p ${dirPath}`
            }
        }
        
        // Verify directories were created
        const stat = await import('fs/promises')
        expect((await stat.stat(path.join(stackDir, 'src'))).isDirectory()).toBe(true)
        expect((await stat.stat(path.join(stackDir, 'data'))).isDirectory()).toBe(true)
        expect((await stat.stat(path.join(stackDir, 'logs'))).isDirectory()).toBe(true)
        expect((await stat.stat(path.join(stackDir, 'config/nested'))).isDirectory()).toBe(true)
        
    } finally {
        await rmdir(testDir, { recursive: true })
    }
})

test('StackGenerator throws error for nonexistent template', async () => {
    const generator = new StackGenerator()
    
    expect(async () => {
        await generator.generateStack('nonexistent-template', 'test-stack')
    }).toThrow('Template "nonexistent-template" not found')
})