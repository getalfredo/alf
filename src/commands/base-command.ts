import { TaskRunner } from '../task-runner.ts'
import { ConfigParser } from '../parser/config-parser.ts'

export abstract class BaseCommand {
    protected taskRunner: TaskRunner
    protected configParser: ConfigParser

    constructor() {
        this.taskRunner = new TaskRunner()
        this.configParser = new ConfigParser()
    }

    abstract execute(...args: any[]): Promise<void>
}