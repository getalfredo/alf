import { BaseCommand } from './base-command.ts'
import { StackGenerator } from '../stack/stack-generator.ts'
import { nodeTemplate, pythonTemplate, goTemplate } from '../stack/templates/index.ts'

export class StackCommand extends BaseCommand {
    private stackGenerator: StackGenerator

    constructor() {
        super()
        this.stackGenerator = new StackGenerator()
        this.registerBuiltinTemplates()
    }

    private registerBuiltinTemplates(): void {
        const templateManager = this.stackGenerator.getTemplateManager()
        templateManager.registerTemplate(nodeTemplate)
        templateManager.registerTemplate(pythonTemplate)
        templateManager.registerTemplate(goTemplate)
    }

    async execute(stackName: string, options: { template?: string, list?: boolean } = {}): Promise<void> {
        if (options.list) {
            return this.listTemplates()
        }

        if (!stackName) {
            throw new Error('Stack name is required')
        }

        const templateName = options.template || 'node'
        
        try {
            await this.stackGenerator.generateStack(templateName, stackName)
        } catch (error) {
            throw new Error(`Failed to create stack: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    private listTemplates(): void {
        const templateManager = this.stackGenerator.getTemplateManager()
        const templates = templateManager.listTemplates()
        
        console.log(`📋 Available stack templates:`)
        console.log()
        
        for (const template of templates) {
            console.log(`🔹 ${template.name}`)
            console.log(`   ${template.description}`)
            console.log()
        }
        
        console.log(`Usage: alf stack <stack-name> --template <template-name>`)
        console.log(`Example: alf stack my-api --template python`)
    }
}