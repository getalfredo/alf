import { BaseCommand } from './base-command.ts'
import { ApiServer } from '../api/server.ts'

export class ServeCommand extends BaseCommand {
    async execute(options: any): Promise<void> {
        const port = parseInt(options.port)
        const host = options.host

        console.log(`🌐 Starting HTTP API server on ${host}:${port}`)

        const server = new ApiServer(this.taskRunner, this.configParser)
        await server.start(host, port)
    }
}