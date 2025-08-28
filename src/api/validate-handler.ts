import { BaseHandler } from './base-handler.ts'

export class ValidateHandler extends BaseHandler {
    async handle(req: Request): Promise<Response> {
        try {
            const body = await req.json()
            const { configFile } = body

            if (!configFile) {
                return this.createBadRequestResponse("configFile is required")
            }

            const taskFile = await this.configParser.parseTaskFile(configFile)
            
            return this.createSuccessResponse({
                valid: true,
                taskCount: Object.keys(taskFile.tasks).length,
                tasks: Object.keys(taskFile.tasks)
            })
        } catch (error) {
            return new Response(JSON.stringify({
                valid: false,
                error: error instanceof Error ? error.message : String(error)
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }
    }
}