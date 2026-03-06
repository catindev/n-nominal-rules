# Контракт flat-map для Rule Engine (v1) — полный перечень полей и допущений

Документ объединяет:

- исходный контракт для ABS-adapter;
- дополнения, необходимые для работы Rule Engine, compare-пайплайнов и state-machine оркестратора;
- авторские допущения по раскрытию `*`-групп до конкретных leaf-ключей.

## 1. Scope и принятые ограничения

Текущий пакет правил ориентирован на **v1 orchestrator scope** и поддерживает типы:

- `UL_RESIDENT`
- `UL_NONRESIDENT`
- `IP_RESIDENT`
- `IP_NONRESIDENT`
- `FL_RESIDENT`
- `FL_NONRESIDENT`

Физические лица (`FL_RESIDENT`, `FL_NONRESIDENT`) включены в контракт как приоритетный сегмент. Набор полей по ФЛ построен по ABS-контракту, формам отчетов по ФЛ и общим правилам БТ.

## 2. Глобальные поля заявки

| Поле                                 | Тип    | Назначение                           |
| ------------------------------------ | ------ | ------------------------------------ |
| `beneficiary.type`                   | string | тип бенефициара                      |
| `beneficiary.inn`                    | string | ИНН (обязателен для резидентов)      |
| `beneficiary.kio`                    | string | КИО (для нерезидентов)               |
| `beneficiary.participationId`        | string | идентификатор основания участия      |
| `beneficiary.contacts.phone`         | string | телефон в формате E.164              |
| `beneficiary.contacts.email`         | string | email                                |
| `beneficiary.contacts.phoneForeign`  | string | иностранный телефон                  |
| `beneficiary.contacts.postalAddress` | string | почтовый адрес                       |
| `beneficiary.status.startDate`       | string | дата начала статуса, `YYYY-MM-DD`    |
| `beneficiary.status.endDate`         | string | дата окончания статуса, `YYYY-MM-DD` |

## 3. Раскрытие адреса регистрации `beneficiary.address.registration.*`

Авторское раскрытие `*`-группы:

- `beneficiary.address.registration.countryCode`
- `beneficiary.address.registration.postalCode`
- `beneficiary.address.registration.regionCode`
- `beneficiary.address.registration.regionName`
- `beneficiary.address.registration.city`
- `beneficiary.address.registration.locality`
- `beneficiary.address.registration.street`
- `beneficiary.address.registration.house`
- `beneficiary.address.registration.building`
- `beneficiary.address.registration.apartment`
- `beneficiary.address.registration.addressLine`

## 4. Налоговый блок / CRS / FATCA

| Поле                                      | Тип                    |
| ----------------------------------------- | ---------------------- |
| `beneficiary.tax.isForeignTaxpayer`       | boolean                |
| `beneficiary.tax.foreign_tax_resident`    | boolean                |
| `beneficiary.tax.foreignCountries[0..n]`  | string[] (ISO alpha-2) |
| `beneficiary.tax.foreignTin[0..n]`        | string[]               |
| `beneficiary.tax.foreignTinAbsenceReason` | string (`A`,`B`,`C`)   |
| `beneficiary.tax.isPassiveNFE`            | boolean                |
| `beneficiary.tax.hasForeignControllers`   | boolean                |
| `beneficiary.tax.isUSTaxpayer`            | boolean                |
| `beneficiary.tax.hasUSControllers`        | boolean                |
| `beneficiary.tax.isUSTaxResident`         | boolean                |
| `beneficiary.tax.isUSResident`            | boolean                |
| `beneficiary.tax.is_foreign_id_doc`       | boolean                |

### 4.1 Раскрытие `beneficiary.tax.foreignAddress.*`

- `beneficiary.tax.foreignAddress.countryCode`
- `beneficiary.tax.foreignAddress.postalCode`
- `beneficiary.tax.foreignAddress.regionName`
- `beneficiary.tax.foreignAddress.city`
- `beneficiary.tax.foreignAddress.addressLine`

## 5. UL-specific поля

### 5.1 UL common

- `beneficiary.ul.name.full_ru`
- `beneficiary.ul.name.short_ru`
- `beneficiary.ul.name.full_en`
- `beneficiary.ul.name.short_en`
- `beneficiary.ul.opf`

### 5.2 UL resident

- `beneficiary.ul.ogrn`

### 5.3 UL nonresident

- `beneficiary.kio` используется как основной идентификатор вместо обязательного ИНН.

## 6. IP-specific поля

### 6.1 Базовый блок ИП

- `beneficiary.ip.name.full`
- `beneficiary.ip.fio.last`
- `beneficiary.ip.fio.first`
- `beneficiary.ip.fio.middle`
- `beneficiary.ip.birthDate`
- `beneficiary.ip.birthPlace`
- `beneficiary.ip.citizenship`
- `beneficiary.ip.ogrnip`
- `beneficiary.ip.organization.reg_place`

### 6.2 Блок документа `beneficiary.ip.idDoc.*`

- `beneficiary.ip.idDoc.typeCode`
- `beneficiary.ip.idDoc.typeName`
- `beneficiary.ip.idDoc.series`
- `beneficiary.ip.idDoc.number`
- `beneficiary.ip.idDoc.issueDate`
- `beneficiary.ip.idDoc.expireDate`
- `beneficiary.ip.idDoc.issuer`
- `beneficiary.ip.idDoc.issuer_code`
- `beneficiary.ip.idDoc.isForeignIdDoc`

### 6.3 Блок документа пребывания `beneficiary.ip.residency.*`

