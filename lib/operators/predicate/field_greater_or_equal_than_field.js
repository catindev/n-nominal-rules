const { deepGet, toComparable } = require("../../utils");

module.exports = function (rule, ctx) {
  try {
    const a = deepGet(ctx.payload, rule.field);
    const b = deepGet(ctx.payload, rule.value_field);

    if (!a.ok || !b.ok) return { status: "UNDEFINED" };

    const left = toComparable(a.value);
    const right = toComparable(b.value);
    if (!left || !right || left.kind !== right.kind) return { status: "UNDEFINED" };

    return {
      status: left.value >= right.value ? "TRUE" : "FALSE",
    };
  } catch (e) {
    return { status: "EXCEPTION", error: e };
  }
};
