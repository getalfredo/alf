<?php

namespace App\Commands;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\File;
use LaravelZero\Framework\Commands\Command;

class InstallStack extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'install-stack';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Install a Stack';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        File::ensureDirectoryExists(getcwd() . '/stacks/docmost');

        File::put(
            path: getcwd() . '/stacks/docmost/compose.yml',
            contents: File::get(resource_path('views/docmost.yml')),
        );

        return 0;
    }

    /**
     * Define the command's schedule.
     */
    public function schedule(Schedule $schedule): void
    {
        // $schedule->command(static::class)->everyMinute();
    }
}
