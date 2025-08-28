import { BaseCommand } from './base-command.ts'

export class ListCommand extends BaseCommand {
    async execute(configFile: string): Promise<void> {
        const taskFile = await this.configParser.parseTaskFile(configFile)

        console.log(`📋 Tasks in ${configFile}:`)
        console.log('')

        for (const [taskName, config] of Object.entries(taskFile.tasks)) {
            console.log(`  ${taskName}`)
            if (config.name) {
                console.log(`    📝 ${config.name}`)
            }
            if (config.depends_on && config.depends_on.length > 0) {
                console.log(
                    `    📦 Depends on: ${config.depends_on.join(', ')}`
                )
            }
            console.log('')
        }
    }
}