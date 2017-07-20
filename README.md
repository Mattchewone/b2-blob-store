# b2-blob-store
backblaze b2 blob store

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
