const debug = require('debug')('b2-blob-store');
const duplex = require('duplexify');
const mime = require('mime');
const request = require('request').defaults({ json: true });
const concat = require('concat-stream');


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

  this.apiUrl = opts.apiUrl || 'https://api.backblaze.com/b2api/v1';
  this.baseDownloadURL = opts.baseDownloadURL;
  this.defaults = {
   'Authorization': opts.token
  };
  this.token = opts.token;
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

Client.prototype.exists = function(opts, cb) {
  var self = this;
  var bucket = opts.bucket || this.bucket;

  if (!bucket) {
    return proxy.destroy(new Error('Must specify bucket'));
  }
  if (!opts.fileName) {
    return proxy.destroy(new Error('Must specify fileName'));
  }

  let url = `${this.baseDownloadURL}/file/${bucket}/${opts.fileName}`;

  self.request({ url }, function(err, resp, data) {
    if (err) {
      return cb(err);
    }
    if (resp.statusCode === 404) {
      return cb(null, false);
    }
    cb(null, !!data);
  });
}

Client.prototype.remove = function(opts, cb) {
  var self = this;
  var bucket = opts.bucket || this.bucket;
  if (!bucket) {
    return cb(new Error('must specify bucket'));
  }
  if (!opts.fileId) {
    return cb(new Error('must specify fileId'));
  }
  if (!opts.fileName) {
    return cb(new Error('must specify fileName'));
  }

  let fileId = opts.fileId;
  let fileName = opts.fileName;
  let url = `${this.apiUrl}/b2api/v1/b2_delete_file_version`;

  self.request({ url, method: 'POST', json: { fileId, fileName } }, function(err, resp, data) {
    if (err) {
      return cb(err);
    }
    if (resp.statusCode > 299) {
      return cb(new Error(data));
    }
    cb(null);
  })
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

  let url = `${this.baseDownloadURL}/file/${bucket}/${opts.fileName}`;

  let read = self.request({ url });
  proxy.setReadable(read);

  read.on('response', function(resp) {
    if (resp.statusCode > 299) {
      proxy.destroy(new Error(resp.statusCode));
    }
  });

  read.on('error', function(err) {
    proxy.destroy(err);
  });

  return proxy;
}

Client.prototype.createWriteStream = function(options, cb) {
  let self = this;
  let proxy = duplex();

  let bucket = options.bucket || this.bucket;
  if (!bucket) {
    let err = new Error('Must specify bucket');
    cb(err);
    proxy.destroy(err);
    return proxy;
  }

  // Need to get upload_url first
  let uploadUrl = `${this.apiUrl}/b2api/v1/b2_get_upload_url`;
  self.request({ url: uploadUrl, method: 'POST', json: { bucketId: bucket } }, function(err, resp, body) {
    if (err) {
      proxy.destroy(err);
      return cb(err);
    }
    if (resp.statusCode > 299) {
      let error = new Error(JSON.stringify({ code: resp.statusCode, error: body }))
      proxy.destroy(error);
      return cb(error);
    }

    let newSession = {
      method: 'POST',
      url: body.uploadUrl,
      headers: {
        'X-Bz-File-Name': options.key,
        'Content-Type': mime.lookup(options.key),
        'Authorization': body.authorizationToken,
        'X-Bz-Content-Sha1': 'do_not_verify', // need access to data so we can sha1 the data
        'Content-Length': 10
      }
    };

    let upload = self.request(newSession);
    proxy.setWritable(upload);

    upload.on('response', function(resp) {
      resp.pipe(concat(function(body) {
        let meta = JSON.parse(body);
        cb(null, meta);
      }));
    });

    upload.on('error', function(err) {
      proxy.destroy(err);
      cb(err);
    });
  });

  return proxy;
}
