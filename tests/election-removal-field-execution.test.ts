import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskSpec, taskSteps } from '../lib/election-removal/task-spec';
test('production photo policy distinguishes installation, removal and inspection',()=>{
 for(const [operationType,photoType] of [['INSTALL_OBJECT','AFTER_INSTALLATION'],['REPLACE_AD','AFTER_INSTALLATION'],['REMOVE_AD','AFTER_DEINSTALLATION'],['INSPECTION','CONTROL']]) {
  const steps=taskSteps(parseTaskSpec({label:'Object',description:'Precise instructions',latitude:50,longitude:14,gpsConfirmed:true,mediaType:'OTHER',operationType,materialDisposition:'LEAVE'}));
  assert.equal(steps[0].photoType,photoType);
 }
});
// Full lifecycle, statistics, partial quantities and retries execute the production service in field-work-execution.test.ts.
