module.exports = {
  apps: [{
    name: "email-worker",
    script: "npm",
    args: "run email-worker",
    cwd: "C:\\Users\\kmmat\\OneDrive\\Desktop\\GAPI\\GAPI-website\\backend",
    cron_restart: "*/10 * * * *",
    autorestart: true,
    watch: false,
    max_memory_restart: "100M",
    log_file: "./logs/email-worker.log",
    out_file: "./logs/email-worker-out.log",
    error_file: "./logs/email-worker-error.log"
  }]
}