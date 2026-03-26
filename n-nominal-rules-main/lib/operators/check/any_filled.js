const { deepGet, isEmptyValue } = require("../../utils");
module.exports = function(rule, ctx) {
  try {
    const fields = Array.isArray(rule.fields)
      ? rule.fields
      : (Array.isArray(rule.paths) ? rule.paths : []);
    if (fields.length === 0) {
      return { status: "EXCEPTION", error: new Error("any_filled requires fields[]") };
    }
    const ok = fields.some((field) => {
      const got = deepGet(ctx.payload, field);
      return got.ok && !isEmptyValue(got.value);
    });
    return { status: ok ? "OK" : "FAIL" };
  } catch (e) { return { status: "EXCEPTION", error: e }; }
};
