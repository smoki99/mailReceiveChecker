const nodemailer = require('nodemailer');
const Imap = require('imap');
const { PopClient } = require('poplib');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (error) {
    // dotenv is optional for Docker deployments
    console.log('dotenv not available or .env file not found, using environment variables only');
}

class EmailMonitor {
    constructor(configPath = './config/config.json') {
        this.configPath = configPath;
        this.config = null;
        this.isRunning = false;
        this.intervalId = null;
        this.smtpTransporter = null;
        this.lastTestResult = null;
        this.lastTestTime = null;
    }

    async loadConfig() {
        try {
            // Try to load from file first
            let config = {};
            try {
                const configData = await fs.readFile(this.configPath, 'utf8');
                config = JSON.parse(configData);
                console.log('Configuration loaded from file');
            } catch (error) {
                console.log('No config file found, using environment variables only');
            }

            // Override with environment variables
            this.config = this.buildConfigFromEnv(config);
            this.validateConfig();
            
            // Save the merged config for reference (excluding sensitive data)
            await this.saveConfig();
            
            console.log('Configuration loaded successfully');
            
            // Log configuration summary (without sensitive data)
            this.logConfigSummary();
        } catch (error) {
            throw new Error(`Failed to load config: ${error.message}`);
        }
    }

    logConfigSummary() {
        const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
        
        if (isDebug) {
            console.log('\n=== Configuration Summary ===');
            console.log(`SMTP Server: ${this.config.smtp.host}:${this.config.smtp.port}`);
            console.log(`Mail Server: ${this.config.mail.protocol.toUpperCase()} ${this.config.mail.host}:${this.config.mail.port}`);
            console.log(`From: ${this.config.mail.from} → To: ${this.config.mail.to}`);
            console.log(`Send Interval: ${this.config.sendInterval} minutes`);
            console.log(`Receive Timeout: ${this.config.receiveTimeout} minutes`);
            console.log(`Retries: ${this.config.retries}`);
            
            if (this.config.uptimeKuma && this.config.uptimeKuma.enabled) {
                console.log(`Uptime Kuma: ${this.config.uptimeKuma.server} (ID: ${this.config.uptimeKuma.identifier})`);
            } else {
                console.log('Uptime Kuma: Disabled');
            }
            console.log('==============================\n');
        }
    }

    buildConfigFromEnv(baseConfig = {}) {
        const config = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

        // SMTP Configuration
        config.smtp = config.smtp || {};
        config.smtp.host = process.env.SMTP_HOST || config.smtp.host;
        config.smtp.port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : config.smtp.port;
        config.smtp.secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : config.smtp.secure;
        config.smtp.user = process.env.SMTP_USER || config.smtp.user;
        config.smtp.password = process.env.SMTP_PASSWORD || config.smtp.password;
        config.smtp.rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED ? 
            process.env.SMTP_REJECT_UNAUTHORIZED === 'true' : 
            (config.smtp.rejectUnauthorized !== false);

        // Mail Configuration
        config.mail = config.mail || {};
        config.mail.protocol = process.env.MAIL_PROTOCOL || config.mail.protocol;
        config.mail.host = process.env.MAIL_HOST || config.mail.host;
        config.mail.port = process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT) : config.mail.port;
        config.mail.tls = process.env.MAIL_TLS ? process.env.MAIL_TLS === 'true' : config.mail.tls;
        config.mail.user = process.env.MAIL_USER || config.mail.user;
        config.mail.password = process.env.MAIL_PASSWORD || config.mail.password;
        config.mail.rejectUnauthorized = process.env.MAIL_REJECT_UNAUTHORIZED ? 
            process.env.MAIL_REJECT_UNAUTHORIZED === 'true' : 
            (config.mail.rejectUnauthorized !== false);
        config.mail.from = process.env.MAIL_FROM || config.mail.from;
        config.mail.to = process.env.MAIL_TO || config.mail.to;

        // Uptime Kuma Configuration
        config.uptimeKuma = config.uptimeKuma || {};
        config.uptimeKuma.enabled = process.env.KUMA_ENABLED ? 
            process.env.KUMA_ENABLED === 'true' : 
            (config.uptimeKuma.enabled !== false);
        config.uptimeKuma.server = process.env.KUMA_SERVER || config.uptimeKuma.server;
        config.uptimeKuma.identifier = process.env.KUMA_IDENTIFIER || config.uptimeKuma.identifier;
        config.uptimeKuma.timeout = process.env.KUMA_TIMEOUT ? 
            parseInt(process.env.KUMA_TIMEOUT) : 
            (config.uptimeKuma.timeout || 10000);
        config.uptimeKuma.retries = process.env.KUMA_RETRIES ? 
            parseInt(process.env.KUMA_RETRIES) : 
            (config.uptimeKuma.retries || 3);

