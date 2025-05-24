const EmailMonitor = require('./email-monitor');

async function test() {
    console.log('Running Email Monitor Test...');
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    
    const monitor = new EmailMonitor('./config/config.json');
    
    try {
        await monitor.loadConfig();
        await monitor.setupSMTP();
        
        console.log('Configuration and SMTP setup successful');
        
        // Test Uptime Kuma connection if enabled
        if (monitor.config.uptimeKuma && monitor.config.uptimeKuma.enabled) {
            console.log('Testing Uptime Kuma connection...');
            await monitor.sendUptimeKumaPing('success', 'Email Monitor test started');
        }
        
        // Perform a single test
        const result = await monitor.performEmailTest();
        
        if (result) {
            console.log('✓ Email monitoring test completed successfully');
        } else {
            console.log('✗ Email monitoring test failed');
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
        
        // Send failure ping if Uptime Kuma is configured
        if (monitor.config && monitor.config.uptimeKuma && monitor.config.uptimeKuma.enabled) {
            await monitor.sendUptimeKumaPing('fail', `Test failed: ${error.message}`);
        }
    }
    
    process.exit(0);
}

test();