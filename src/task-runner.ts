import { spawn } from 'child_process'
import { ConfigParser } from './config-parser.ts'
import {
    type TaskExecution,
    TaskRunnerError,
    type ExecutionOptions,
    type TaskFile,
} from './types.ts'

export class TaskRunner {
    private configParser: ConfigParser
    private executions: Map<string, TaskExecution>

    constructor() {
        this.configParser = new ConfigParser()
        this.executions = new Map()
    }

    async run(options: ExecutionOptions): Promise<void> {
        const taskFile = await this.configParser.parseTaskFile(options.taskFile)
        const tasksToRun = this.configParser.resolveDependencyOrder(
            taskFile.tasks,
            options.tasks
        )

        console.log(`📋 Execution plan: ${tasksToRun.join(' → ')}`)
        console.log('')

        for (const taskName of tasksToRun) {
            const execution = await this.executeTask(
                taskName,
                taskFile,
                options
            )

            if (execution.status === 'failed' && !options.continueOnError) {
                throw new TaskRunnerError(
                    `Task '${taskName}' failed, stopping execution`,
                    taskName,
                    execution.exitCode
                )
            }

            if (execution.status === 'failed') {
                console.log(
                    `⚠️  Task '${taskName}' failed but continuing due to --continue-on-error`
                )
                console.log('')
            }
        }

        this.printSummary()
    }

    private async executeTask(
        taskName: string,
        taskFile: TaskFile,
        options: ExecutionOptions
    ): Promise<TaskExecution> {
        const task = taskFile.tasks[taskName]
        if (!task) {
            throw new TaskRunnerError(`Task '${taskName}' not found`)
        }

        const execution: TaskExecution = {
            taskName,
            config: task,
            status: 'pending',
            startTime: new Date(),
        }

        this.executions.set(taskName, execution)

        try {
            console.log(`🔄 Running task: ${taskName}`)
            if (task.name) {
                console.log(`   ${task.name}`)
            }

            // Check if dependencies succeeded
            if (task.depends_on) {
                for (const dep of task.depends_on) {
                    const depExecution = this.executions.get(dep)
                    if (depExecution?.status === 'failed') {
                        execution.status = 'skipped'
                        console.log(
                            `⏭️  Skipping '${taskName}' due to failed dependency '${dep}'`
                        )
                        console.log('')
                        return execution
                    }
                }
            }

            execution.status = 'running'

            // Prepare environment variables
            const env: Record<string, string> = {}

            // Add process.env with type safety
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined) {
                    env[key] = value
                }
            }

            // Add task file env
            if (taskFile.env) {
                Object.assign(env, taskFile.env)
            }

            // Add task-specific env
            if (task.env) {
                Object.assign(env, task.env)
            }

            // Interpolate variables in the command
            const interpolatedCommand = this.interpolateVariables(
                task.runs,
                env
            )

            if (options.verbose) {
                console.log(`   Command: ${interpolatedCommand}`)
                console.log(
                    `   Working dir: ${task.working_directory || process.cwd()}`
                )
            }

            const result = await this.runShellCommand(interpolatedCommand, {
                cwd: task.working_directory || process.cwd(),
                env,
            })

            execution.output = result.output
            execution.exitCode = result.exitCode
            execution.endTime = new Date()

            if (result.exitCode === 0) {
                execution.status = 'success'
                console.log(`✅ Task '${taskName}' completed successfully`)

                if (options.verbose && result.output) {
                    console.log('   Output:')
                    result.output.split('\n').forEach((line) => {
                        if (line.trim()) console.log(`     ${line}`)
                    })
                }
            } else {
                execution.status = 'failed'
                execution.error = result.error
                console.log(
                    `❌ Task '${taskName}' failed with exit code ${result.exitCode}`
                )

                if (result.error) {
                    console.log(`   Error: ${result.error}`)
                }
            }
        } catch (error) {
            execution.status = 'failed'
            execution.error =
                error instanceof Error ? error.message : String(error)
            execution.endTime = new Date()
            console.log(
                `❌ Task '${taskName}' failed: ${error instanceof Error ? error.message : String(error)}`
            )
        }

        console.log('')
        return execution
    }

    private async runShellCommand(
        command: string,
        options: { cwd: string; env: Record<string, string> }
    ): Promise<{ output: string; error: string; exitCode: number }> {
        return new Promise((resolve) => {
            // Use shell to execute the command
            const child = spawn('sh', ['-c', command], {
                cwd: options.cwd,
                env: options.env,
                stdio: ['inherit', 'pipe', 'pipe'],
            })

            let output = ''
            let error = ''

            child.stdout?.on('data', (data) => {
                const text = data.toString()
                output += text
                process.stdout.write(text)
            })

            child.stderr?.on('data', (data) => {
                const text = data.toString()
                error += text
                process.stderr.write(text)
            })

            child.on('close', (code) => {
                resolve({
                    output: output.trim(),
                    error: error.trim(),
                    exitCode: code || 0,
                })
            })

            child.on('error', (err) => {
                resolve({
                    output: output.trim(),
                    error: err.message,
                    exitCode: 1,
                })
            })
        })
    }

    private interpolateVariables(
        value: string,
        env: Record<string, string>
    ): string {
        return value.replace(
            /\$\{\{\s*(env|secrets)\.([A-Z_]+)\s*\}\}/g,
            (match, type, key) => {
                return env[key] || ''
            }
        )
    }

    private printSummary(): void {
        const executions = Array.from(this.executions.values())
        const successful = executions.filter(
            (e) => e.status === 'success'
        ).length
        const failed = executions.filter((e) => e.status === 'failed').length
        const skipped = executions.filter((e) => e.status === 'skipped').length

        console.log('📊 Execution Summary:')
        console.log(`   ✅ Successful: ${successful}`)
        console.log(`   ❌ Failed: ${failed}`)
        console.log(`   ⏭️  Skipped: ${skipped}`)

        if (failed > 0) {
            console.log('')
            console.log('Failed tasks:')
            executions
                .filter((e) => e.status === 'failed')
                .forEach((e) => {
                    const duration =
                        e.endTime && e.startTime
                            ? `${e.endTime.getTime() - e.startTime.getTime()}ms`
                            : 'unknown'
                    console.log(`   ❌ ${e.taskName} (${duration})`)
                })
        }
    }
}
