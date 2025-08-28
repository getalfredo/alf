import { StackCommand, StackContext } from './types.ts'
import { spawn } from 'child_process'
import path from 'path'

export class HookRunner {
    async runHooks(commands: StackCommand[], context: StackContext): Promise<void> {
        for (const command of commands) {
            console.log(`🔄 Running: ${command.name}`)
            if (command.description) {
                console.log(`   ${command.description}`)
            }
            
            await this.runCommand(command, context)
            console.log(`✅ Completed: ${command.name}`)
        }
    }

    private async runCommand(command: StackCommand, context: StackContext): Promise<void> {
        return new Promise((resolve, reject) => {
            const workingDir = command.workingDir ? 
                path.resolve(context.stackDir, command.workingDir) : 
                context.stackDir

            // Interpolate variables in command
            const interpolatedCommand = this.interpolateCommand(command.command, context.variables)
            
            // Split command into program and args
            const [program, ...args] = interpolatedCommand.split(' ')

            const child = spawn(program, args, {
                cwd: workingDir,
                stdio: 'inherit',
                shell: true
            })

            child.on('close', (code) => {
                if (code === 0) {
                    resolve()
                } else {
                    reject(new Error(`Command "${command.name}" failed with exit code ${code}`))
                }
            })

            child.on('error', (error) => {
                reject(new Error(`Failed to run command "${command.name}": ${error.message}`))
            })
        })
    }

    private interpolateCommand(command: string, variables: Record<string, any>): string {
        return command.replace(/\$\{([^}]+)\}/g, (match, key) => {
            const value = variables[key]
            return value !== undefined ? String(value) : match
        })
    }
}