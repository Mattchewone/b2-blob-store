# b2-blob-store
Backblaze B2 blob store implementation.

This is not currently working and is a WIP, this is not published to NPM.

[![blob-store-compatible](https://raw.githubusercontent.com/maxogden/abstract-blob-store/master/badge.png)](https://github.com/maxogden/abstract-blob-store)

## Example
```js
const b2Blob = require('../');
const request = require('request').defaults({ json: true });
const fs = require('fs');


const url = 'https://api.backblaze.com/b2api/v1/b2_authorize_account';
const base64 = new Buffer(process.env.accountId + ':' + process.env.applicationKey).toString('base64');
const headers = {
  Authorization: 'Basic ' + base64
};

// Authorise the account
request({ url, headers }, (err, resp, body) => {
  let store = new b2Blob({
    token: body.authorizationToken,
    baseDownloadURL: body.downloadUrl,
    apiUrl: body.apiUrl,
    bucket: process.env.bucketId
  });

  fs.createReadStream('./test.txt')
  .pipe(store.createWriteStream({ key: 'test.txt' }, (err, meta) => {
    console.log('err', err);
    console.log('meta', meta);
  }))
  .pipe(process.stdout)
  .on('error', function (e) {
    console.error('error', e);
  });
});
```

## TBD
- [ ] Get file size from the stream so we can add to `Content-Length`
- [ ] SHA1 the file data so we can verify the data upload
