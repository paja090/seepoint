import assert from 'node:assert/strict';
import test from 'node:test';
import { B2B_EMAIL_TEMPLATES, renderB2bOutreachEmailHtml } from '../lib/b2b-email-templates';

test('all 4 B2B email templates generate personalized subject and message', () => {
  for (const tpl of Object.values(B2B_EMAIL_TEMPLATES)) {
    const subject = tpl.defaultSubject('Outdoor Alfa s.r.o.');
    const message = tpl.defaultMessage({ contactName: 'pane Dvořáku', companyName: 'Outdoor Alfa s.r.o.' });
    assert.ok(subject.includes('Outdoor Alfa s.r.o.'));
    assert.ok(message.includes('pane Dvořáku'));
    assert.ok(message.includes('Outdoor Alfa s.r.o.'));
    assert.equal(tpl.highlights.length, 3);
  }
});

test('renderB2bOutreachEmailHtml renders branded HTML card, highlights, CTA and Pavel Šubert signature', () => {
  const tpl = B2B_EMAIL_TEMPLATES.NAVIGATION_VO;
  const html = renderB2bOutreachEmailHtml({
    segmentBadge: tpl.segmentBadge,
    subject: tpl.defaultSubject('Městská Media'),
    message: tpl.defaultMessage({ contactName: 'pane Svobodo', companyName: 'Městská Media' }),
    highlights: tpl.highlights,
    ctaLabel: tpl.ctaLabel,
    ctaUrl: tpl.ctaUrl,
  });

  assert.ok(html.includes('SeePoint'));
  assert.ok(html.includes('pane Svobodo'));
  assert.ok(html.includes('Google Street View'));
  assert.ok(html.includes('Pavel Šubert'));
  assert.ok(html.includes('+420 777 807 717'));
  assert.ok(html.includes('https://seepoint.cz'));
});
