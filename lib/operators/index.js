/**
 * lib/operators/index.js
 *
 * Extends the standard jsonspecs operator set with bank-specific operators:
 *   valid_inn   — validates Russian TIN (ИНН), 10- and 12-digit variants
 *   valid_ogrn  — validates Russian OGRN/OGRNIP (ОГРН), 13- and 15-digit variants
 *
 * Usage:
 *   const { Operators } = require("./lib/operators");
 *   const engine = createEngine({ operators: Operators });
 */
const { Operators: BaseOperators } = require("jsonspecs");

const chk_valid_inn  = require("./check/valid_inn");
const chk_valid_ogrn = require("./check/valid_ogrn");

const Operators = {
  predicate: {
    ...BaseOperators.predicate,
  },
  check: {
    ...BaseOperators.check,
    valid_inn:  chk_valid_inn,
    valid_ogrn: chk_valid_ogrn,
  },
};

module.exports = { Operators };
