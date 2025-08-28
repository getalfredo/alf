import { BaseHandler } from './base-handler.ts'

export class GraphHandler extends BaseHandler {
    async handle(req: Request): Promise<Response> {
        try {
            const body = await req.json()
            const { configFile } = body

            if (!configFile) {
                return this.createBadRequestResponse("configFile is required")
            }

            const taskFile = await this.configParser.parseTaskFile(configFile)
            const executionOrder = this.configParser.resolveDependencyOrder(taskFile.tasks)
            
            return this.createSuccessResponse({
                configFile,
                executionOrder,
                tasks: Object.entries(taskFile.tasks).map(([name, config]) => ({
                    name,
                    dependencies: config.depends_on || []
                }))
            })
        } catch (error) {
            return this.createErrorResponse(error)
        }
    }
}