const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 8080,
  path: '/project',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});
req.on('error', (e) => console.error(e));
req.end();
