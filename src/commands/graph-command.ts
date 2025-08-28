import { BaseCommand } from './base-command.ts'

export class GraphCommand extends BaseCommand {
    async execute(configFile: string): Promise<void> {
        const taskFile = await this.configParser.parseTaskFile(configFile)

        console.log(`🔗 Dependency graph for ${configFile}:`)
        console.log('')

        const executionOrder = this.configParser.resolveDependencyOrder(
            taskFile.tasks
        )
        if (!executionOrder) {
            console.log('No tasks to display')
            return
        }

        console.log('Execution order:')
        executionOrder.forEach((task, index) => {
            console.log(`  ${index + 1}. ${task}`)
            const deps = taskFile.tasks[task].depends_on
            if (deps && deps.length > 0) {
                console.log(`     └─ depends on: ${deps.join(', ')}`)
            }
        })
    }
}