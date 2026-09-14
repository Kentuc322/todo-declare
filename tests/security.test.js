import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
test('公開配布ファイルに実キー・秘密鍵を含めない',()=>{for(const file of readdirSync(new URL('../dist/',import.meta.url))){const content=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');assert.ok(!/AIza[\w-]{30,}/.test(content),file);assert.ok(!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content),file);}});
test('UID限定ルールと未設定時の拒否を維持',()=>{const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');assert.match(rules,/request.auth.uid == 'REPLACE_WITH_OWNER_UID'/);assert.match(rules,/allow read, write: if false/);assert.ok(!/allow list|allow delete|if true/.test(rules));});
test('認証はメモリのみ、アカウント登録・管理鍵のデプロイなし',()=>{const code=readFileSync(new URL('../dist/cloud.js',import.meta.url),'utf8');assert.match(code,/inMemoryPersistence/);assert.ok(!/createUserWithEmailAndPassword|console\.|browserLocalPersistence/.test(code));assert.ok(!existsSync(new URL('../.github/workflows/backend.yml',import.meta.url)));});
