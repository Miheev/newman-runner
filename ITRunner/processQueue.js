const { EventEmitter } = require('events');
const cluster = require('cluster');
const { resolve } = require('path');

const { logError, disconnect, broadcast, params } = require('./common');

module.exports = class ProcessQueue {
  constructor(asyncTaskCount, threadMode, execTest) {
    this.asyncTaskCount = asyncTaskCount || 1;
    this.threadMode = threadMode === undefined ? false : threadMode;
    this.execTest = execTest || require('./testExecutor.js');

    this.waitList = [];
    this.runCount = 0;
    this.emitter = new EventEmitter();
    this.theadPool = [];

    this.runTask = this.runFunction;
    if (this.threadMode) {
      this.prepareThreads();
    }

    this.triggerComplete = undefined;

    this.emitter.on('runNext', () => {
      this.onRunNext();
    });

    this.emitter.once('done', () => {
      this.onDone();
    });
  }

  prepareThreads() {
    this.runTask = this.runThread;
    cluster.setupMaster({ silent: true, exec: resolve(__dirname, this.execTest) });

    let index;
    let worker;
    for (index = 0; index < this.asyncTaskCount; index += 1) {
      worker = cluster.fork();
      worker.process.stdout.pipe(process.stdout);
      worker.process.stderr.pipe(process.stderr);
      this.addFreeThread(worker.id);
    }

    let theadDoneCount = 0;
    cluster.on('message', (worker, message, handle) => {
      const { action, payload } = message;

      switch (action) {
        case 'success':
          this.runCount -= 1;
          this.addFreeThread(worker.id);

          if (this.isEmpty()) {
            return this.emitDone();
          }

          this.emitter.emit('runNext');
          break;
        case 'threadDone':
          params.collectedTestFailures = params.collectedTestFailures.concat(payload.collectedTestFailures);
          params.totalTestCases += payload.totalTestCases;

          theadDoneCount += 1;
          if (theadDoneCount === this.asyncTaskCount) {
            disconnect();
            this.triggerComplete();
          }
          break;
        default:
          logError('Unexpected error on running queue task');
          throw payload;
      }
    });
  }

  addFreeThread(index) {
    this.theadPool.push({ free: true, id: index });
  }

  /**
   * Should be [function, ...functionArguments],
   * but currently functionArguments array supported only.
   * Efficiency has been chosen instead of general behaviour
   * Function as task should be defined via constructor
   *
   * @param executable: functionArguments[]
   */
  add(executable) {
    this.waitList.push(executable);
  }

  isEmpty() {
    return !this.waitList.length && !this.runCount;
  }

  emitDone() {
    this.emitter.emit('done');
  }

  async run() {
    return new Promise((resolve, reject) => {
      this.triggerComplete = resolve;
      if (this.isEmpty()) {
        return this.emitDone();
      }

      this.emitter.emit('runNext');
    });
  }

  runThread(args) {
    const thread = this.theadPool.shift();
    if (!thread) {
      throw new Error('All threads are busy. Can not allocate a thread');
    }
    cluster.workers[thread.id].send({ action: 'next', payload: args });
  }

  runFunction(args) {
    this.execTest(...args).then(() => {
      this.runCount -= 1;
      if (this.isEmpty()) {
        return this.emitDone();
      }
      this.emitter.emit('runNext');
    }, (error) => {
      logError('Unexpected error on running queue task');
      throw error;
    });
  }

  onRunNext() {
    if (this.isEmpty()) {
      return this.emitDone();
    }

    const waitCount = this.waitList.length;
    const reserveCount = this.asyncTaskCount - this.runCount;
    if (!reserveCount) {
      return;
    }

    const availableCount = waitCount >= reserveCount ? reserveCount : waitCount;
    let index;
    for (index = 0; index < availableCount; index += 1) {
      this.runCount += 1;
      this.runTask(this.waitList.shift());
    }
  }

  onDone() {
    this.emitter.removeAllListeners('runNext');
    if (this.threadMode) {
      broadcast({action: 'done'});
    } else {
      this.triggerComplete();
    }
  }
};