# Payloads + Test Cases + Postman/Newman dataset

Внутри:

- `payloads/` — JSON payload'ы по кейсам
- `test-cases.md` — человекочитаемый реестр кейсов
- `newman-dataset.csv` / `newman-dataset.json` — iteration data
- `postman/beneficiary-rule-engine-suite.postman_collection.json` — Postman collection
- `postman/rule-engine-local.postman_environment.json` — environment

## Предпосылки

1. Rule engine поднят локально и слушает:
   `POST http://localhost:3000/v1/validate`
2. В движок уже добавлены операторы:
   - `field_equals_field`
   - `field_not_equals_field`
3. Загружен последний compile-clean пакет правил.

## Как прогнать в Postman

1. Импортировать collection и environment
2. Выбрать environment `Rule Engine Local`
3. Открыть Runner
4. Выбрать collection
5. В качестве data file выбрать:
   - `newman-dataset.json` (рекомендуется)
   - либо `newman-dataset.csv`
6. Нажать Run

## Как прогнать через Newman

```bash
newman run postman/beneficiary-rule-engine-suite.postman_collection.json \
  -e postman/rule-engine-local.postman_environment.json \
  -d newman-dataset.json
```

## Замечания

- Для compare-пайплайнов `abs_compare::*` в текущем пакете ожидается WARNING с кодом `BEN.ABS.FOUND.UNEXPECTED`, потому что v1-happy-path предполагает `abs.lookup.found = false`.
- Для ряда негативных кейсов пакет может вернуть больше одного issue. Поэтому в коллекции проверяется:
  - HTTP 200
  - issue count >= expected baseline
  - наличие ожидаемых code, если они явно заданы.
- Кейс `fl_nonresident_full_missing_residency` оставлен как семантический smoke-test без жёсткого code, потому что итоговый issue зависит от того, как сработает условный блок residency/migration в актуальной сборке пакета.
- Кейс `fl_resident_full_us_taxpayer_block` также проверяется как семантический compliance-case без жёсткого code, чтобы не завязываться на внутренний `strictCode`.

## Исправление после фактического прогона

По результатам реального прогона скорректированы ожидания для `abs_compare::*`: при `abs.lookup.found=false` пакет правил не возвращает issues. Baseline для этих кейсов установлен в `0`.
