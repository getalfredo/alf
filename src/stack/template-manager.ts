import { StackTemplate, StackContext, StackVariable } from './types.ts'
import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export class TemplateManager {
    private templates: Map<string, StackTemplate> = new Map()

    registerTemplate(template: StackTemplate): void {
        this.templates.set(template.name, template)
    }

    getTemplate(name: string): StackTemplate | undefined {
        return this.templates.get(name)
    }

    listTemplates(): StackTemplate[] {
        return Array.from(this.templates.values())
    }

    async processTemplate(template: StackTemplate, stackName: string, stackDir: string, userVariables: Record<string, any> = {}): Promise<StackContext> {
        // Generate variables
        const variables = await this.generateVariables(template.variables || [], userVariables)
        variables.stackName = stackName
        variables.stackDir = stackDir

        const context: StackContext = {
            stackName,
            stackDir,
            variables,
            template
        }

        return context
    }

    private async generateVariables(templateVars: StackVariable[], userVars: Record<string, any>): Promise<Record<string, any>> {
        const variables: Record<string, any> = {}

        for (const templateVar of templateVars) {
            let value = userVars[templateVar.name]

            if (value === undefined) {
                if (templateVar.generate) {
                    value = this.generateValue(templateVar.generate)
                } else if (templateVar.default !== undefined) {
                    value = templateVar.default
                } else {
                    throw new Error(`Variable ${templateVar.name} is required but not provided`)
                }
            }

            // Type conversion
            if (templateVar.type === 'number' && typeof value === 'string') {
                value = parseInt(value, 10)
            } else if (templateVar.type === 'boolean' && typeof value === 'string') {
                value = value.toLowerCase() === 'true'
            }

            variables[templateVar.name] = value
        }

        return variables
    }

    private generateValue(type: 'uuid' | 'secret' | 'random'): string {
        switch (type) {
            case 'uuid':
                return uuidv4()
            case 'secret':
                return randomBytes(32).toString('hex')
            case 'random':
                return randomBytes(16).toString('base64url')
            default:
                throw new Error(`Unknown generation type: ${type}`)
        }
    }

    interpolateTemplate(template: string, variables: Record<string, any>): string {
        return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
            const value = variables[key]
            return value !== undefined ? String(value) : match
        })
    }
}