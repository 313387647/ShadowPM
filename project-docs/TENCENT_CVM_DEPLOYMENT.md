# ShadowPM 低成本上线到腾讯云 CVM

当前试运营使用一台 CVM：Nginx 运行在宿主机，ShadowPM 和 PostgreSQL 16 分别运行在 Docker 容器中。数据库数据保存在 Docker Volume，端口 `5432` 不对公网开放。

```text
https://pm.你的域名.com -> Nginx -> ShadowPM 容器 <-> PostgreSQL 容器
                                              |
                                         每日备份到本机，定期复制至 COS
```

你现在只需购买 CVM 和域名。COS 是低成本异地备份，不是启动前的必购项。

## 1. 购买

1. CVM 选择 Ubuntu 22.04 LTS、至少 2 核 4GB、40GB 系统盘；同机运行其他项目时选择 4 核 8GB。
2. 有公司域名就使用 `pm.你的公司域名.com`，没有再购买域名。
3. 安全组仅开放 `22`（仅你的固定 IP）、`80`、`443`。不要开放 `3000` 和 `5432`。
4. 中国大陆地域使用域名提供服务需要 ICP 备案；香港地域不需要备案，但应先确认数据合规与网络体验。[腾讯云备案说明](https://cloud.tencent.com/document/faq/243/19630)

不购买 TencentDB PostgreSQL、负载均衡、Redis 或 Kubernetes。

## 2. 域名和证书

1. 在域名 DNS 控制台新增 `A` 记录：主机记录 `pm`，记录值为 CVM 公网 IP。
2. 在腾讯云 SSL 证书管理控制台申请 `pm.你的域名.com` 的证书，下载 Nginx 格式证书和私钥。
3. 私钥不提交 Git、不发送群聊、不放在项目目录。

## 3. 登录 CVM 并安装 Docker

```bash
ssh ubuntu@<CVM公网IP>
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git nginx
```

按腾讯云的 [Docker 官方指南](https://cloud.tencent.com/document/product/213/46000)安装 Docker Engine 和 Docker Compose 插件。然后：

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
exit
```

重新 SSH 登录，验证：

```bash
docker --version
docker compose version
docker ps
```

## 4. 拉取代码与环境变量

```bash
git clone git@github.com:313387647/ShadowPM.git
cd ShadowPM
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
```

填写如下内容。`POSTGRES_PASSWORD` 使用 20 位以上、仅由字母数字、`-`、`_` 组成的密码；`DATABASE_URL` 内的密码必须相同：

```dotenv
NODE_ENV=production
POSTGRES_USER=shadowpm_app
POSTGRES_PASSWORD=<强密码>
POSTGRES_DB=shadowpm
DATABASE_URL=postgresql://shadowpm_app:<同一个强密码>@postgres:5432/shadowpm?schema=public
SHADOWPM_SESSION_SECRET=<随机会话密钥>
DEEPSEEK_API_KEY=<团队AI密钥>
NEXT_PUBLIC_APP_URL=https://pm.你的域名.com
```

生成会话密钥：

```bash
openssl rand -base64 48
```

## 5. 初始化 PostgreSQL、管理员与应用

启动数据库：

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres
```

构建最新的迁移镜像并执行正式 migration。`migrator` 是独立 Docker target，不能只重建 `app`；否则应用代码与数据库 schema 可能不一致。不要运行 demo seed：

```bash
docker compose --profile tools --env-file .env.production -f docker-compose.production.yml build migrator
docker compose --profile tools --env-file .env.production -f docker-compose.production.yml run --rm migrator
```

创建 `.env.bootstrap-admin`：

```dotenv
TEAM_ADMIN_NAME=你的姓名
TEAM_ADMIN_EMAIL=you@company.com
TEAM_ADMIN_PASSWORD=至少12位强密码
```

创建管理员并启动应用：

```bash
chmod 600 .env.bootstrap-admin
docker compose --profile tools --env-file .env.production --env-file .env.bootstrap-admin -f docker-compose.production.yml run --rm bootstrap-admin
rm .env.bootstrap-admin
docker compose --env-file .env.production -f docker-compose.production.yml up -d app
curl -fsS http://127.0.0.1:3000/api/health
```

必须看到 `"status":"ok"` 和 `"database":"connected"`。

## 6. 创建成员

创建临时 `.env.member`：

```dotenv
TEAM_MEMBER_NAME=成员姓名
TEAM_MEMBER_EMAIL=member@company.com
TEAM_MEMBER_PASSWORD=至少12位强密码
TEAM_MEMBER_ROLE=MEMBER
```

执行：

```bash
chmod 600 .env.member
docker compose --profile tools --env-file .env.production --env-file .env.member -f docker-compose.production.yml run --rm create-member
rm .env.member
```

同邮箱再次执行会重设密码并恢复账号。除真实全局管理者外，一律使用 `MEMBER`。

## 7. 配置 Nginx HTTPS

首次签发免费证书时，先启用 HTTP 站点配置；Certbot 会在验证通过后自动改为 HTTPS 并将 HTTP 请求重定向到 HTTPS：

```bash
sudo cp deploy/nginx/shadowpm-rate-limit.conf.example /etc/nginx/conf.d/shadowpm-rate-limit.conf
sudo cp deploy/nginx/shadowpm-http.conf.example /etc/nginx/sites-available/shadowpm
sudo sed -i 's/shadowpm.example.com/pm.你的域名.com/g' /etc/nginx/sites-available/shadowpm
sudo ln -s /etc/nginx/sites-available/shadowpm /etc/nginx/sites-enabled/shadowpm
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

安装 Certbot 后签发证书。将邮箱替换为用于接收证书到期提醒的团队管理员邮箱：

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx --non-interactive --agree-tos \
  -m admin@example.com \
  -d pm.你的域名.com \
  --redirect
sudo certbot renew --dry-run
```

不要同时启用 `shadowpm.conf.example`；它仅作为手动上传腾讯云证书时的备用模板。

## 8. 每日备份和 COS

创建备份目录并执行一次备份：

```bash
sudo install -d -m 700 /opt/shadowpm-backups
sudo /home/ubuntu/ShadowPM/deploy/backup-postgres.sh
ls -lh /opt/shadowpm-backups
```

加入 root 每日 03:15 定时任务：

```bash
sudo crontab -e
```

```cron
15 3 * * * /home/ubuntu/ShadowPM/deploy/backup-postgres.sh >> /var/log/shadowpm-backup.log 2>&1
```

脚本保留 14 天本地备份。团队正式使用前，创建一个按量付费 COS 私有桶，并将最近备份额外上传一份，作为异地恢复点。COS 支持按量计费，适合低成本备份。[腾讯云 COS 定价](https://buy.cloud.tencent.com/price/cos)

## 9. 验收与更新

1. 打开 `https://pm.你的域名.com/api/health`，确认 `ok` 与 `connected`。
2. 管理员和普通成员分别登录。
3. 上传脱敏案例并检查管控总表、预算、执行日历。
4. 检查日志：

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail 100 app
```

以后更新：先在本机运行 `npm test`、`npm run lint`、`npm run build`，再在 CVM 执行：

```bash
cd ~/ShadowPM
git pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres
docker compose --profile tools --env-file .env.production -f docker-compose.production.yml build migrator
docker compose --profile tools --env-file .env.production -f docker-compose.production.yml run --rm migrator
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build app
curl -fsS https://pm.你的域名.com/api/health
```

不要执行 `npm run db:seed:demo` 或 `prisma db push --force-reset`。如果迁移命令显示已完成、但应用报 Prisma 字段缺失错误，先检查是否遗漏了 `build migrator`；不要直接在生产库执行重置或回滚。
