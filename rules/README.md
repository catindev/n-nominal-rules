# Пакет правил Rule Engine для заявок на бенефициаров (v1)

## Что внутри

Пакет покрывает:

- ветку A (`UL_RESIDENT`, `IP_RESIDENT`) `precheck_min`, `egr_compare`, `full_validation`, `abs_compare`
- ветку B (`UL_NONRESIDENT`, `IP_NONRESIDENT`, `FL_RESIDENT`, `FL_NONRESIDENT`) `full_validation`, `abs_compare`
- ветку C (`UL_NONRESIDENT`, `IP_NONRESIDENT`, `FL_RESIDENT`, `FL_NONRESIDENT`) `precheck_min`, `full_validation`, `abs_compare`

## Карта пайплайнов

### Ветка A

- `branch_a.ul_resident.precheck_min`
- `branch_a.ul_resident.egr_compare`
- `branch_a.ul_resident.full_validation`
- `branch_a.ul_resident.abs_compare`
- `branch_a.ip_resident.precheck_min`
- `branch_a.ip_resident.egr_compare`
- `branch_a.ip_resident.full_validation`
- `branch_a.ip_resident.abs_compare`

### Ветка B

- `branch_b.ul_nonresident.full_validation`
- `branch_b.ul_nonresident.abs_compare`
- `branch_b.ip_nonresident.full_validation`
- `branch_b.ip_nonresident.abs_compare`
- `branch_b.fl_resident.full_validation`
- `branch_b.fl_resident.abs_compare`
- `branch_b.fl_nonresident.full_validation`
- `branch_b.fl_nonresident.abs_compare`

### Ветка C

- `branch_c.ul_nonresident.precheck_min`
- `branch_c.ul_nonresident.full_validation`
- `branch_c.ul_nonresident.abs_compare`
- `branch_c.ip_nonresident.precheck_min`
- `branch_c.ip_nonresident.full_validation`
- `branch_c.ip_nonresident.abs_compare`
- `branch_c.fl_resident.precheck_min`
- `branch_c.fl_resident.full_validation`
- `branch_c.fl_resident.abs_compare`
- `branch_c.fl_nonresident.precheck_min`
- `branch_c.fl_nonresident.full_validation`
- `branch_c.fl_nonresident.abs_compare`

## Важные допущения

1. Compare-пайплайны используют будущие операторы `field_equals_field` и `field_not_equals_field`
2. Категория исключения для оркестратора задается через `meta.category`
3. Поля групп `*.address.*`, `*.foreignAddress.*`, `*.residency.*`, `*.migrationCard.*` раскрыты авторским решением в файле `beneficiary-rule-engine-contract-v1.md`
4. Пакет ориентирован на v1-scope orchestration: основной happy-path — `ABS_FOUND = false` → `CREATE_AND_BIND`
5. FL-типы включены в пакет как приоритетный сегмент, исходя из уточнения бизнеса о доминирующей доле физических лиц среди бенефициаров.

## Рекомендация по следующему шагу

После добавления операторов compare:

- прогнать compile на всем пакете;
- затем добавить `abs.*` snapshot contract и отдельные compare-пайплайны merchant vs absSnapshot.
