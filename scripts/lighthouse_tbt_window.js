#!/usr/bin/env node
// Recomputes Lighthouse's Total Blocking Time from a saved LHR and shows which
// tasks landed inside the [FCP, TTI] window.
//
// Docs: docs/TBT_VERDICT_2026-10-28.md sections 24-28.
//
// The clipping rule below is the one Lighthouse/Lantern uses, see
// @paulirish/trace_engine/models/trace/lantern/metrics/TBTUtils.js
//   calculateTbtImpactForEvent(event, startTimeMs, endTimeMs):
//     clip the task to [startTimeMs, endTimeMs], then subtract the 50 ms
//     blocking threshold from the clipped duration.
// Here startTimeMs is the *simulated* FCP and endTimeMs the *simulated* TTI,
// both taken from the same LHR (see TotalBlockingTime.getEstimateFromSimulation:
// it uses fcpResult optimistic/pessimistic estimates, not the observed paint).
//
// Why this exists: on byte-identical trees this site's TBT swings between 0 and
// 737 ms because the window start is decided by a race (which render-blocking
// resources finish before the observed first paint). This tool makes that
// decomposition checkable from an LHR alone, with no browser and no network.
//
// Usage:
//   node scripts/lighthouse_tbt_window.js path/to/report.json [more.json ...]
//   node scripts/lighthouse_tbt_window.js --self-test
//
// Get an LHR with tasks and timings:  lighthouse <url> --output=json --output-path=r.json
// (add --save-assets if you also want the trace).

'use strict';

const fs = require('fs');

const BLOCKING_THRESHOLD_MS = 50;

// Mirrors calculateSumOfBlockingTime() from TBTUtils.js.
function sumOfBlockingTime(tasks, startTimeMs, endTimeMs) {
  if (endTimeMs <= startTimeMs) return 0;
  let total = 0;
  const details = [];
  for (const task of tasks) {
    const start = task.startTime;
    const end = task.startTime + task.duration;
    if (end < startTimeMs || start > endTimeMs) continue;
    const clippedStart = Math.max(start, startTimeMs);
    const clippedEnd = Math.min(end, endTimeMs);
    const clippedDuration = clippedEnd - clippedStart;
    if (clippedDuration < BLOCKING_THRESHOLD_MS) continue;
    const contribution = clippedDuration - BLOCKING_THRESHOLD_MS;
    total += contribution;
    details.push({
      start, end, duration: task.duration,
      clippedStart, clippedEnd, clippedDuration, contribution,
    });
  }
  return {total, details};
}

function readTasks(lhr) {
  const audit = lhr.audits && lhr.audits['long-tasks'];
  const items = (audit && audit.details && audit.details.items) || [];
  return items.map(item => ({
    startTime: Number(item.startTime) || 0,
    duration: Number(item.duration) || 0,
    url: item.url || '',
  }));
}

function analyse(lhr, label) {
  const audits = lhr.audits || {};
  const numeric = key => {
    const audit = audits[key];
    return audit && typeof audit.numericValue === 'number' ? audit.numericValue : null;
  };
  const fcp = numeric('first-contentful-paint');
  const tti = numeric('interactive');
  const reported = numeric('total-blocking-time');
  const tasks = readTasks(lhr);

  const out = {label, url: lhr.finalUrl || lhr.requestedUrl || '', fcp, tti, reported, tasks: tasks.length};
  if (fcp === null || tti === null) {
    out.error = 'LHR is missing first-contentful-paint or interactive (TTI). ' +
      'TTI is absent when Lighthouse cannot place idle time (NO_TTI_CPU_IDLE_PERIOD).';
    return out;
  }
  const {total, details} = sumOfBlockingTime(tasks, fcp, tti);
  out.predicted = total;
  out.delta = reported === null ? null : Math.abs(reported - total);
  out.details = details;
  return out;
}

