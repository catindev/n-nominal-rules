# Инструменты из экосистемы JSON Schema (что стоит сделать для JSONSpecs)

> Анализ применительно к реальному коду движка и пакету правил FL_RESIDENT

У JSON Schema за годы сложилась богатая экосистема инструментов. Часть из них универсальные стандарты, которые движок правил мог бы воспроизвести у себя. Ниже разбор по категориям: что есть у JSON Schema, что из этого реально нужно движку, что уже есть, что отсутствует.

## 1. Schema Registry (реестр схем/артефактов)

**Что есть у JSON Schema:** Apicurio Registry, Sourcemeta One системы хранения и версионирования схем с веб-интерфейсом, поиском, историей версий и API для получения схем.

**Что есть в движке сейчас:** снэпшот единый JSON-файл со всеми артефактами. Версия фиксируется при сборке. Хранится на диске или в ConfigMap.

**Чего нет:** HTTP-API для получения конкретного артефакта по `id`, истории версий снэпшотов, сравнения версий. Сейчас чтобы узнать что изменилось между снэпшотами нужно вручную diff-ить два JSON-файла.

**Что стоит сделать:**

```
GET /v1/artifacts/:id             → вернуть конкретное правило/пайплайн/условие
GET /v1/artifacts?type=rule       → список по типу
GET /v1/snapshots                 → история версий
GET /v1/snapshots/:version/diff   → diff двух снэпшотов
```

Это дало бы возможность оркестратору запрашивать актуальные правила, а аналитику видеть историю изменений в UI.

## 2. Lint / статический анализ

**Что есть у JSON Schema:** `ajv-cli`, `Sourcemeta JSON Schema CLI`, `v8r` валидаторы схем из командной строки. Проверяют корректность схемы до запуска.

**Что есть в движке сейчас:** `build-snapshot.js` компилирует артефакты и падает с ошибками если что-то не так. Это уже хорошо.

**Чего нет:** предупреждения (не только ошибки). Например:

- правило с кодом, который нигде не обрабатывается в пайплайне
- predicate, на который нет ни одной ссылки из condition
- condition, который никогда не может стать true (взаимоисключающие предикаты)
- поле с опечаткой в `field` (не совпадает ни с одним полем из manifest.fields)

**Что стоит сделать:** расширить `build-snapshot.js` режимом `--lint` с уровнями WARNING/ERROR. Аналог ESLint-правил настраиваемые проверки, которые не блокируют сборку, но предупреждают.

```bash
node tools/build-snapshot.js --lint

[WARN] library.fl.pred_inn_present: predicate не используется ни в одном condition
[WARN] library.tax.foreign_address_required: поле beneficiary.tax.foreignResidencies0.address
       не объявлено в manifest.fields
[ERROR] library.documents.cond_domestic_doc_consistency: шаг rule_is_foreign_false
        ссылается на несуществующий артефакт
```

## 3. Генерация тестовых данных

**Что есть у JSON Schema:** `@faker-js/faker` + JSON Schema, `json-schema-faker` генераторы валидных и невалидных данных по схеме. Используются для автотестов.

**Что есть в движке сейчас:** ручной тест-сюит `FL_RESIDENT_TEST_SUITE_v5` 19 сценариев, написанных вручную.

**Чего нет:** автоматической генерации граничных случаев. Например, для правила `matches_regex` с паттерном `^\d{6}$` автоматически сгенерировать: строку длиной 5, длиной 7, с буквами, пустую строку и проверить что каждый случай даёт ожидаемый `code`.

**Что стоит сделать:** утилита `tools/generate-test-cases.js` по артефактам правил генерирует набор payload-ов с явными нарушениями каждого правила. На выходе JSON с ожидаемыми `issues`. Прогоняется в CI как регрессионный тест.

