import {TestBed} from '@angular/core/testing';
import type {Mermaid} from 'mermaid';
import {MermaidLoaderService} from './mermaid-loader.service';

describe('Deferred diagram renderer', () => {
  it('shares concurrent imports and renders a diagram after loading', async () => {
    const service = TestBed.inject(MermaidLoaderService);
    const first = service.load();
    expect(service.load()).toBe(first);
    await first;
    const mermaid = (window as unknown as {mermaid: Mermaid}).mermaid;
    mermaid.initialize({startOnLoad: false});
    const diagram = await mermaid.render('deferred-diagram-test', 'graph TD; Start-->Finish');
    expect(diagram.svg).toContain('<svg');
    expect(diagram.svg).toContain('Finish');
  });
});
