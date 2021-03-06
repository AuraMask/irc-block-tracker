const IrcQuery = require('irc-query');
const pify = require('pify');
const BaseBlockTracker = require('./base');

const sec = 1000;
const min = 60 * sec;

class PollingBlockTracker extends BaseBlockTracker {

  constructor(opts = {}) {
    // parse + validate args
    if (!opts.provider) throw new Error('PollingBlockTracker - no provider specified.');
    const pollingInterval = opts.pollingInterval || 20 * sec;
    const keepEventLoopActive = opts.keepEventLoopActive !== undefined ? opts.keepEventLoopActive : true;
    // BaseBlockTracker constructor
    super(Object.assign({
      blockResetDuration: pollingInterval,
    }, opts));
    // config
    this._provider = opts.provider;
    this._pollingInterval = pollingInterval;
    this._keepEventLoopActive = keepEventLoopActive;
    // util
    this._query = new IrcQuery(this._provider);
  }

  //
  // public
  //

  // trigger block polling
  async checkForLatestBlock() {
    await this._updateLatestBlock();
    return await this.getLatestBlock();
  }

  //
  // private
  //

  _start() {
    this._performSync().catch(err => this.emit('error', err));
  }

  async _performSync() {
    while (this._isRunning) {
      try {
        await this._updateLatestBlock();
      } catch (err) {
        this.emit('error', err);
      }
      await timeout(this._pollingInterval, !this._keepEventLoopActive);
    }
  }

  async _updateLatestBlock() {
    // fetch + set latest block
    const latestBlock = await this._fetchLatestBlock();
    this._newPotentialLatest(latestBlock);
  }

  async _fetchLatestBlock() {
    return await pify(this._query.getBlockByNumber).call(this._query, 'latest', true);
  }

}

module.exports = PollingBlockTracker;

function timeout(duration, unref) {
  return new Promise(resolve => {
    const timoutRef = setTimeout(resolve, duration);
    // don't keep process open
    if (timoutRef.unref && unref) {
      timoutRef.unref();
    }
  });
}
