const http = require('http');

async function healthCheck() {
    try {
        // Check if the main process is still running and responsive
        if (!global.emailMonitor) {
            process.exit(1);
        }

        const health = global.emailMonitor.getHealthStatus();
        
        // Consider unhealthy if last test was more than 2 intervals ago
        const maxAge = (global.emailMonitor.config?.sendInterval || 5) * 2 * 60 * 1000;
        const now = new Date();
        
        if (health.lastTest && (now - health.lastTest) > maxAge) {
            console.error('Health check failed: No recent test results');
            process.exit(1);
        }

        if (health.status !== 'running') {
            console.error('Health check failed: Service not running');
            process.exit(1);
        }

        console.log('Health check passed');
        process.exit(0);
    } catch (error) {
        console.error('Health check failed:', error.message);
        process.exit(1);
    }
}

healthCheck();