```
node tools/generate-test-cases.js --rule library.fl.citizenship_not_us

Сгенерировано 4 кейса:
  [PASS] citizenshipCode: "RU"  → нет ошибки
  [FAIL] citizenshipCode: "US"  → BEN.FL.CITIZENSHIP.NOT_US (EXCEPTION)
  [FAIL] citizenshipCode: ""    → BEN.FL.CITIZENSHIP.REQUIRED (EXCEPTION)
  [FAIL] citizenshipCode: null  → BEN.FL.CITIZENSHIP.REQUIRED (EXCEPTION)
```

## 4. Документация из схемы (Schema to Docs)

**Что есть у JSON Schema:** Redoc, Stoplight Elements, Swagger UI рендерят человекочитаемую документацию из OpenAPI/JSON Schema автоматически.

**Что есть в движке сейчас:** встроенная авто-документации (`docs-routes.js`) показывает пайплайны, правила, условия. Это уже значительно лучше чем у JSON Schema из коробки.

**Чего нет:**

- Экспорт документации в статический HTML (для передачи бизнесу без запуска сервера)
- Поиск по всем артефактам
- Страница "какие правила используют поле X" (обратный поиск по `field`)
- Страница "какие пайплайны включают правило Y" (обратный поиск по ссылкам)
- Changelog между версиями снэпшота в читаемом виде

**Что стоит сделать:**

```bash
# Статический экспорт UI в папку
node tools/export-docs.js --output ./docs-static/

# Обратный поиск кто использует поле
GET /search?field=beneficiary.fl.citizenshipCode
→ [rule: citizenship_not_us, rule: citizenship_required, rule: citizenship_code_format]

# Changelog
GET /v1/snapshots/diff?from=1.1.0&to=1.2.0
→ { added: [...], removed: [...], modified: [...] }
```

## 5. IDE-интеграция (Language Server Protocol)

**Что есть у JSON Schema:** JSON Schema LSP языковой сервер для VS Code, JetBrains, Neovim. Даёт автодополнение, валидацию при наборе, hover-документацию прямо в редакторе.

**Что есть в движке сейчас:** нет ничего. Аналитик пишет JSON-артефакты в текстовом редакторе без подсказок.

**Чего нет:** при наборе `"operator": "` нет подсказки какие операторы доступны для `role: "check"`. При `"field": "beneficiary.fl.` нет подсказки из `manifest.fields`. При неправильном `"level"` нет подчёркивания ошибки.

**Что стоит сделать:** JSON Schema для самих артефактов движка. Это не требует написания LSP достаточно опубликовать `rule.schema.json`, `pipeline.schema.json`, `condition.schema.json` и добавить в каждый артефакт строку:

```json
{ "$schema": "https://rules.bank.ru/schemas/rule.schema.json", ... }
```

VS Code подхватит схему автоматически и даст валидацию + автодополнение бесплатно через встроенный JSON Language Server.

Пример схемы для правила:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Rule artifact",
  "type": "object",
  "required": ["id", "type", "role", "operator", "field"],
  "properties": {
    "type": { "const": "rule" },
    "role": { "enum": ["check", "predicate"] },
    "operator": {
      "enum": [
        "not_empty",
        "equals",
        "matches_regex",
        "in_dictionary",
        "greater_than",
        "less_than",
        "any_filled",
        "valid_inn",
        "length_max",
        "length_equals",
        "contains",
        "is_empty",
        "not_equals",
        "field_equals_field",
        "field_not_equals_field",
        "field_greater_than_field",
        "field_less_than_field"
      ]
    },
    "level": { "enum": ["WARNING", "ERROR", "EXCEPTION"] },
    "field": { "type": "string" }
  },
  "if": { "properties": { "role": { "const": "check" } } },
  "then": { "required": ["level", "code", "message"] },
  "else": { "not": { "required": ["level", "code", "message"] } }
}
```

Это самая дешёвая в реализации фича с максимальным эффектом для аналитика.

## 6. Мониторинг и метрики выполнения

**Что есть у JSON Schema:** нет прямого аналога это уже за пределами валидации.

**Чего нет в движке:** `/metrics` endpoint для Prometheus. Сейчас непонятно:

- Сколько запросов в секунду
- Какое p95 время выполнения пайплайна
- Какие коды ошибок встречаются чаще всего (топ issues по `code`)
- Сколько запросов завершились EXCEPTION vs ERROR vs OK

**Что стоит сделать:**

```js
// Минимум счётчики без внешних зависимостей
const metrics = {
  requests_total: 0,
  status_ok: 0,
  status_error: 0,
  status_exception: 0,
  status_abort: 0,
  duration_sum_ms: 0,
  issue_codes: {}, // { "BEN.FL.CITIZENSHIP.NOT_US": 42, ... }
};

