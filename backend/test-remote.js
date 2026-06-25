async function test(url) {
  try {
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    const text = await res.text();
    console.log(`STATUS: ${res.status}`);
    console.log(`CONTENT-TYPE: ${res.headers.get('content-type')}`);
    console.log(`BODY: ${text}`);
  } catch (e) {
    console.error(`Error fetching ${url}:`, e);
  }
}

async function run() {
  await test('http://krovaa.com/api/admin/chats');
  await test('http://krovaa.com/api/admin/group-chats');
}
run();
