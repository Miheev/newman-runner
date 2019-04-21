const { promisify, format } = require('util');
const { green, red, inverse } = require('colors');
const { cpus } = require('os');
const recursiveReaddirDefault = require('recursive-readdir');

const { logError, disconnect, params } = require('./common');
const executorConfig = require('./newmanConfig');
const ProcessQueue = require('./processQueue');
const deepCopy = require('./deepCopy');

const cpuCount = cpus().length;
const ASYNC_TASK_COUNT = Number(process.argv[3] || (cpuCount > 5 ? 5 : cpuCount));
const port = Number(process.argv[2] || 8080);
const isAsyncMode = Boolean(process.argv[4]);

executorConfig.globals.values[0].value = port;
const testQueue = isAsyncMode
  ? new ProcessQueue(ASYNC_TASK_COUNT, false, require('./testExecutor'))
  : new ProcessQueue(ASYNC_TASK_COUNT, true, './testExecutor.js');
const recursiveReaddir = promisify(recursiveReaddirDefault);

!async function() {
  console.time('TestTime');

  let files;
  try {
    files = await recursiveReaddir('./com', [ignorePathsAndFiles]);
  } catch (e) {
    logError('Error on recursive read');
    throw e;
  }

  if (!files || !files.length) {
    finish();
  }

  params.testSuiteCount = files.length;
  files.forEach((file) => {
    testQueue.add([file, isAsyncMode ? executorConfig : deepCopy(executorConfig)]);
  });

  try {
    await testQueue.run();
  } catch (e) {
    disconnect();
    logError('Error on queue run');
    throw e;
  }

  finish();
}();

function finish() {
  return process.exit(
    collectResults(),
  );
}

function collectResults() {
  process.stdout.write(
    format('%s %d test suites, %d specs executed in total, ', inverse.bold('\n\nAPI integration test results:'),
      params.testSuiteCount, params.totalTestCases),
  );
  if (!params.collectedTestFailures.length) {
    console.log(green.bold('done without errors\n'));
    console.timeEnd('TestTime');
    return 0;
  }

  logError(params.collectedTestFailures.length + ' failed\n');
  params.collectedTestFailures.forEach((failure, idx) => {
    logError(format(
      '  %d. %s:', (idx + 1), failure.file, failure.item,
    ));
  });

  console.log(red.bold(format('\nPlease refer to detailed reports (%s) for more information\n', params.reportPathPattern)));
  console.timeEnd('TestTime');
  return 1;
}

function ignorePathsAndFiles(file, stats) {
  return file.endsWith('/node') || file.endsWith('/node_modules')
    || (!stats.isDirectory() && file.substr(-7) !== 'IT.json');
}
