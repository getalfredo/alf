import { BaseHandler } from './base-handler.ts'

export class RunHandler extends BaseHandler {
    async handle(req: Request): Promise<Response> {
        try {
            const body = await req.json()
            const { configFile, tasks, continueOnError, verbose } = body

            if (!configFile) {
                return this.createBadRequestResponse("configFile is required")
            }

            const runOptions = {
                taskFile: configFile,
                tasks,
                continueOnError,
                verbose,
            }

            await this.taskRunner.run(runOptions)
            
            return this.createSuccessResponse({
                success: true,
                message: `Tasks completed successfully from ${configFile}`
            })
        } catch (error) {
            return this.createErrorResponse(error)
        }
    }
}