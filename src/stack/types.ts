export interface StackTemplate {
    name: string
    description: string
    dockerCompose: string
    env: string
    files?: Record<string, string>
    directories?: string[]
    hooks?: StackHooks
    variables?: StackVariable[]
}

export interface StackHooks {
    pre?: StackCommand[]
    post?: StackCommand[]
}

export interface StackCommand {
    name: string
    command: string
    description?: string
    workingDir?: string
}

export interface StackVariable {
    name: string
    description: string
    default?: string
    type: 'string' | 'number' | 'boolean' | 'secret'
    generate?: 'uuid' | 'secret' | 'random'
}

export interface StackContext {
    stackName: string
    stackDir: string
    variables: Record<string, any>
    template: StackTemplate
}