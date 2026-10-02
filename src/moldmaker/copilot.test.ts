import { expect, test } from 'vitest';
import { parseCommandRules } from '/dev-server/src/moldmaker/moldDoctorAi';
test('rules', () => { expect(parseCommandRules('silicone mold, split along x, 6 mm pour hole, add vents')).toEqual({ axis:'x', moldMode:'silicone', sprueDiameterMm:6, autoVents:true }); });