- `beneficiary.ip.residency.documentType`
- `beneficiary.ip.residency.series`
- `beneficiary.ip.residency.number`
- `beneficiary.ip.residency.permitStartDate`
- `beneficiary.ip.residency.permitEndDate`

### 6.4 Блок миграционной карты `beneficiary.ip.migrationCard.*`

- `beneficiary.ip.migrationCard.number`
- `beneficiary.ip.migrationCard.startDate`
- `beneficiary.ip.migrationCard.endDate`

## 7. Compare namespaces для Rule Engine

Для compare-пайплайнов требуется расширить контракт входного payload дополнительными namespaces.

### 7.1 EGR namespace

- `egr.beneficiary.type`
- `egr.beneficiary.inn`
- `egr.beneficiary.ul.name.full_ru`
- `egr.beneficiary.ip.name.full`

### 7.2 ABS namespace (минимум для v1)

- `abs.lookup.found` — boolean

В следующем этапе должен быть добавлен полноценный `abs.*` snapshot для compare merchant vs ABS.

## 8. Контекст вызова (`$context.*`)

Пакет правил предполагает, что оркестратор может передавать контекст выполнения в reserved namespace `$context.*`.
В текущем пакете правила на контекст не завязаны жестко, но рекомендуется передавать:

- `$context.branch`
- `$context.stage`
- `$context.merchantId`
- `$context.requestId`

## 9. Справочники

### 9.1 `beneficiary.type`

- `UL_RESIDENT`
- `UL_NONRESIDENT`
- `IP_RESIDENT`
- `IP_NONRESIDENT`

### 9.2 `beneficiary.tax.foreignTinAbsenceReason`

- `A`
- `B`
- `C`

### 9.3 boolean-поля

Все логические поля передаются как native JSON boolean:

- `true`
- `false`

## 10. Операторы, которые должны быть добавлены в движок до боевого использования compare-пайплайнов

Пакет правил использует будущие операторы:

- `field_equals_field`
- `field_not_equals_field`

Без них compare-пайплайны `*.egr_compare` и следующие версии `*.abs_compare` не смогут выполняться нативно внутри движка.

## 11. Файлы пакета

- `rules/dictionaries/` — справочники
- `rules/library/` — переиспользуемые правила
- `rules/pipelines/beneficiary_<type>/...` — пайплайны по типам
- `rules/pipelines/branch_*/...` — алиасы по веткам A/B/C
- `README.md` — карта пайплайнов и допущения

## 8. FL-specific поля

### 8.1 Базовый блок ФЛ

- `beneficiary.fl.fio.last`
- `beneficiary.fl.fio.first`
- `beneficiary.fl.fio.middle`
- `beneficiary.fl.birthDate`
- `beneficiary.fl.birthPlace`
- `beneficiary.fl.citizenship`

### 8.2 Блок документа `beneficiary.fl.idDoc.*`

- `beneficiary.fl.idDoc.typeCode`
- `beneficiary.fl.idDoc.typeName`
- `beneficiary.fl.idDoc.series`
- `beneficiary.fl.idDoc.number`
- `beneficiary.fl.idDoc.issueDate`
- `beneficiary.fl.idDoc.expireDate`
- `beneficiary.fl.idDoc.issuer`
- `beneficiary.fl.idDoc.issuer_code`
- `beneficiary.fl.idDoc.isForeignIdDoc`

### 8.3 Блок документа пребывания `beneficiary.fl.residency.*` (для нерезидентов)

- `beneficiary.fl.residency.documentType`
- `beneficiary.fl.residency.series`
- `beneficiary.fl.residency.number`
- `beneficiary.fl.residency.permitStartDate`
- `beneficiary.fl.residency.permitEndDate`

### 8.4 Блок миграционной карты `beneficiary.fl.migrationCard.*` (для нерезидентов)

- `beneficiary.fl.migrationCard.number`
- `beneficiary.fl.migrationCard.startDate`
- `beneficiary.fl.migrationCard.endDate`

### 8.5 Резидент / нерезидент

- Для `FL_RESIDENT` обязательны: `beneficiary.inn`, `beneficiary.fl.fio.last`, `beneficiary.fl.fio.first`.
- Для `FL_NONRESIDENT` минимальный набор в двухэтапных ветках строится на ФИО + дате рождения; в полном пакете обязательны личные и документные сведения.

## 9. Compare namespaces для Rule Engine

Для compare-пайплайнов требуется расширить контракт входного payload дополнительными namespaces.

### 9.1 EGR namespace

- `egr.beneficiary.type`
- `egr.beneficiary.inn`
- `egr.beneficiary.ul.name.full_ru`
- `egr.beneficiary.ip.name.full`

> Для FL-типы EGR namespace в текущем пакете не применяется, так как ветка A для физических лиц не используется.

### 9.2 ABS namespace (минимум для v1)

- `abs.lookup.found` — boolean

## 10. Принятые допущения по FL

1. `FL_RESIDENT` и `FL_NONRESIDENT` добавлены в словарь `beneficiary.type`.
2. Для compare по АБС в v1 для FL применяется минимальный сценарий `abs.lookup.found = false`.
3. Для `FL_NONRESIDENT` документ пребывания и миграционная карта моделируются по тем же правилам, что и для `IP_NONRESIDENT`, но в namespace `beneficiary.fl.*`.
4. Поле `beneficiary.kio` для ФЛ в пакет правил не включено как обязательное, так как в исходном контракте по ФЛ оно явно не закреплено как основной идентификатор.
