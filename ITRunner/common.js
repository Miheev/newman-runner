const colors = require('colors');
const cluster = require('cluster');

function logError(msg) {
  console.error(colors.red.bold(msg));
}

function disconnect() {
  try {
    cluster.disconnect();
  } catch (e) {
    broadcast({action: 'disconnect'});
  }
}

function broadcast(event) {
  Object.keys(cluster.workers).forEach((id) => {
    cluster.workers[id].send(event);
  });
}

module.exports = {
  params: {
    collectedTestFailures: [],
    totalTestCases: 0,
    testSuiteCount: 0,
    reportPathPattern: 'reports/%s.html'
  },

  logError,
  disconnect,
  broadcast,
};