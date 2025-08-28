import { BaseCommand } from './base-command.ts'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'

interface TestResult {
    success: boolean
    message: string
    details?: any
}

export class TestStackCommand extends BaseCommand {
    async execute(stackName: string, options: { cleanup?: boolean, timeout?: number } = {}): Promise<void> {
        if (!stackName) {
            throw new Error('Stack name is required')
        }

        const stackDir = path.join(os.homedir(), 'stacks', stackName)
        const timeout = options.timeout || 30000 // 30 seconds default

        console.log(`🧪 Testing stack "${stackName}"...`)
        console.log(`📂 Stack directory: ${stackDir}`)

        try {
            // Check if stack directory exists
            const dirResult = await this.checkStackDirectory(stackDir)
            if (!dirResult.success) {
                throw new Error(dirResult.message)
            }

            // Start the stack
            console.log(`🚀 Starting stack...`)
            await this.runDockerCommand(['up', '-d'], stackDir)

            // Wait for services to be healthy
            console.log(`⏳ Waiting for services to be ready...`)
            await this.waitForServices(stackDir, timeout)

            // Run health checks
            const healthResults = await this.runHealthChecks(stackDir)
            
            // Display results
            this.displayResults(healthResults)

            console.log(`✅ Stack test completed successfully!`)

        } catch (error) {
            console.error(`❌ Stack test failed: ${error instanceof Error ? error.message : String(error)}`)
            throw error
        } finally {
            if (options.cleanup) {
                console.log(`🧹 Cleaning up stack...`)
                await this.cleanupStack(stackDir)
            } else {
                console.log(`\n💡 To cleanup: alf test-stack ${stackName} --cleanup`)
                console.log(`💡 Or manually: cd ${stackDir} && docker-compose down -v`)
            }
        }
    }

    private async checkStackDirectory(stackDir: string): Promise<TestResult> {
        try {
            const fs = require('fs/promises')
            await fs.access(stackDir)
            
            // Check for required files
            const requiredFiles = ['docker-compose.yml', '.env']
            for (const file of requiredFiles) {
                await fs.access(path.join(stackDir, file))
            }
            
            return { success: true, message: 'Stack directory and files found' }
        } catch {
            return { success: false, message: `Stack directory or required files not found at ${stackDir}` }
        }
    }

    private async runDockerCommand(args: string[], cwd: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn('docker-compose', args, {
                cwd,
                stdio: 'pipe'
            })

            let output = ''
            let errorOutput = ''

            child.stdout?.on('data', (data) => {
                output += data.toString()
            })

            child.stderr?.on('data', (data) => {
                errorOutput += data.toString()
            })

            child.on('close', (code) => {
                if (code === 0) {
                    resolve()
                } else {
                    reject(new Error(`Docker command failed: ${errorOutput || output}`))
                }
            })
        })
    }

    private async waitForServices(stackDir: string, timeout: number): Promise<void> {
        const startTime = Date.now()
        
        while (Date.now() - startTime < timeout) {
            try {
                await this.runDockerCommand(['ps', '--services', '--filter', 'status=running'], stackDir)
                
                // Check if all services are running
                const status = await this.getServicesStatus(stackDir)
                if (status.allRunning) {
                    console.log(`✅ All services are running`)
                    return
                }
                
                console.log(`⏳ Waiting for services... (${status.running}/${status.total} running)`)
                await this.sleep(2000) // Wait 2 seconds
                
            } catch (error) {
                console.log(`⏳ Services still starting up...`)
                await this.sleep(2000)
            }
        }
        
        throw new Error(`Services did not start within ${timeout}ms`)
    }

    private async getServicesStatus(stackDir: string): Promise<{ allRunning: boolean, running: number, total: number }> {
        return new Promise((resolve) => {
            const child = spawn('docker-compose', ['ps', '--format', 'json'], {
                cwd: stackDir,
                stdio: 'pipe'
            })

            let output = ''
            child.stdout?.on('data', (data) => {
                output += data.toString()
            })

            child.on('close', () => {
                try {
                    const lines = output.trim().split('\n').filter(line => line.trim())
                    const services = lines.map(line => JSON.parse(line))
                    const runningServices = services.filter(service => service.State === 'running')
                    
                    resolve({
                        allRunning: runningServices.length === services.length && services.length > 0,
                        running: runningServices.length,
                        total: services.length
                    })
                } catch {
                    resolve({ allRunning: false, running: 0, total: 0 })
                }
            })
        })
    }

    private async runHealthChecks(stackDir: string): Promise<TestResult[]> {
        const results: TestResult[] = []

        // Check if services are responding
        const portChecks = [
            { name: 'Application', port: 3000, path: '/' },
            { name: 'Application Health', port: 3000, path: '/health' },
            { name: 'Database', port: 5432, protocol: 'tcp' },
            { name: 'Redis', port: 6379, protocol: 'tcp' }
        ]

        for (const check of portChecks) {
            try {
                if (check.protocol === 'tcp') {
                    const result = await this.checkTcpPort(check.port)
                    results.push({
                        success: result,
                        message: `${check.name} (port ${check.port})`,
                        details: { port: check.port, protocol: 'tcp' }
                    })
                } else if (check.path) {
                    const result = await this.checkHttpEndpoint(check.port, check.path)
                    results.push({
                        success: result.success,
                        message: `${check.name} (${check.path})`,
                        details: result.details
                    })
                }
            } catch (error) {
                results.push({
                    success: false,
                    message: `${check.name} - ${error instanceof Error ? error.message : String(error)}`
                })
            }
        }

        return results
    }

    private async checkTcpPort(port: number): Promise<boolean> {
        const net = require('net')
        
        return new Promise((resolve) => {
            const socket = new net.Socket()
            const timeout = 5000

            socket.setTimeout(timeout)
            
            socket.on('connect', () => {
                socket.destroy()
                resolve(true)
            })

            socket.on('timeout', () => {
                socket.destroy()
                resolve(false)
            })

            socket.on('error', () => {
                resolve(false)
            })

            socket.connect(port, 'localhost')
        })
    }

    private async checkHttpEndpoint(port: number, path: string): Promise<{ success: boolean, details?: any }> {
        try {
            const response = await fetch(`http://localhost:${port}${path}`, {
                signal: AbortSignal.timeout(5000)
            })
            
            const isSuccess = response.ok
            let data: any = null
            
            try {
                data = await response.json()
            } catch {
                data = await response.text()
            }

            return {
                success: isSuccess,
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    data: typeof data === 'string' ? data.substring(0, 200) : data
                }
            }
        } catch (error) {
            return {
                success: false,
                details: { error: error instanceof Error ? error.message : String(error) }
            }
        }
    }

    private displayResults(results: TestResult[]): void {
        console.log(`\n📊 Health Check Results:`)
        console.log(`${'='.repeat(50)}`)
        
        for (const result of results) {
            const icon = result.success ? '✅' : '❌'
            console.log(`${icon} ${result.message}`)
            
            if (result.details && !result.success) {
                console.log(`   ${JSON.stringify(result.details, null, 2)}`)
            }
        }
        
        const successCount = results.filter(r => r.success).length
        console.log(`\n📈 Overall: ${successCount}/${results.length} checks passed`)
    }

    private async cleanupStack(stackDir: string): Promise<void> {
        try {
            await this.runDockerCommand(['down', '-v'], stackDir)
            console.log(`✅ Stack cleaned up successfully`)
        } catch (error) {
            console.error(`⚠️ Cleanup warning: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}