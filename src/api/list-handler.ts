import { BaseHandler } from './base-handler.ts'

export class ListHandler extends BaseHandler {
    async handle(req: Request): Promise<Response> {
        try {
            const body = await req.json()
            const { configFile } = body

            if (!configFile) {
                return this.createBadRequestResponse("configFile is required")
            }

            const taskFile = await this.configParser.parseTaskFile(configFile)
            
            const tasks = Object.entries(taskFile.tasks).map(([name, config]) => ({
                name,
                description: config.name,
                dependencies: config.depends_on || []
            }))

            return this.createSuccessResponse({
                configFile,
                tasks
            })
        } catch (error) {
            return this.createErrorResponse(error)
        }
    }
}