import { TaskRunner } from '../task-runner.ts'
import { ConfigParser } from '../parser/config-parser.ts'

export abstract class BaseHandler {
    protected taskRunner: TaskRunner
    protected configParser: ConfigParser

    constructor(taskRunner: TaskRunner, configParser: ConfigParser) {
        this.taskRunner = taskRunner
        this.configParser = configParser
    }

    protected createErrorResponse(error: unknown, status = 500): Response {
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
        }), {
            status,
            headers: { "Content-Type": "application/json" }
        })
    }

    protected createSuccessResponse(data: any): Response {
        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" }
        })
    }

    protected createBadRequestResponse(message: string): Response {
        return new Response(JSON.stringify({
            error: message
        }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        })
    }
}