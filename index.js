const debug = require('debug')('b2-blob-store');
const duplex = require('duplexify');
const mime = require('mime');
const request = require('request').defaults({ json: true });


module.exports = Client;

function Client(opts = {}) {
  if (!(this instanceof Client)) {
    return new Client(opts);
  }
  if (!opts.token) {
    throw new Error('Must specify token');
  }
  if (!opts.baseDownloadURL) {
    throw new Error('Must specify baseDownloadURL');
  }
  this.baseURL = opts.baseURL || "https://api.backblaze.com/b2api/v1";
  this.baseDownloadURL = opts.baseDownloadURL;
  this.defaults = {
   'Authorization': "Bearer " + opts.token
  };
  this.bucket = opts.bucket;
}


Client.prototype.request = function(opts, cb) {
  let reqOpts = Object.assign({}, opts);
  reqOpts.headers = Object.assign({}, this.defaults, opts.headers);

  if (process.env.DEBUG) {
    debug('request', JSON.stringify(reqOpts));
  }
  if (!cb) {
    return request(reqOpts);
  }

  return request(reqOpts, (err, resp, body) => {
    if (process.env.DEBUG) {
      debug('response', err, resp.statusCode, body);
    }
    cb(err, resp, body);
  });
}

Client.prototype.createReadStream = function (opts) {
  let self = this;
  let proxy = duplex();
  let bucket = opts.bucket || this.bucket;

  if (!bucket) {
    return proxy.destroy(new Error('Must specify bucket'));
  }
  if (!opts.fileName) {
    return proxy.destroy(new Error('Must specify fileName'));
  }

  let url = this.baseDownloadURL + '/file/' + bucket + '/' + opts.fileName;

  let read = self.request({ url });
  proxy.setReadable(read);

  read.on('response', function(resp) {
    if (resp.statusCode > 299) {
      console.log(resp);
      proxy.destroy(new Error(resp.statusCode));
    }
  });

  read.on('error', function(err) {
    proxy.destroy(err);
  });

  return proxy;
}
