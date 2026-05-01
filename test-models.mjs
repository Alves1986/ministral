import https from 'https';

https.get('https://openrouter.ai/api/v1/models', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const freeModels = data.data.filter(m => m.id.includes('free')).map(m => m.id);
      console.log(freeModels.join('\n'));
    } catch (e) {}
  });
});
