/**
 * docs-routes.js
 *
 * Браузерная документация движка — только для dev-режима.
 * Шаблоны: views/*.ejs   Статика: static/
 *
 * Монтируется в server.js:
 *   if (IS_DEV) require('./docs-routes')(app, ctx);
 *
 * Маршруты:
 *   GET /                     — список корневых пайплайнов
 *   GET /pipelines/:id(*)     — страница пайплайна
 *   GET /rules/:id(*)         — страница правила
 *   GET /conditions/:id(*)    — страница условия
 *   GET /dictionaries/:id(*)  — страница справочника
 *   GET /static/*             — CSS, JS, иконки
 */

"use strict";

const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const express = require("express");

const VIEWS_DIR = path.join(__dirname, "views");
const STATIC_DIR = path.join(__dirname, "static");

// Иконки — загружаем один раз при старте
const ICON_NAMES = [
  "big-logotype",
  "big-pipline",
  "big-pipline-library",
  "big-rule",
  "big-rule-library",
  "big-condition",
  "big-condition-library",
  "big-dictionary",
  "pipeline-list-icon",
  "rule-list-icon",
  "condition-list-icon",
  "pipeline-list-icon-library",
  "rule-list-icon-library",
  "condition-list-icon-library",
  "predicate-list-icon",
  "check-icon",
  "check-icon-library",
  "predicate-icon",
  "predicate-icon-library",
  "level-icon",
  "level-icon-library",
  "field-icon",
  "field-icon-library",
  "operator-icon",
  "operator-icon-library",
  "value-icon",
  "value-icon-library",
  "dictionary-icon",
  "dictionary-icon-library",
];
const icons = {};
for (const name of ICON_NAMES) {
  const file = path.join(STATIC_DIR, "icons", name + ".svg");
  icons[name] = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

// Манифест пакета правил — загружается при старте, перечитывается при hot-reload
function loadManifest(rulesDir) {
  const file = path.join(
    rulesDir || path.join(__dirname, "rules"),
    "manifest.json",
  );
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.warn("[docs] manifest parse error:", e.message);
    return {};
  }
}

