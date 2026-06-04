import https from 'https';

const token = process.env.VITE_OPENROUTER_API_KEY || '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';

const req = https.request('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status', res.statusCode, '\nBody', body));
});

req.write(JSON.stringify({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente especialista em gestão eclesiástica.'
      },
      { role: 'user', content: 'test' }
    ],
}));
req.end();
