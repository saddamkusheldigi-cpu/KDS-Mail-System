module.exports = {
  apps: [
    {
      name: "inbox-mailer-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/var/www/inbox-mailer",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "inbox-mailer-worker",
      script: "packages/email-worker/src/local-runner.js",
      cwd: "/var/www/inbox-mailer",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