function printResult(result) {
  console.log('='.repeat(72));
  console.log(result.label + '  ' + result.url);
  if (result.error) {
    console.log('  ERROR: ' + result.error);
    return;
  }
  console.log('  window: start (simulated FCP) = ' + result.fcp.toFixed(0) +
    ' ms, end (simulated TTI) = ' + result.tti.toFixed(0) + ' ms');
  console.log('  tasks in LHR: ' + result.tasks);
  const inside = result.details.slice().sort((a, b) => a.start - b.start);
  for (const d of inside) {
    console.log('    task ' + d.duration.toFixed(0).padStart(5) + ' ms @' + d.start.toFixed(0).padStart(6) +
      '  clipped [' + d.clippedStart.toFixed(0) + ', ' + d.clippedEnd.toFixed(0) + ']' +
      ' = ' + d.clippedDuration.toFixed(0).padStart(4) + ' ms -> ' + d.contribution.toFixed(0).padStart(5) + ' ms');
  }
  const outside = result.tasks - inside.length;
  if (outside > 0) console.log('    (' + outside + ' task(s) outside the window — they cost nothing here)');
  console.log('  predicted TBT = ' + result.predicted.toFixed(1) + ' ms' +
    '   | reported = ' + (result.reported === null ? 'n/a' : result.reported.toFixed(1) + ' ms') +
    '   | delta = ' + (result.delta === null ? 'n/a' : result.delta.toFixed(1) + ' ms'));
  if (result.delta !== null && result.delta > 5) {
    console.log('  NOTE: delta > 5 ms means this LHR\'s task list and its reported TBT do not describe');
    console.log('        the same computation — usually a rounded or truncated task list in the report.');
  }
}

// Fixtures come from the two red pages of CI run 40802536703 on 306ec5b.
// Values are the ones printed in the public reports; the task durations there
// are rounded to whole ms, so a small delta is expected on the bento case.
const FIXTURES = [
  {
    label: 'self-test: /svadebnye-torty/ on 306ec5b (report 1793238775241-16700)',
    finalUrl: 'https://milovicake.ru/svadebnye-torty/',
    audits: {
      'first-contentful-paint': {numericValue: 1114},
      interactive: {numericValue: 2004},
      'total-blocking-time': {numericValue: 690},
      'long-tasks': {details: {items: [
        {startTime: 816, duration: 72},
        {startTime: 909, duration: 112},
        {startTime: 1021, duration: 187},
        {startTime: 1208, duration: 215},
        {startTime: 1423, duration: 199},
        {startTime: 1622, duration: 403},
      ]}},
    },
  },
  {
    label: 'self-test: /bento-torty/ on 306ec5b (report 1793238775538-36495)',
    finalUrl: 'https://milovicake.ru/bento-torty/',
    audits: {
      'first-contentful-paint': {numericValue: 1114},
      interactive: {numericValue: 2143},
      'total-blocking-time': {numericValue: 730},
      'long-tasks': {details: {items: [
        {startTime: 865, duration: 311},
        {startTime: 1221, duration: 129},
        {startTime: 1350, duration: 135},
        {startTime: 1485, duration: 289},
        {startTime: 1774, duration: 382},
      ]}},
    },
  },
];

function selfTest() {
  let ok = true;
  for (const fixture of FIXTURES) {
    const result = analyse(fixture, fixture.label);
    printResult(result);
    const passed = result.delta !== null && result.delta <= 5;
    if (!passed) ok = false;
    console.log(passed
      ? '  PASS: reproduces the reported value within 5 ms (delta ' + result.delta.toFixed(1) + ' ms)'
      : '  FAIL: expected ~' + fixture.audits['total-blocking-time'].numericValue + ' ms, got ' + (result.predicted || 0).toFixed(1) + ' ms');
    console.log('='.repeat(72));
  }
  console.log(ok
    ? 'PASS: the clipping rule reproduces both reported TBT values from the task lists alone.'
    : 'FAIL: see above.');
  return ok;
}

function main(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log('Usage: node scripts/lighthouse_tbt_window.js <lhr.json> [...] | --self-test');
    return 0;
  }
  if (argv[0] === '--self-test') return selfTest() ? 0 : 1;

  let failed = 0;
  for (const file of argv) {
    let lhr;
    try {
      lhr = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(file + ': cannot read LHR (' + err.message + ')');
      failed = 1;
      continue;
    }
    printResult(analyse(lhr, file));
  }
  return failed;
}

process.exit(main(process.argv.slice(2)));
