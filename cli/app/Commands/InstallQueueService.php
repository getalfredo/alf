<?php

namespace App\Commands;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\File;
use LaravelZero\Framework\Commands\Command;

class InstallQueueService extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'install:queue-service
                            {--user= : The user to run the service as}
                            {--working-directory= : The working directory for the queue worker}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Install queue:work as a systemd service';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (!$this->isLinux()) {
            $this->error('This command only works on Linux systems with systemd.');
            return 1;
        }

        // Get options or use defaults
        $user = $this->option('user');
        $workingDirectory = $this->option('working-directory');

        // Validate working directory
        if (! File::isDirectory($workingDirectory)) {
            $this->error("Working directory does not exist: {$workingDirectory}");
            return 1;
        }

        // Find the alf executable
        $alfPath = $workingDirectory . '/alf';
        if (!File::exists($alfPath)) {
            $this->error("Could not find 'alf' executable in: {$workingDirectory}");
            return 1;
        }

        $this->info('Installing queue worker as systemd service...');
        $this->newLine();

        // Generate service file content
        $serviceContent = $this->generateServiceFile($user, $workingDirectory, $alfPath);

        // Service file path
        $serviceName = 'alf-queue-worker.service';
        $tempServicePath = sys_get_temp_dir() . '/' . $serviceName;
        $systemdPath = '/etc/systemd/system/' . $serviceName;

        // Write to temp file first
        File::put($tempServicePath, $serviceContent);

        $this->info("Service file created at: {$tempServicePath}");
        $this->newLine();

        // Display the service file content
        $this->line('<fg=yellow>Service file content:</>');
        $this->line($serviceContent);
        $this->newLine();

        // Provide instructions
        $this->info('To complete the installation, run the following commands:');
        $this->newLine();
        $this->line("  <fg=green>sudo cp {$tempServicePath} {$systemdPath}</>");
        $this->line('  <fg=green>sudo systemctl daemon-reload</>');
        $this->line('  <fg=green>sudo systemctl enable alf-queue-worker</>');
        $this->line('  <fg=green>sudo systemctl start alf-queue-worker</>');
        $this->newLine();
        $this->info('To check the status:');
        $this->line('  <fg=green>sudo systemctl status alf-queue-worker</>');
        $this->newLine();
        $this->info('To view logs:');
        $this->line('  <fg=green>sudo journalctl -u alf-queue-worker -f</>');

        return 0;
    }

    /**
     * Generate the systemd service file content.
     */
    protected function generateServiceFile(string $user, string $workingDirectory, string $alfPath): string
    {
        return <<<SERVICE
[Unit]
Description=Alf Queue Worker
After=network.target

[Service]
Type=simple
User={$user}
WorkingDirectory={$workingDirectory}
ExecStart={$alfPath} queue:work --tries=3 --sleep=3 --timeout=90
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=alf-queue-worker

[Install]
WantedBy=multi-user.target

SERVICE;
    }

    /**
     * Check if the system is Linux.
     */
    protected function isLinux(): bool
    {
        return PHP_OS_FAMILY === 'Linux';
    }

    /**
     * Define the command's schedule.
     */
    public function schedule(Schedule $schedule): void
    {
        // $schedule->command(static::class)->everyMinute();
    }
}
