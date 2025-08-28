import { BaseCommand } from './base-command.ts'

export class RunCommand extends BaseCommand {
    async execute(configFile: string, options: any): Promise<void> {
        console.log(`🚀 Running tasks from ${configFile}`)

        const tasks = options.task ? options.task.split(',').map((t: string) => t.trim()) : undefined

        const runOptions = {
            taskFile: configFile,
            tasks,
            continueOnError: options.continueOnError,
            verbose: options.verbose,
        }

        await this.taskRunner.run(runOptions)
    }
}