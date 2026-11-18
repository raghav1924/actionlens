# Deployment & Production Operations — ActionLens

**Target:** GitHub Actions Workflow Linter & Pipeline DAG Optimizer  
**Author:** Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))

---

## 1. Container Deployment (Docker)

```bash
docker build -t actionlens:latest .
docker run -d -p 5252:5252 --name actionlens actionlens:latest
```

## 2. Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/bin.js --name "actionlens" -- studio --port 5252
```

## 3. Systemd Service Unit

```ini
[Unit]
Description=ActionLens Background Service
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/actionlens
ExecStart=/usr/bin/node dist/bin.js studio --port 5252
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
