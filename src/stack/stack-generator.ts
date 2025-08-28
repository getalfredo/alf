import { TemplateManager } from './template-manager.ts'
import { HookRunner } from './hook-runner.ts'
import { StackContext } from './types.ts'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'

export class StackGenerator {
    private templateManager: TemplateManager
    private hookRunner: HookRunner

    constructor() {
        this.templateManager = new TemplateManager()
        this.hookRunner = new HookRunner()
    }

    getTemplateManager(): TemplateManager {
        return this.templateManager
    }

    async generateStack(
        templateName: string, 
        stackName: string, 
        userVariables: Record<string, any> = {}
    ): Promise<void> {
        const template = this.templateManager.getTemplate(templateName)
        if (!template) {
            throw new Error(`Template "${templateName}" not found`)
        }

        const stacksDir = path.join(os.homedir(), 'stacks')
        const stackDir = path.join(stacksDir, stackName)

        // Create stack directory
        await mkdir(stackDir, { recursive: true })

        // Process template and get context
        const context = await this.templateManager.processTemplate(
            template, 
            stackName, 
            stackDir, 
            userVariables
        )

        console.log(`📦 Creating stack "${stackName}" using template "${templateName}"`)

        // Run pre-hooks
        if (template.hooks?.pre) {
            console.log(`🔄 Running pre-creation hooks...`)
            await this.hookRunner.runHooks(template.hooks.pre, context)
        }

        // Create directories
        if (template.directories) {
            for (const dir of template.directories) {
                const dirPath = path.join(stackDir, dir)
                await mkdir(dirPath, { recursive: true })
                console.log(`📁 Created directory: ${dir}`)
            }
        }

        // Generate main files
        await this.generateFiles(context)

        // Generate additional files
        if (template.files) {
            for (const [fileName, content] of Object.entries(template.files)) {
                const filePath = path.join(stackDir, fileName)
                const interpolatedContent = this.templateManager.interpolateTemplate(content, context.variables)
                
                // Ensure directory exists for nested files
                const fileDir = path.dirname(filePath)
                await mkdir(fileDir, { recursive: true })
                
                await writeFile(filePath, interpolatedContent, 'utf8')
                console.log(`📄 Created file: ${fileName}`)
            }
        }

        // Run post-hooks
        if (template.hooks?.post) {
            console.log(`🔄 Running post-creation hooks...`)
            await this.hookRunner.runHooks(template.hooks.post, context)
        }

        console.log(`✅ Stack "${stackName}" created successfully at ${stackDir}`)
        this.printUsageInstructions(context)
    }

    private async generateFiles(context: StackContext): Promise<void> {
        const { stackDir, template, variables } = context

        // Generate docker-compose.yml
        const dockerComposePath = path.join(stackDir, 'docker-compose.yml')
        const dockerComposeContent = this.templateManager.interpolateTemplate(template.dockerCompose, variables)
        await writeFile(dockerComposePath, dockerComposeContent, 'utf8')
        console.log(`📄 Created file: docker-compose.yml`)

        // Generate .env
        const envPath = path.join(stackDir, '.env')
        const envContent = this.templateManager.interpolateTemplate(template.env, variables)
        await writeFile(envPath, envContent, 'utf8')
        console.log(`📄 Created file: .env`)
    }

    private printUsageInstructions(context: StackContext): void {
        const { stackDir, template } = context
        
        console.log(`\n📋 Usage Instructions:`)
        console.log(`   cd ${stackDir}`)
        console.log(`   docker-compose up -d`)
        console.log(``)
        
        if (template.name === 'node') {
            console.log(`🟢 Node.js specific:`)
            console.log(`   npm run dev    # Start development server`)
            console.log(`   npm start      # Start production server`)
        } else if (template.name === 'python') {
            console.log(`🐍 Python specific:`)
            console.log(`   source venv/bin/activate    # Activate virtual environment`)
            console.log(`   uvicorn src.main:app --reload --port 8000`)
        } else if (template.name === 'go') {
            console.log(`🐹 Go specific:`)
            console.log(`   go run main.go    # Start development server`)
            console.log(`   go build -o app && ./app    # Build and run`)
        }
        
        console.log(``)
        console.log(`🔗 Access your application at: http://localhost:${context.variables.APP_PORT}`)
    }
}