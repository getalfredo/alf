import { BaseCommand } from './base-command.ts'

export class ValidateCommand extends BaseCommand {
    async execute(configFile: string): Promise<void> {
        console.log(`🔍 Validating ${configFile}`)

        try {
            const taskFile = await this.configParser.parseTaskFile(configFile)
            console.log(`✅ Configuration is valid`)
            console.log(
                `   Found ${Object.keys(taskFile.tasks).length} task(s)`
            )
        } catch (error) {
            console.log(
                `❌ Configuration is invalid: ${error instanceof Error ? error.message : String(error)}`
            )
            process.exit(1)
        }
    }
}