app.get("/metrics", (_req, res) => {
  // Prometheus text format
  res.type("text/plain").send(`
    rules_engine_requests_total ${metrics.requests_total}
    rules_engine_status_ok_total ${metrics.status_ok}
    rules_engine_status_error_total ${metrics.status_error}
    rules_engine_status_exception_total ${metrics.status_exception}
    rules_engine_duration_avg_ms ${metrics.duration_sum_ms / metrics.requests_total || 0}
  `);
});
```

Это позволяет подключить Grafana-дашборд и увидеть какие бизнес-правила срабатывают чаще всего в проде.

## 7. Тестовый runner (аналог Postman или ajv-cli)

**Что есть у JSON Schema:** `ajv-cli validate`, `v8r` прогон схемы против файла прямо из терминала. Используется в CI без поднятия сервера.

**Что есть в движке сейчас:** форма ручного тестирования `fl-resident-sandbox.html` работает в браузере, требует запущенного сервера.

**Чего нет:** CLI-команды для прогона правил без HTTP.

**Что стоит сделать:**

```bash
# Прогнать один payload через пайплайн
node bin/checker.js \
  --pipeline entrypoints.c.fl_resident.full_validation \
  --payload payloads/fc-pos-01.json

# Прогнать весь тест-сюит
node bin/checker.js \
  --suite FL_RESIDENT_TEST_SUITE_v5/ \
  --snapshot snapshot.json

Результат:
  19 тестов: 17 OK, 2 FAILED
  [FAIL] FV-NEG-04: ожидался EXCEPTION, получен ERROR
  [FAIL] PC-POS-01: ожидаемый code BEN.TYPE.REQUIRED не найден в issues
```

Это ключевой инструмент для CI прогон тест-сюита против нового снэпшота до деплоя.

## Приоритизация

| Инструмент                                 | Сложность           | Ценность                                   | Приоритет |
| ------------------------------------------ | ------------------- | ------------------------------------------ | --------- |
| JSON Schema для артефактов (IDE-поддержка) | Низкая — 1–2 дня    | Высокая — аналитик сразу видит ошибки      | **1**     |
| CLI-runner тест-сюита                      | Низкая — 2–3 дня    | Высокая — CI без браузера                  | **2**     |
| Lint-режим build-snapshot                  | Средняя — 3–5 дней  | Высокая — находит мёртвые правила          | **3**     |
| Метрики `/metrics` (Prometheus)            | Низкая — 1–2 дня    | Средняя — видимость в проде                | **4**     |
| Обратный поиск в UI (кто использует поле)  | Средняя — 3–4 дня   | Средняя — при рефакторинге правил          | **5**     |
| Генерация тест-кейсов                      | Высокая — 5–8 дней  | Средняя — нужна методология                | **6**     |
| Registry API + история версий              | Высокая — 8–12 дней | Средняя — нужна когда пакетов станет много | **7**     |
| Changelog между снэпшотами                 | Средняя — 3–5 дней  | Средняя — нужна при частых обновлениях     | **8**     |

Пункты 1 и 2 — неделя работы суммарно, а закрывают самые болезненные пробелы: ошибки при написании правил и регрессионное тестирование в CI.
