import ts from 'typescript';
import { attr, attrText, define, finding, hasName, hasSpread, isOpening } from './rule-helpers.js';
import type { Rule, RuleFinding } from './types.js';

const interactive = new Set(['button', 'input', 'select', 'textarea', 'a', 'summary']);
export const accessibilityRules: Rule[] = [
  define('image-alt', 'Missing image alternative', 'accessibility', 'medium', 'Native images need alt text (empty alt is valid for decoration).', ctx => ctx.files.flatMap(file => file.nodes.filter(isOpening).filter(n => n.tagName.getText() === 'img' && !attr(n, 'alt') && !hasSpread(n)).map(n => finding(file, n, 'Image has no alt attribute.', 'Add descriptive alt text, or alt="" for a decorative image.', 'Screen readers use alternatives to communicate image content.')))),
  define('semantic-button', 'Non-semantic click target', 'accessibility', 'medium', 'Prefer native controls for clickable elements.', ctx => ctx.files.flatMap(file => file.nodes.filter(isOpening).filter(n => /^(div|span|p|li|section)$/.test(n.tagName.getText()) && !!attr(n, 'onClick') && !(attrText(n, 'role') === 'button' && !!attr(n, 'tabIndex') && (!!attr(n, 'onKeyDown') || !!attr(n, 'onKeyUp')))).map(n => finding(file, n, 'Clickable element lacks button semantics and keyboard handling.', 'Use a native <button> for an action.', 'Mouse-only handlers exclude keyboard and assistive-technology users.', 0.95)))),
  define('form-label', 'Missing form label', 'accessibility', 'medium', 'Native form controls need a visible or accessible label.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) {
      const openings = file.nodes.filter(isOpening);
      for (const n of openings) {
        if (!/^(input|select|textarea)$/.test(n.tagName.getText()) || /^(hidden|submit|reset|button|image)$/.test(attrText(n, 'type') ?? '') || hasSpread(n)) continue;
        if (attr(n, 'aria-label') && attrText(n, 'aria-label') !== '' || attr(n, 'aria-labelledby') && attrText(n, 'aria-labelledby') !== '') continue;
        const id = attrText(n, 'id');
        if (id && openings.some(label => label.tagName.getText() === 'label' && attrText(label, 'htmlFor') === id && hasName(label))) continue;
        let parent: ts.Node | undefined = n.parent; let wrapped = false;
        while (parent) { if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === 'label' && hasName(parent.openingElement)) { wrapped = true; break; } parent = parent.parent; }
        if (!wrapped) out.push(finding(file, n, 'Form control has no detectable label.', 'Associate a <label htmlFor="id"> with this control or provide aria-label.', 'A placeholder does not replace a persistent accessible label.', 0.9));
      }
    }
    return out;
  }),
  define('nested-interactive', 'Nested interactive controls', 'accessibility', 'medium', 'Avoid interactive controls inside buttons and links.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes.filter(isOpening)) {
      if (!interactive.has(n.tagName.getText())) continue;
      let parent: ts.Node | undefined = ts.isJsxElement(n.parent) && n.parent.openingElement === n ? n.parent.parent : n.parent;
      while (parent) {
        if (ts.isJsxElement(parent) && /^(button|a)$/.test(parent.openingElement.tagName.getText())) { out.push(finding(file, n, 'Interactive control is nested inside a button or link.', 'Make the controls siblings with separate focus targets.', 'Nested controls produce confusing keyboard and assistive-technology behavior.')); break; }
        parent = parent.parent;
      }
    }
    return out;
  }),
  define('aria-misuse', 'Basic ARIA misuse', 'accessibility', 'medium', 'Validate common boolean ARIA values and focusable aria-hidden controls.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes.filter(isOpening)) {
      for (const name of ['aria-hidden', 'aria-expanded', 'aria-selected', 'aria-disabled', 'aria-required', 'aria-modal']) {
        const value = attrText(n, name);
        if (value !== undefined && !['true', 'false'].includes(value)) out.push(finding(file, n, `${name} has invalid boolean value "${value}".`, 'Use true or false for this ARIA attribute.', 'Invalid ARIA values may be ignored by assistive technology.'));
      }
      if (attrText(n, 'aria-hidden') === 'true' && (interactive.has(n.tagName.getText()) || (attr(n, 'tabIndex') && attrText(n, 'tabIndex') !== '-1')) && !attr(n, 'disabled')) out.push(finding(file, n, 'Potentially focusable element is hidden from assistive technology.', 'Remove aria-hidden or remove the element from interaction and focus.', 'Keyboard focus should not land on content hidden from screen readers.', 0.9));
    }
    return out;
  }),
  define('accessible-name', 'Missing accessible name', 'accessibility', 'medium', 'Buttons and links need an accessible name.', ctx => ctx.files.flatMap(file => file.nodes.filter(isOpening).filter(n => /^(button|a)$/.test(n.tagName.getText()) && !hasName(n)).map(n => finding(file, n, 'Control has no detectable accessible name.', 'Add visible text or a meaningful aria-label.', 'Users need a name describing the destination or action.', 0.9)))),
];
