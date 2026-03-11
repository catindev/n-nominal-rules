# Руководство по деплою в Kubernetes

> v0.8.0 · Для системного аналитика и DevOps

## Содержание

1. [Обзор и текущее состояние](#1-обзор-и-текущее-состояние)
2. [Подготовка репозитория](#2-подготовка-репозитория)
3. [Dockerfile](#3-dockerfile)
4. [Graceful shutdown](#4-graceful-shutdown)
5. [Стратегия снэпшота в Kubernetes](#5-стратегия-снэпшота-в-kubernetes)
6. [Kubernetes-манифесты](#6-kubernetes-манифесты)
7. [Health check — доработка](#7-health-check--доработка)
8. [CI/CD pipeline](#8-cicd-pipeline)
9. [Безопасность](#9-безопасность)
10. [Логирование](#10-логирование)
11. [Итоговый чеклист](#11-итоговый-чеклист)

## 1. Обзор и текущее состояние

Движок — stateless Node.js-сервис, валидирующий JSON-пэйлоады по декларативным правилам. Он уже спроектирован под горизонтальное масштабирование и canary-деплой. Однако в текущем виде код содержит ряд пробелов, которые нужно закрыть перед загрузкой в репозиторий и деплоем в кубер.

Документ описывает все необходимые шаги в порядке приоритета.

## 2. Подготовка репозитория

### 2.1 .gitignore

В проекте нет `.gitignore` — без него `node_modules`, снэпшоты и локальные `.env` попадут в репо.

```gitignore
node_modules/
dist/
*.snapshot.json
.env
.env.*
!.env.example
*.log
.DS_Store
coverage/
```

### 2.2 .env.example

Зафиксировать все переменные окружения, которые читает сервер. Реальные значения — только через Vault / k8s Secrets, не в репо.

```env
# Режим запуска: development | production | test
NODE_ENV=production

# Порт HTTP-сервера
PORT=3000

# Путь к снэпшоту (обязателен когда NODE_ENV != development)
SNAPSHOT_PATH=./snapshot.json

# Включить трассировку в ответе (0 — выкл, 1 — вкл)
TRACE=0

# Включить UI документации в production (true | false)
DOCS_ENABLED=false

# Путь к папке с правилами (только для development)
RULES_DIR=./rules
```

### 2.3 package.json — обязательные правки

Текущее поле `name` — `dsl-engine-prototype`. Нужно переименовать под нейминг банка. Также добавить поля:

```json
{
  "name": "@bank/dsl-rule-engine",
  "version": "0.8.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development nodemon server.js",
    "build": "node tools/build-snapshot.js",
    "test": "node --test",
    "lint": "eslint lib/ server.js"
  }
}
```

> Поле `engines` гарантирует что в CI не запустится на несовместимой версии Node. Текущий код работает на Node 22; минимум Node 20 достаточен.

## 3. Dockerfile

Dockerfile в проекте отсутствует. Рекомендуемый multi-stage образ:

```dockerfile
# ── stage 1: зависимости ──────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── stage 2: финальный образ ──────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Системный пользователь без root-прав
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY lib/           ./lib/
COPY server.js      ./
COPY docs-routes.js ./
COPY index.js       ./
COPY views/         ./views/
COPY static/        ./static/
# Снэпшот монтируется через ConfigMap/Volume, не копируется в образ

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

> ⚠️ Папка `rules/` и снэпшот не копируются в образ — они монтируются через Volume или ConfigMap. Это позволяет обновлять правила без пересборки образа (см. раздел 5).

### .dockerignore

```dockerignore
node_modules
.git
.env*
*.log
payloads/
FL_RESIDENT_TEST_SUITE_v5/
docs/
scripts/
tools/
*.snapshot.json
```

## 4. Graceful shutdown

В `server.js` нет обработки `SIGTERM`. Kubernetes при рестарте пода сначала посылает `SIGTERM` и ждёт до `terminationGracePeriodSeconds` (default 30s), потом `SIGKILL`. Без graceful shutdown in-flight запросы прерываются.

Заменить `app.listen(...)` в конце `server.js` на:

```js
const server = app.listen(PORT, () => {
  console.log(`[rules-engine] listening on http://localhost:${PORT}`);
});

// Graceful shutdown для Kubernetes
function shutdown(signal) {
  console.log(`[rules-engine] ${signal} received — shutting down`);
  server.close(() => {
    console.log("[rules-engine] HTTP server closed");
    process.exit(0);
  });
  // Принудительный выход если соединения не закрылись за 25s
  setTimeout(() => process.exit(1), 25_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

## 5. Стратегия снэпшота в Kubernetes

Движок stateless в production он грузит снэпшот при старте и больше ничего не читает с диска. Это основа для надёжного деплоя.

### 5.1 Рекомендуемый подход ConfigMap

Снэпшот кладётся в ConfigMap и монтируется как файл в под. При обновлении правил обновляется ConfigMap и поды рестартуют.

```bash
# Создать/обновить ConfigMap из файла снэпшота
kubectl create configmap dsl-engine-snapshot \
  --from-file=snapshot.json=./snapshot.json \
  --dry-run=client -o yaml | kubectl apply -f -
```

Монтирование в Deployment (см. полный манифест в разделе 6):

```yaml
volumes:
  - name: snapshot
    configMap:
      name: dsl-engine-snapshot
containers:
  - name: dsl-engine
    volumeMounts:
      - name: snapshot
        mountPath: /app/snapshot
        readOnly: true
    env:
      - name: SNAPSHOT_PATH
        value: /app/snapshot/snapshot.json
```

> ⚠️ ConfigMap имеет лимит 1 МБ. Если снэпшот превысит этот размер, то хранить в S3/Nexus и скачивать в init-контейнере.

### 5.2 Canary и rollback

Движок stateless позволяет параллельно держать несколько версий снэпшота:

| Сценарий             | Механизм                                                               |
| -------------------- | ---------------------------------------------------------------------- |
| Новая версия правил  | Новый ConfigMap → rolling update Deployment                            |
| Canary (10% трафика) | Второй Deployment с другим снэпшотом + weight в Ingress / Service Mesh |
| Rollback             | `kubectl rollout undo deployment/dsl-engine`                           |

## 6. Kubernetes-манифесты

### 6.1 Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dsl-engine
  labels:
    app: dsl-engine
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dsl-engine
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0 # zero-downtime
      maxSurge: 1
  template:
    metadata:
      labels:
        app: dsl-engine
    spec:
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
        - name: dsl-engine
          image: registry.bank.ru/dsl-engine:1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: SNAPSHOT_PATH
              value: /app/snapshot/snapshot.json
            - name: PORT
              value: "3000"
            - name: TRACE
              value: "0"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
          volumeMounts:
            - name: snapshot
              mountPath: /app/snapshot
              readOnly: true
      volumes:
        - name: snapshot
          configMap:
            name: dsl-engine-snapshot
```

### 6.2 Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dsl-engine
spec:
  selector:
    app: dsl-engine
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

### 6.3 HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dsl-engine
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dsl-engine
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## 7. Health check — доработка

Текущий `GET /health` возвращает только мета-информацию о режиме. Kubernetes использует его как readiness и liveness probe. Нужно добавить явную проверку что снэпшот загружен:

```js
app.get("/health", (_req, res) => {
  // Проверяем что compiled registry инициализирован
  if (!ctx.compiled || !ctx.compiled.registry) {
    return res.status(503).json({ ok: false, reason: "not ready" });
  }
  res.json({ ok: true, ...meta });
});
```

> 503 при недоступности заставляет Kubernetes исключить под из балансировки до полной инициализации. Это критично при rolling update.

## 8. CI/CD pipeline

Рекомендуемая структура пайплайна (GitLab CI / Jenkins — синтаксис адаптировать под инструмент банка):

| Стадия           | Команда / действие                                      | Триггер              |
| ---------------- | ------------------------------------------------------- | -------------------- |
| `lint`           | `eslint lib/ server.js`                                 | любой push           |
| `test`           | `node --test` + newman для интеграционных               | любой push           |
| `build-snapshot` | `node tools/build-snapshot.js --version $CI_COMMIT_TAG` | tag или merge в main |
| `docker-build`   | `docker build -t registry.bank.ru/dsl-engine:$TAG .`    | то же                |
| `docker-push`    | `docker push registry.bank.ru/dsl-engine:$TAG`          | то же                |
| `deploy-test`    | `kubectl apply` + ждать rollout                         | merge в main         |
| `deploy-prod`    | `kubectl apply` + ждать rollout                         | ручное подтверждение |

> Снэпшот правил и Docker-образ версионируются **независимо**. Образ меняется только при изменении кода движка. Правила обновляются через ConfigMap без пересборки образа.

## 9. Безопасность

| Пункт                 | Текущий статус         | Что сделать                                                                |
| --------------------- | ---------------------- | -------------------------------------------------------------------------- |
| Non-root в контейнере | Не настроено           | Добавлено в Dockerfile (`USER appuser`) и Deployment (`runAsNonRoot`)      |
| `DOCS_ENABLED` в prod | `false` по умолчанию   | Убедиться что в prod-окружении переменная не выставлена в `true`           |
| Sandbox UI в prod     | Роут открыт всегда     | Закрыть `/sandbox/*` через Ingress-аннотации или middleware с IP-фильтром  |
| `TRACE` в prod        | `0` по умолчанию       | Не включать `TRACE=1` в prod — ответы раздуваются в десятки раз            |
| Rate limiting         | Отсутствует            | Добавить nginx rate limit на Ingress или `express-rate-limit`              |
| CORS                  | `Allow *` захардкожено | Ограничить `Access-Control-Allow-Origin` до доменов банка                  |
| Секреты               | Нет секретов пока      | При появлении — только через k8s Secret, не ConfigMap и не env в манифесте |

## 10. Логирование

Сервер использует `console.log` / `console.error`. В Kubernetes это уходит в stdout/stderr и подбирается Fluentd/Loki. Для production рекомендуется структурированный JSON-лог.

Минимальный вариант без новых зависимостей:

```js
function log(level, msg, data = {}) {
  process.stdout.write(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...data,
    }) + "\n",
  );
}

// Использование:
log("info", "[engine] started", { port: PORT, mode: NODE_ENV });
log("error", "[hot-reload] failed", { error: err.message });
```

> Если в банке уже используется `pino` или `winston` — подключить их. Pino предпочтительнее из-за минимального overhead.

## 11. Итоговый чеклист

### Репозиторий

- [ ] `.gitignore` создан
- [ ] `.env.example` создан и заполнен всеми переменными
- [ ] `package.json`: `name` переименован, поля `engines` и `scripts` добавлены
- [ ] `rules/`, `payloads/`, `FL_RESIDENT_TEST_SUITE_v5/` добавлены в `.gitignore` если не нужны в репо

### Код

- [ ] `runner.js`: патч `status: ERROR` / `control: STOP` применён
- [ ] `server.js`: graceful shutdown (`SIGTERM` / `SIGINT`) добавлен
- [ ] `server.js`: `/health` возвращает 503 если `compiled` не готов
- [ ] `server.js`: CORS ограничен до доменов банка

### Docker

- [ ] `Dockerfile` создан (multi-stage, non-root)
- [ ] `.dockerignore` создан
- [ ] Образ собирается и запускается локально

### Kubernetes

- [ ] ConfigMap со снэпшотом создан
- [ ] `Deployment.yaml` с readiness/liveness probe, ресурсами, volumeMount
- [ ] `Service.yaml` создан
- [ ] HPA настроен
- [ ] Проверен rolling update без downtime

### CI/CD

- [ ] Пайплайн: lint → test → build-snapshot → docker-build → deploy
- [ ] Версионирование снэпшота и образа независимо
- [ ] Prod-деплой только через ручное подтверждение

### Безопасность

- [ ] `DOCS_ENABLED=false` в prod
- [ ] `/sandbox/*` закрыт от внешнего доступа
- [ ] `TRACE=0` в prod
- [ ] CORS ограничен
