import { spawn } from 'child_process'
import { ConfigParser } from './parser/config-parser.ts'
import {
    type TaskExecution,
    TaskRunnerError,
    type ExecutionOptions,
    type TaskFile,
} from './types.ts'
import * as path from 'path'

export class TaskRunner {
    private configParser: ConfigParser
    private executions: Map<string, TaskExecution>
    private logFilePath: string | null = null

    constructor() {
        this.configParser = new ConfigParser()
        this.executions = new Map()
    }

    async run(options: ExecutionOptions): Promise<void> {
        const taskFile = await this.configParser.parseTaskFile(options.taskFile)
        
        // Setup log file
        this.setupLogFile(options.taskFile)
        
        const tasksToRun = this.configParser.resolveDependencyOrder(
            taskFile.tasks,
            options.tasks
        )

        const planMessage = `📋 Execution plan: ${tasksToRun.join(' → ')}`
        console.log(planMessage)
        this.writeToLog(planMessage)
        console.log('')
        this.writeToLog('')

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
                const failMessage = `⚠️  Task '${taskName}' failed but continuing due to --continue-on-error`
                console.log(failMessage)
                this.writeToLog(failMessage)
                console.log('')
                this.writeToLog('')
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
            const runMessage = `🔄 Running task: ${taskName}`
            console.log(runMessage)
            this.writeToLog(runMessage)
            if (task.name) {
                const nameMessage = `   ${task.name}`
                console.log(nameMessage)
                this.writeToLog(nameMessage)
            }

            // Check if dependencies succeeded
            if (task.depends_on) {
                for (const dep of task.depends_on) {
                    const depExecution = this.executions.get(dep)
                    if (depExecution?.status === 'failed') {
                        execution.status = 'skipped'
                        const skipMessage = `⏭️  Skipping '${taskName}' due to failed dependency '${dep}'`
                        console.log(skipMessage)
                        this.writeToLog(skipMessage)
                        console.log('')
                        this.writeToLog('')
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
                const cmdMessage = `   Command: ${interpolatedCommand}`
                const dirMessage = `   Working dir: ${task.working_directory || process.cwd()}`
                console.log(cmdMessage)
                this.writeToLog(cmdMessage)
                console.log(dirMessage)
                this.writeToLog(dirMessage)
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
                const successMessage = `✅ Task '${taskName}' completed successfully`
                console.log(successMessage)
                this.writeToLog(successMessage)

                if (options.verbose && result.output) {
                    const outputHeader = '   Output:'
                    console.log(outputHeader)
                    this.writeToLog(outputHeader)
                    result.output.split('\n').forEach((line) => {
                        if (line.trim()) {
                            const outputLine = `     ${line}`
                            console.log(outputLine)
                            this.writeToLog(outputLine)
                        }
                    })
                }
            } else {
                execution.status = 'failed'
                execution.error = result.error
                const failMessage = `❌ Task '${taskName}' failed with exit code ${result.exitCode}`
                console.log(failMessage)
                this.writeToLog(failMessage)

                if (result.error) {
                    const errorMessage = `   Error: ${result.error}`
                    console.log(errorMessage)
                    this.writeToLog(errorMessage)
                }
            }
        } catch (error) {
            execution.status = 'failed'
            execution.error =
                error instanceof Error ? error.message : String(error)
            execution.endTime = new Date()
            const errorMessage = `❌ Task '${taskName}' failed: ${error instanceof Error ? error.message : String(error)}`
            console.log(errorMessage)
            this.writeToLog(errorMessage)
        }

        console.log('')
        this.writeToLog('')
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
                this.writeToLog(text.trim(), false)
            })

            child.stderr?.on('data', (data) => {
                const text = data.toString()
                error += text
                process.stderr.write(text)
                this.writeToLog(text.trim(), false)
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

        const summaryHeader = '📊 Execution Summary:'
        const successLine = `   ✅ Successful: ${successful}`
        const failedLine = `   ❌ Failed: ${failed}`
        const skippedLine = `   ⏭️  Skipped: ${skipped}`
        
        console.log(summaryHeader)
        this.writeToLog(summaryHeader)
        console.log(successLine)
        this.writeToLog(successLine)
        console.log(failedLine)
        this.writeToLog(failedLine)
        console.log(skippedLine)
        this.writeToLog(skippedLine)

        if (failed > 0) {
            console.log('')
            this.writeToLog('')
            const failedTasksHeader = 'Failed tasks:'
            console.log(failedTasksHeader)
            this.writeToLog(failedTasksHeader)
            executions
                .filter((e) => e.status === 'failed')
                .forEach((e) => {
                    const duration =
                        e.endTime && e.startTime
                            ? `${e.endTime.getTime() - e.startTime.getTime()}ms`
                            : 'unknown'
                    const failedTaskLine = `   ❌ ${e.taskName} (${duration})`
                    console.log(failedTaskLine)
                    this.writeToLog(failedTaskLine)
                })
        }
        
        if (this.logFilePath) {
            console.log('')
            console.log(`📝 Log written to: ${this.logFilePath}`)
        }
    }

    private setupLogFile(taskFilePath: string): void {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hour = String(now.getHours()).padStart(2, '0')
        const minute = String(now.getMinutes()).padStart(2, '0')
        const second = String(now.getSeconds()).padStart(2, '0')
        
        const timestamp = `${year}${month}${day}-${hour}${minute}${second}`
        const taskFileDir = path.dirname(taskFilePath)
        this.logFilePath = path.join(taskFileDir, `run-log-${timestamp}.log`)
        
        // Write initial header to log file
        const header = `=== Task Runner Log - ${now.toISOString()} ===\nTask file: ${taskFilePath}\n\n`
        try {
            const fs = require('fs')
            fs.writeFileSync(this.logFilePath, header)
        } catch (error) {
            console.warn(`⚠️  Could not create log file: ${this.logFilePath}`)
            this.logFilePath = null
        }
    }

    private writeToLog(message: string, addNewline: boolean = true): void {
        if (!this.logFilePath || !message.trim()) return
        
        const logMessage = addNewline ? message + '\n' : message + '\n'
        
        try {
            // Use synchronous file append for consistency
            const fs = require('fs')
            fs.appendFileSync(this.logFilePath, logMessage)
        } catch (error) {
            // Silently fail to avoid disrupting task execution
        }
    }
}
