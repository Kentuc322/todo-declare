import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFeedback} from '../dist/feedback.js';
test('画面通知には内容・表示状態・失敗種別を付ける',()=>{
  const states=new Set(),host={dataset:{},setAttribute(){},classList:{add:x=>states.add(x),remove:x=>states.delete(x)}};
  const show=createFeedback({createElement:()=>host,body:{append(){}}});
  show('保存できませんでした','error');assert.equal(host.textContent,'保存できませんでした');assert.equal(host.dataset.kind,'error');assert.ok(states.has('visible'));
});