function render(res, view, locals, manifest) {
  const file = path.join(VIEWS_DIR, view + ".ejs");
  ejs.renderFile(
    file,
    { ...locals, icons, manifest: manifest || {} },
    { views: VIEWS_DIR },
    (err, html) => {
      if (err) {
        console.error("[docs] render error:", err.message);
        return res.status(500).send("<pre>" + err.message + "</pre>");
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    },
  );
}


// ── Анализ метрик пайплайна ───────────────────────────────────────────────
function analyzePipeline(rootPipelineId, compiled) {
  const stats = {
    totalSteps:      0,   // все шаги во всём дереве
    rules:           0,   // шагов-правил
    conditions:      0,   // шагов-условий
    pipelines:       0,   // шагов-пайплайнов
    maxDepth:        0,   // максимальная глубина вложенности
    librarySteps:    0,   // шаги из library.*
    localSteps:      0,   // локальные шаги
    ruleIds:         [],  // все ruleId в дереве (с повторами)
    warnings:        [],  // предупреждения
  };

  const DEPTH_WARN  = 5;
  const STEPS_WARN  = 60;
  const LIBRARY_LOW = 50; // % — ниже которого предупреждаем

  // Рекурсивный обход
  function walk(steps, depth, visited) {
    if (!steps || !steps.length) return;
    if (depth > stats.maxDepth) stats.maxDepth = depth;

    for (const step of steps) {
      stats.totalSteps++;

      if (step.kind === 'rule') {
        stats.rules++;
        stats.ruleIds.push(step.ruleId);
        if (step.ruleId && step.ruleId.startsWith('library.')) stats.librarySteps++;
        else stats.localSteps++;

      } else if (step.kind === 'condition') {
        stats.conditions++;
        const isLib = step.conditionId && step.conditionId.startsWith('library.');
        if (isLib) stats.librarySteps++; else stats.localSteps++;

        // Обходим шаги внутри condition
        const cmp = compiled.conditions && compiled.conditions.get(step.conditionId);
        if (cmp && !visited.has(step.conditionId)) {
          visited.add(step.conditionId);
          walk(cmp.steps, depth + 1, visited);
        }

      } else if (step.kind === 'pipeline') {
        stats.pipelines++;
        const isLib = step.pipelineId && step.pipelineId.startsWith('library.');
        if (isLib) stats.librarySteps++; else stats.localSteps++;

        const cmp = compiled.pipelines && compiled.pipelines.get(step.pipelineId);
        if (cmp && !visited.has(step.pipelineId)) {
          visited.add(step.pipelineId);
          walk(cmp.steps, depth + 1, visited);
        }
      }
    }
  }

  const root = compiled.pipelines && compiled.pipelines.get(rootPipelineId);
  if (!root) return null;

  walk(root.steps, 1, new Set([rootPipelineId]));

  // Дубли правил
  const ruleCount = {};
  for (const id of stats.ruleIds) ruleCount[id] = (ruleCount[id] || 0) + 1;
  const duplicates = Object.entries(ruleCount)
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  // Предупреждения
  if (stats.maxDepth >= DEPTH_WARN)
    stats.warnings.push(`Глубина вложенности ${stats.maxDepth} — рекомендуется не более ${DEPTH_WARN - 1}`);
  if (stats.totalSteps >= STEPS_WARN)
    stats.warnings.push(`Всего шагов ${stats.totalSteps} — сценарий может быть сложным для сопровождения`);
  const libPct = stats.totalSteps > 0 ? Math.round(stats.librarySteps / stats.totalSteps * 100) : 0;
  if (libPct < LIBRARY_LOW && stats.totalSteps > 5)
    stats.warnings.push(`Только ${libPct}% шагов из библиотеки — возможно стоит вынести правила в library`);
  for (const [id, n] of duplicates)
    stats.warnings.push(`Правило ${id} встречается ${n} раза в дереве — возможен дубль`);

  return {
    totalSteps:   stats.totalSteps,
    rules:        stats.rules,
    conditions:   stats.conditions,
    pipelines:    stats.pipelines,
    maxDepth:     stats.maxDepth,
    librarySteps: stats.librarySteps,
    localSteps:   stats.localSteps,
    libraryPct:   libPct,
    duplicates:   duplicates.slice(0, 10),
    warnings:     stats.warnings,
  };
}

module.exports = function mountDocs(app, ctx) {
  // Путь к rules/ — берём из ctx если есть, иначе рядом с docs-routes.js
  const rulesDir = ctx.rulesDir || path.join(__dirname, "rules");
  // dev: читаем с диска + hot-reload; prod: берём из ctx.manifest (встроен в снэпшот)
  let manifest = ctx.manifest || loadManifest(rulesDir);
  console.log(
    "[docs] manifest:",
    manifest.name ? `loaded "${manifest.name}"` : "not found (using empty)",
  );

  if (ctx.on) {
    ctx.on("reload", () => {
      manifest = loadManifest(rulesDir);
    });
  }

  app.use("/static", express.static(STATIC_DIR));

  // Главная — только корневые пайплайны (id без точки)
  app.get("/", (req, res) => {
    const pipelines = [];
    for (const [id, a] of ctx.compiled.registry) {
      if (a.type === "pipeline" && a.entrypoint === true) pipelines.push(a);
    }
    pipelines.sort((a, b) => a.id.localeCompare(b.id));
    render(res, "home", { pipelines }, manifest);
  });

  // Пайплайн
  app.get("/pipelines/:id", (req, res) => {
    const a = ctx.compiled.registry.get(req.params.id);
    if (!a || a.type !== "pipeline")
      return res.status(404).send("Pipeline not found: " + req.params.id);
    const cmp = ctx.compiled.pipelines && ctx.compiled.pipelines.get(a.id);
    const steps = cmp ? cmp.steps : [];
    render(
      res,
      "pipeline",
      { pipeline: a, steps, compiled: ctx.compiled },
      manifest,
    );
  });

  // Статистика пайплайна
  app.get("/pipelines/:id/stats", (req, res) => {
    const a = ctx.compiled.registry.get(req.params.id);
    if (!a || a.type !== "pipeline")
      return res.status(404).send("Pipeline not found: " + req.params.id);
    const result = analyzePipeline(a.id, ctx.compiled);
    if (!result) return res.status(500).send("Failed to analyze pipeline");
    render(res, "stats", { pipeline: a, stats: result }, manifest);
  });

  // Playground — тест пайплайна
  app.get("/pipelines/:id/playground", (req, res) => {
    const a = ctx.compiled.registry.get(req.params.id);
    if (!a || a.type !== "pipeline")
      return res.status(404).send("Pipeline not found: " + req.params.id);
    const payloadsDir = path.join(rulesDir, '..', 'payloads');
    const examples = [];
    if (fs.existsSync(payloadsDir)) {
      for (const f of fs.readdirSync(payloadsDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(payloadsDir, f), 'utf8');
          const obj = JSON.parse(raw);
          if (obj.context && obj.context.pipelineId === a.id)
            examples.push({ name: f.replace('.json', ''), body: raw });
        } catch(e) { /* skip */ }
      }
    }
    // Собираем краткий registry для трейса: ruleId -> {field, operator, role, description}
    const traceRegistry = {};
    for (const [id, art] of ctx.compiled.registry) {
      if (art.type === 'rule') {
        traceRegistry[id] = {
          description: art.description || '',
          role: art.role || '',
          field: art.field || '',
          operator: art.operator || '',
          value: art.value !== undefined ? JSON.stringify(art.value) : '',
        };
      }
    }
    render(res, "playground", { pipeline: a, examples, traceRegistry: JSON.stringify(traceRegistry) }, manifest);
  });

    // Правило
  app.get("/rules/:id", (req, res) => {
    const a = ctx.compiled.registry.get(req.params.id);
    if (!a || a.type !== "rule")
      return res.status(404).send("Rule not found: " + req.params.id);
    render(res, "rule", { rule: a }, manifest);
  });

  // Условие
  app.get("/conditions/:id", (req, res) => {
    const a = ctx.compiled.registry.get(req.params.id);
    if (!a || a.type !== "condition")
      return res.status(404).send("Condition not found: " + req.params.id);
    render(
      res,
      "condition",
      { condition: a, compiled: ctx.compiled },
      manifest,
    );
  });

  // Справочник
  app.get("/dictionaries/:id", (req, res) => {
    const a = ctx.compiled.registry.get(req.params.id);
    if (!a || a.type !== "dictionary")
      return res.status(404).send("Dictionary not found: " + req.params.id);
    render(res, "dictionary", { dictionary: a }, manifest);
  });

  console.log(
    "[docs] UI available at http://localhost:" +
      (process.env.PORT || 3000) +
      "/",
  );
};
