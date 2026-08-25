fetch('https://api-2jtv46nvba-uc.a.run.app/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'adminGetStoreItems', args: ['mock_token', 'primary'] })
}).then(r => r.json()).then(console.log);
