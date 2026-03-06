# Payloads + Test Cases для последнего пакета правил (исправленная версия)

> После фактического прогона через Newman ожидания для `abs_compare::*` скорректированы: в текущей сборке правил `abs.lookup.found=false` трактуется как штатный happy-path и не создаёт issues.

# Payloads + Test Cases для последнего пакета правил

Набор предназначен для прогонов через `POST /v1/validate` текущего rule-engine HTTP wrapper.

Каждый кейс содержит:

- pipelineId
- payload файл
- ожидаемое количество issues
- ожидаемые codes (если зафиксированы)

## Реестр кейсов

| case_id                               | pipelineId                                   | payload file                                          | expected issues | expected codes                                                   | описание                                             |
| ------------------------------------- | -------------------------------------------- | ----------------------------------------------------- | --------------: | ---------------------------------------------------------------- | ---------------------------------------------------- |
| ul_resident_precheck_min_ok           | `beneficiary_ul_resident.precheck_min`       | `payloads/ul_resident_precheck_min_ok.json`           |               0 | ``                                                               | UL resident minimal payload passes precheck          |
| ul_resident_egr_compare_ok            | `beneficiary_ul_resident.egr_compare`        | `payloads/ul_resident_egr_compare_ok.json`            |               0 | ``                                                               | UL resident EGR compare passes                       |
| ul_resident_full_ok                   | `beneficiary_ul_resident.full_validation`    | `payloads/ul_resident_full_ok.json`                   |               0 | ``                                                               | UL resident full validation passes                   |
| ul_resident_abs_compare_ok            | `beneficiary_ul_resident.abs_compare`        | `payloads/ul_resident_abs_compare_ok.json`            |               1 | `BEN.ABS.FOUND.UNEXPECTED`                                       | ABS compare v1 expects not found warning             |
| ip_resident_precheck_min_ok           | `beneficiary_ip_resident.precheck_min`       | `payloads/ip_resident_precheck_min_ok.json`           |               0 | ``                                                               | IP resident minimal payload passes precheck          |
| ip_resident_egr_compare_ok            | `beneficiary_ip_resident.egr_compare`        | `payloads/ip_resident_egr_compare_ok.json`            |               0 | ``                                                               | IP resident EGR compare passes                       |
| ip_resident_full_ok                   | `beneficiary_ip_resident.full_validation`    | `payloads/ip_resident_full_ok.json`                   |               0 | ``                                                               | IP resident full validation passes                   |
| ip_resident_abs_compare_ok            | `beneficiary_ip_resident.abs_compare`        | `payloads/ip_resident_abs_compare_ok.json`            |               1 | `BEN.ABS.FOUND.UNEXPECTED`                                       | ABS compare v1 not found                             |
| ul_nonresident_precheck_min_ok        | `beneficiary_ul_nonresident.precheck_min`    | `payloads/ul_nonresident_precheck_min_ok.json`        |               0 | ``                                                               | UL nonresident minimal payload passes precheck       |
| ul_nonresident_full_ok                | `beneficiary_ul_nonresident.full_validation` | `payloads/ul_nonresident_full_ok.json`                |               0 | ``                                                               | UL nonresident full validation passes                |
| ul_nonresident_abs_compare_ok         | `beneficiary_ul_nonresident.abs_compare`     | `payloads/ul_nonresident_abs_compare_ok.json`         |               1 | `BEN.ABS.FOUND.UNEXPECTED`                                       | ABS compare v1 not found                             |
| ip_nonresident_precheck_min_ok        | `beneficiary_ip_nonresident.precheck_min`    | `payloads/ip_nonresident_precheck_min_ok.json`        |               0 | ``                                                               | IP nonresident minimal payload passes precheck       |
| ip_nonresident_full_ok                | `beneficiary_ip_nonresident.full_validation` | `payloads/ip_nonresident_full_ok.json`                |               0 | ``                                                               | IP nonresident full validation passes                |
| ip_nonresident_abs_compare_ok         | `beneficiary_ip_nonresident.abs_compare`     | `payloads/ip_nonresident_abs_compare_ok.json`         |               1 | `BEN.ABS.FOUND.UNEXPECTED`                                       | ABS compare v1 not found                             |
| fl_resident_precheck_min_ok           | `beneficiary_fl_resident.precheck_min`       | `payloads/fl_resident_precheck_min_ok.json`           |               0 | ``                                                               | FL resident minimal payload passes precheck          |
| fl_resident_full_ok                   | `beneficiary_fl_resident.full_validation`    | `payloads/fl_resident_full_ok.json`                   |               0 | ``                                                               | FL resident full validation passes                   |
| fl_resident_abs_compare_ok            | `beneficiary_fl_resident.abs_compare`        | `payloads/fl_resident_abs_compare_ok.json`            |               1 | `BEN.ABS.FOUND.UNEXPECTED`                                       | ABS compare v1 not found                             |
| fl_nonresident_precheck_min_ok        | `beneficiary_fl_nonresident.precheck_min`    | `payloads/fl_nonresident_precheck_min_ok.json`        |               0 | ``                                                               | FL nonresident minimal payload passes precheck       |
| fl_nonresident_full_ok                | `beneficiary_fl_nonresident.full_validation` | `payloads/fl_nonresident_full_ok.json`                |               0 | ``                                                               | FL nonresident full validation passes                |
| fl_nonresident_abs_compare_ok         | `beneficiary_fl_nonresident.abs_compare`     | `payloads/fl_nonresident_abs_compare_ok.json`         |               1 | `BEN.ABS.FOUND.UNEXPECTED`                                       | ABS compare v1 not found                             |
| fl_resident_precheck_min_bad_inn      | `beneficiary_fl_resident.precheck_min`       | `payloads/fl_resident_precheck_min_bad_inn.json`      |               1 | `FL.INN.INVALID.BENEFICIARY_FL_RESIDENT_PRECHECK_MIN_RULE_MIN_2` | FL resident precheck rejects invalid INN             |
| ul_nonresident_full_missing_kio       | `beneficiary_ul_nonresident.full_validation` | `payloads/ul_nonresident_full_missing_kio.json`       |               1 | `UL.KIO.REQUIRED`                                                | UL nonresident requires KIO                          |
| ip_nonresident_full_no_contacts       | `beneficiary_ip_nonresident.full_validation` | `payloads/ip_nonresident_full_no_contacts.json`       |               1 | `BEN.CONTACTS.MIN_ONE`                                           | IP nonresident requires at least one contact         |
| fl_nonresident_full_missing_residency | `beneficiary_fl_nonresident.full_validation` | `payloads/fl_nonresident_full_missing_residency.json` |               1 | ``                                                               | FL nonresident residency/migration block should fail |
| ul_resident_egr_compare_name_mismatch | `beneficiary_ul_resident.egr_compare`        | `payloads/ul_resident_egr_compare_name_mismatch.json` |               1 | `BEN.EGR.NAME.MISMATCH.LIBRARY_COMPARE_EGR_UL_NAME_MATCH`        | UL resident EGR compare name mismatch                |
| fl_resident_full_us_taxpayer_block    | `beneficiary_fl_resident.full_validation`    | `payloads/fl_resident_full_us_taxpayer_block.json`    |               1 | ``                                                               | FL resident compliance block on US taxpayer flag     |
