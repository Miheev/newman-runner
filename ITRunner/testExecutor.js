const { run } = require('newman');
const { inverse } = require('colors');
const { format } = require('util');
const path = require('path');

const { logError, params } = require('./common');

function execTest(file, executorConfig) {
  return new Promise((resolve, reject) => {
    const config = executorConfig;
    config.collection = require(path.resolve(process.cwd(), file));
    config.reporter.html.export = path.resolve(process.cwd(), format(params.reportPathPattern, file));

    // resolve(true);
    // return ;

    run(config)
      .on('start', () => {
        console.log('\n\n' + inverse('Processing: ' + file));
      })
      .on('assertion', (failure, summary) => {
        params.totalTestCases += 1;

        if (failure) {
          params.collectedTestFailures.push({
            file: file,
            item: summary.item.name,
          });
        }
      })
      .on('done', () => {
        resolve(true);
      });
  });
}

!async function() {
  const cluster = require('cluster');

  if (cluster.isMaster) {
    return;
  }

  console.log(`Worker ${process.pid} started`);

  process.on('message', function({ action, payload }) {
    switch (action) {
      case 'next':
        execTest(...payload).then(() => {
          process.send({ action: 'success', });
        }, (error) => {
          process.send({ action: 'exception', payload: error });
        });
        break;
      case 'done':
        process.send({ action: 'threadDone', payload: params });
        break;
      case 'disconnect':
        cluster.worker.disconnect();
        break;
      default:
        logError('Worker: Unsupported event type - ' + action);
    }
  });


}();

module.exports = execTest;