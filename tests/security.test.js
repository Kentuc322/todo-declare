import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
test('公開配布ファイルに実キー・秘密鍵・古いFirebase SDKを含めない',()=>{
  for(const file of readdirSync(new URL('../dist/',import.meta.url))){
    const content=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
    assert.ok(!/AIza[\w-]{30,}/.test(content),file);
    assert.ok(!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content),file);
    assert.ok(!/firebasejs\//.test(content),file);
  }
});
test('デプロイ認証はOIDCで、秘密鍵を埋め込まない',()=>{
  const content=readFileSync(new URL('../.github/workflows/backend.yml',import.meta.url),'utf8');
  assert.match(content,/workload_identity_provider/);assert.ok(!/credentials_json|secrets\./.test(content));
});