        // Monitoring Configuration
        config.sendInterval = process.env.SEND_INTERVAL ? 
            parseInt(process.env.SEND_INTERVAL) : 
            (config.sendInterval || 5);
        config.receiveTimeout = process.env.RECEIVE_TIMEOUT ? 
            parseInt(process.env.RECEIVE_TIMEOUT) : 
            (config.receiveTimeout || 1);
        config.retries = process.env.RETRIES ? 
            parseInt(process.env.RETRIES) : 
            (config.retries || 3);

        // Health check configuration
        config.healthCheck = config.healthCheck || {};
        config.healthCheck.enabled = process.env.HEALTH_CHECK_ENABLED ? 
            process.env.HEALTH_CHECK_ENABLED === 'true' : 
            (config.healthCheck.enabled !== false);
        config.healthCheck.port = process.env.HEALTH_CHECK_PORT ? 
            parseInt(process.env.HEALTH_CHECK_PORT) : 
            (config.healthCheck.port || 3000);

        return config;
    }

    async saveConfig() {
        try {
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });
            
            // Don't save sensitive information to file
            const sanitizedConfig = JSON.parse(JSON.stringify(this.config));
            if (sanitizedConfig.smtp) sanitizedConfig.smtp.password = '***';
            if (sanitizedConfig.mail) sanitizedConfig.mail.password = '***';
            
            await fs.writeFile(this.configPath, JSON.stringify(sanitizedConfig, null, 2));
        } catch (error) {
            console.warn(`Could not save config file: ${error.message}`);
        }
    }

    validateConfig() {
        const required = [
            'smtp.host', 'smtp.port', 'smtp.user', 'smtp.password',
            'mail.protocol', 'mail.host', 'mail.port', 'mail.user', 'mail.password',
            'mail.from', 'mail.to'
        ];

        for (const field of required) {
            const value = this.getNestedValue(this.config, field);
            if (!value) {
                throw new Error(`Missing required config field: ${field}`);
            }
        }

        // Validate Uptime Kuma config if enabled
        if (this.config.uptimeKuma && this.config.uptimeKuma.enabled) {
            const kumaRequired = ['uptimeKuma.server', 'uptimeKuma.identifier'];
            for (const field of kumaRequired) {
                const value = this.getNestedValue(this.config, field);
                if (!value) {
                    throw new Error(`Missing required Uptime Kuma config field: ${field}`);
                }
            }
        }
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    async setupSMTP() {
        this.smtpTransporter = nodemailer.createTransporter({
            host: this.config.smtp.host,
            port: this.config.smtp.port,
            secure: this.config.smtp.secure || false,
            auth: {
                user: this.config.smtp.user,
                pass: this.config.smtp.password
            },
            tls: {
                rejectUnauthorized: this.config.smtp.rejectUnauthorized !== false
            }
        });

        // Verify SMTP connection
        try {
            await this.smtpTransporter.verify();
            console.log('SMTP connection verified successfully');
        } catch (error) {
            throw new Error(`SMTP verification failed: ${error.message}`);
        }
    }

    async sendUptimeKumaPing(status, message = '', responseTime = null) {
        if (!this.config.uptimeKuma || !this.config.uptimeKuma.enabled) {
            return;
        }

        const { server, identifier, timeout, retries } = this.config.uptimeKuma;
        
        // Construct the push URL
        let pushUrl = `${server.replace(/\/$/, '')}/api/push/${identifier}`;
        
        // Add status parameter
        if (status === 'success') {
            pushUrl += '?status=up';
        } else if (status === 'fail') {
            pushUrl += '?status=down';
        }
        
        // Add message if provided
        if (message) {
            const separator = pushUrl.includes('?') ? '&' : '?';
            pushUrl += `${separator}msg=${encodeURIComponent(message)}`;
        }
        
        // Add response time if provided
        if (responseTime !== null) {
            const separator = pushUrl.includes('?') ? '&' : '?';
            pushUrl += `${separator}ping=${responseTime}`;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Sending Uptime Kuma ping (attempt ${attempt}/${retries}): ${status.toUpperCase()}`);
                
                const response = await axios.get(pushUrl, {
                    timeout: timeout,
                    validateStatus: (status) => status < 500
                });
                
                if (response.status === 200 || response.data?.ok) {
                    console.log(`✓ Uptime Kuma ping sent successfully: ${status.toUpperCase()}`);
                    return;
                } else {
                    throw new Error(`Unexpected response: ${response.status} - ${response.data}`);
                }
                
            } catch (error) {
                console.error(`✗ Uptime Kuma ping failed (attempt ${attempt}): ${error.message}`);
                
                if (attempt < retries) {
                    console.log('Waiting 5 seconds before retry...');
                    await this.sleep(5000);
                } else {
                    console.error(`✗ All Uptime Kuma ping attempts failed for status: ${status.toUpperCase()}`);
                }
            }
        }
    }

    generateTestEmail() {
        const timestamp = new Date().toISOString();
        const uniqueId = Math.random().toString(36).substring(2, 15);
        
        return {
            from: this.config.mail.from,
            to: this.config.mail.to,
            subject: `Email Monitor Test - ${timestamp}`,
            text: `This is a test email sent by Email Monitor at ${timestamp}. ID: ${uniqueId}`,
            headers: {
                'X-Email-Monitor-ID': uniqueId,
                'X-Email-Monitor-Timestamp': timestamp
            },
            uniqueId,
            timestamp
        };
    }

    async sendEmail(emailData) {
        try {
            const info = await this.smtpTransporter.sendMail(emailData);
            console.log(`Email sent successfully. ID: ${emailData.uniqueId}, MessageID: ${info.messageId}`);
            return info;
        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    async checkEmailViaIMAP(uniqueId, retries = 0) {
        return new Promise((resolve, reject) => {
            const imap = new Imap({
                user: this.config.mail.user,
                password: this.config.mail.password,
                host: this.config.mail.host,
                port: this.config.mail.port,
                tls: this.config.mail.tls !== false,
                tlsOptions: {
                    rejectUnauthorized: this.config.mail.rejectUnauthorized !== false
                }
            });

            let found = false;

            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) {
                        reject(new Error(`Failed to open INBOX: ${err.message}`));
                        return;
                    }

                    imap.search([['HEADER', 'X-Email-Monitor-ID', uniqueId]], (err, results) => {
                        if (err) {
                            reject(new Error(`Search failed: ${err.message}`));
                            return;
                        }

                        if (results.length > 0) {
                            found = true;
                            console.log(`✓ Email found via IMAP. ID: ${uniqueId}`);
                            resolve(true);
                        } else {
                            console.log(`✗ Email not found via IMAP. ID: ${uniqueId}`);
                            resolve(false);
                        }
                        imap.end();
                    });
                });
            });

            imap.once('error', (err) => {
                reject(new Error(`IMAP error: ${err.message}`));
            });

            imap.once('end', () => {
                if (!found) {
                    resolve(false);
                }
            });

            imap.connect();
        });
    }

    async checkEmailViaPOP3(uniqueId, retries = 0) {
        return new Promise((resolve, reject) => {
            const pop3 = new PopClient(this.config.mail.port, this.config.mail.host, {
                tlsEnabled: this.config.mail.tls !== false,
                enabletls: this.config.mail.tls !== false
            });

            let found = false;

            pop3.on('connect', () => {
                pop3.login(this.config.mail.user, this.config.mail.password);
            });

            pop3.on('login', (status, data) => {
                if (status) {
                    pop3.list();
                } else {
                    reject(new Error(`POP3 login failed: ${data}`));
                }
            });

            pop3.on('list', (status, msgcount, msgnumber, data, rawdata) => {
                if (status && msgcount > 0) {
                    const messagesToCheck = Math.min(msgcount, 10);
                    let checkedCount = 0;

                    for (let i = msgcount; i > msgcount - messagesToCheck; i--) {
                        pop3.retr(i);
                    }
                } else {
                    console.log(`✗ No messages found via POP3. ID: ${uniqueId}`);
                    pop3.quit();
                    resolve(false);
                }
            });

            pop3.on('retr', (status, msgnumber, data, rawdata) => {
                if (status && rawdata.includes(`X-Email-Monitor-ID: ${uniqueId}`)) {
                    found = true;
                    console.log(`✓ Email found via POP3. ID: ${uniqueId}`);
                    pop3.quit();
                    resolve(true);
                    return;
                }

                const messagesToCheck = Math.min(10, parseInt(msgnumber));
                if (parseInt(msgnumber) <= messagesToCheck) {
                    if (!found) {
                        console.log(`✗ Email not found via POP3. ID: ${uniqueId}`);
                        resolve(false);
                    }
                    pop3.quit();
                }
            });

            pop3.on('error', (err) => {
                reject(new Error(`POP3 error: ${err.message}`));
            });

            pop3.connect();
        });
    }

    async checkEmail(uniqueId) {
        const protocol = this.config.mail.protocol.toLowerCase();
        
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                console.log(`Checking for email (attempt ${attempt}/${this.config.retries}). ID: ${uniqueId}`);
                
                let found = false;
                if (protocol === 'imap') {
                    found = await this.checkEmailViaIMAP(uniqueId);
                } else if (protocol === 'pop3') {
                    found = await this.checkEmailViaPOP3(uniqueId);
                } else {
                    throw new Error(`Unsupported protocol: ${protocol}`);
                }

                if (found) {
                    return true;
                }

                if (attempt < this.config.retries) {
                    console.log(`Waiting before retry... (${this.config.receiveTimeout} minute(s))`);
                    await this.sleep(this.config.receiveTimeout * 60 * 1000);
                }
            } catch (error) {
                console.error(`Error checking email (attempt ${attempt}): ${error.message}`);
                if (attempt < this.config.retries) {
                    await this.sleep(5000);
                }
            }
        }

        return false;
    }

    async performEmailTest() {
        const startTime = Date.now();
        let testResult = false;
        let errorMessage = '';

        try {
            console.log('\n--- Starting Email Test ---');
            
            const emailData = this.generateTestEmail();
            await this.sendEmail(emailData);

            console.log('Waiting 30 seconds before checking for email receipt...');
            await this.sleep(30000);

            const received = await this.checkEmail(emailData.uniqueId);
            
            if (received) {
                console.log(`✓ Email delivery test PASSED. ID: ${emailData.uniqueId}`);
                testResult = true;
            } else {
                console.log(`✗ Email delivery test FAILED. ID: ${emailData.uniqueId}`);
                errorMessage = `Email not received within timeout period. ID: ${emailData.uniqueId}`;
            }

            console.log('--- Email Test Complete ---\n');
            
        } catch (error) {
            console.error(`Email test failed: ${error.message}`);
            errorMessage = error.message;
            testResult = false;
        }

        const responseTime = Date.now() - startTime;
        this.lastTestResult = testResult;
        this.lastTestTime = new Date();

        if (testResult) {
            await this.sendUptimeKumaPing('success', 'Email delivery test passed', responseTime);
        } else {
            await this.sendUptimeKumaPing('fail', errorMessage, responseTime);
        }

        return testResult;
    }

    getHealthStatus() {
        return {
            status: this.isRunning ? 'running' : 'stopped',
            lastTest: this.lastTestTime,
            lastResult: this.lastTestResult,
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'production'
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async start() {
        try {
            console.log('Starting Email Monitor...');
            console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
            console.log(`User: ${process.env.USER || 'unknown'}`);
            console.log(`Date: ${new Date().toISOString()}`);
            
            await this.loadConfig();
            await this.setupSMTP();
            
            if (this.config.uptimeKuma && this.config.uptimeKuma.enabled) {
                console.log('Testing Uptime Kuma connection...');
                await this.sendUptimeKumaPing('success', 'Email Monitor started successfully');
            }
            
            this.isRunning = true;
            
            await this.performEmailTest();
            
            const intervalMs = this.config.sendInterval * 60 * 1000;
            console.log(`Scheduling email tests every ${this.config.sendInterval} minutes`);
            
            this.intervalId = setInterval(async () => {
                if (this.isRunning) {
                    await this.performEmailTest();
                }
            }, intervalMs);

            console.log('Email Monitor is running. Send SIGTERM to stop.');
            
        } catch (error) {
            console.error(`Failed to start Email Monitor: ${error.message}`);
            await this.sendUptimeKumaPing('fail', `Email Monitor startup failed: ${error.message}`);
            process.exit(1);
        }
    }

    async stop() {
        console.log('\nStopping Email Monitor...');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        if (this.smtpTransporter) {
            this.smtpTransporter.close();
        }
        
        await this.sendUptimeKumaPing('success', 'Email Monitor stopped gracefully');
        
        console.log('Email Monitor stopped.');
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    if (global.emailMonitor) {
        await global.emailMonitor.stop();
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', async () => {
    if (global.emailMonitor) {
        await global.emailMonitor.stop();
    } else {
        process.exit(0);
    }
});

async function main() {
    global.emailMonitor = new EmailMonitor('./config/config.json');
    await global.emailMonitor.start();
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = EmailMonitor;