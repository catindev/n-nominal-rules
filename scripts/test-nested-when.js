"use strict";

const assert = require("assert");
const { createEngine } = require("../lib");
const { Operators } = require("../lib/operators");
const { renderWhenText } = require("../lib/when-render");

const artifacts = [
  { id: "demo.pred_a", type: "rule", description: "pred a", role: "predicate", field: "a", operator: "equals", value: true },
  { id: "demo.pred_b", type: "rule", description: "pred b", role: "predicate", field: "b", operator: "equals", value: true },
  { id: "demo.pred_c", type: "rule", description: "pred c", role: "predicate", field: "c", operator: "equals", value: true },
  {
    id: "demo.cond_nested",
    type: "condition",
    description: "nested condition",
    when: { all: ["pred_a", { any: ["pred_b", "pred_c"] }] },
    steps: [{ rule: "demo.rule_x" }],
  },
  { id: "demo.rule_x", type: "rule", description: "rule x", role: "check", field: "x", operator: "not_empty", level: "ERROR", code: "X.REQ", message: "x required" },
  { id: "demo", type: "pipeline", description: "demo pipeline", entrypoint: true, strict: false, flow: [{ condition: "cond_nested" }] },
];

const engine = createEngine({ operators: Operators });
const compiled = engine.compile(artifacts);
const cond = compiled.conditions.get("demo.cond_nested");
assert(cond, "compiled condition not found");
assert.equal(cond.when.mode, "all");
assert.equal(cond.when.items[1].mode, "any");

const text = renderWhenText(cond.when, (id) => id, { wrapGroups: true });
assert.equal(text, "demo.pred_a и (demo.pred_b или demo.pred_c)");

const okRes = engine.runPipeline(compiled, "demo", { a: true, b: false, c: true, x: "yes" });
assert.equal(okRes.status, "OK");

const failRes = engine.runPipeline(compiled, "demo", { a: true, b: false, c: true });
assert.equal(failRes.status, "ERROR");
assert(failRes.issues.some((x) => x.code === "X.REQ"));

const skipRes = engine.runPipeline(compiled, "demo", { a: false, b: true, c: true });
assert.equal(skipRes.status, "OK");
assert.equal(skipRes.issues.length, 0);

console.log("nested when tests: OK");
