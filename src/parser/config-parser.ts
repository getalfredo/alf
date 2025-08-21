import { type TaskFile, type TaskConfig, TaskRunnerError } from '../types.ts'
import * as yaml from 'js-yaml'

export class ConfigParser {
    private interpolateVariables(
        value: string,
        env: Record<string, string>,
        secrets: Record<string, string> = {}
    ): string {
        return value.replace(
            /\$\{\{\s*(env|secrets)\.([A-Z_]+)\s*\}\}/g,
            (match, type, key) => {
                if (type === 'env') {
                    return env[key] || process.env[key] || ''
                } else if (type === 'secrets') {
                    return secrets[key] || process.env[key] || ''
                }
                return match
            }
        )
    }

    async parseTaskFile(filePath: string): Promise<TaskFile> {
        try {
            const file = Bun.file(filePath)
            const content = await file.text()

            // Use js-yaml library for proper YAML parsing
            const taskFile = yaml.load(content) as TaskFile

            this.validateTaskFile(taskFile)
            return taskFile
        } catch (error) {
            throw new TaskRunnerError(
                `Failed to parse task file: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }


    private validateTaskFile(taskFile: TaskFile): void {
        if (!taskFile.tasks || Object.keys(taskFile.tasks).length === 0) {
            throw new TaskRunnerError('No tasks defined in configuration file')
        }

        for (const [taskName, config] of Object.entries(taskFile.tasks)) {
            this.validateTask(taskName, config)
        }

        // Check for circular dependencies
        this.checkCircularDependencies(taskFile.tasks)
    }

    private validateTask(taskName: string, config: TaskConfig): void {
        if (!config.runs || config.runs.trim() === '') {
            throw new TaskRunnerError(
                `Task '${taskName}' is missing required 'runs' field`
            )
        }

        if (config.depends_on) {
            if (!Array.isArray(config.depends_on)) {
                throw new TaskRunnerError(
                    `Task '${taskName}' depends_on must be an array`
                )
            }
        }
    }

    private checkCircularDependencies(tasks: Record<string, TaskConfig>): void {
        const visited = new Set<string>()
        const visiting = new Set<string>()

        const visit = (taskName: string): void => {
            if (visiting.has(taskName)) {
                throw new TaskRunnerError(
                    `Circular dependency detected involving task '${taskName}'`
                )
            }
            if (visited.has(taskName)) {
                return
            }

            visiting.add(taskName)
            const task = tasks[taskName]

            if (task.depends_on) {
                for (const dep of task.depends_on) {
                    if (!tasks[dep]) {
                        throw new TaskRunnerError(
                            `Task '${taskName}' depends on unknown task '${dep}'`
                        )
                    }
                    visit(dep)
                }
            }

            visiting.delete(taskName)
            visited.add(taskName)
        }

        for (const taskName of Object.keys(tasks)) {
            if (!visited.has(taskName)) {
                visit(taskName)
            }
        }
    }

    resolveDependencyOrder(
        tasks: Record<string, TaskConfig>,
        requestedTasks?: string[]
    ): string[] {
        const allTasks = requestedTasks || Object.keys(tasks)
        const resolved: string[] = []
        const visited = new Set<string>()

        const visit = (taskName: string): void => {
            if (visited.has(taskName)) {
                return
            }

            visited.add(taskName)
            const task = tasks[taskName]

            if (task.depends_on) {
                for (const dep of task.depends_on) {
                    visit(dep)
                }
            }

            if (!resolved.includes(taskName)) {
                resolved.push(taskName)
            }
        }

        for (const taskName of allTasks) {
            if (!tasks[taskName]) {
                throw new TaskRunnerError(`Unknown task: ${taskName}`)
            }
            visit(taskName)
        }

        return resolved.filter(
            (task) =>
                allTasks.includes(task) ||
                allTasks.some((requestedTask) =>
                    this.isDependency(tasks, requestedTask, task)
                )
        )
    }

    private isDependency(
        tasks: Record<string, TaskConfig>,
        taskName: string,
        potentialDep: string
    ): boolean {
        const task = tasks[taskName]
        if (!task.depends_on) return false

        if (task.depends_on.includes(potentialDep)) return true

        return task.depends_on.some((dep) =>
            this.isDependency(tasks, dep, potentialDep)
        )
    }
}
