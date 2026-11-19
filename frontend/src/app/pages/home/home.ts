import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../../core/seo.service';
import { Faq, FaqItem } from '../../shared/faq/faq';

interface UseCaseTile {
  name: string;
  blurb: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Faq],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly steps = [
    { title: 'Tell us what you do', body: 'Pick your use cases, the apps you rely on, how hard you push them and what you plan to do next.' },
    { title: 'Our engine evaluates configurations', body: 'Every RAM, storage and chip variant is scored on its own, not just the model name.' },
    { title: 'Get personalized recommendations', body: 'See your top matches with a full score breakdown and the reasoning behind each ranking.' },
  ];

  protected readonly useCases: UseCaseTile[] = [
    { name: 'Software Development', blurb: 'IDEs, containers, simulators' },
    { name: 'Video Editing', blurb: 'Timelines, codecs, exports' },
    { name: 'Graphic Design', blurb: 'Large canvases and color work' },
    { name: 'AI/ML Development', blurb: 'Local models and notebooks' },
    { name: 'Business & Productivity', blurb: 'Office, calls, multitasking' },
    { name: 'Students', blurb: 'Notes, research, long days' },
    { name: 'Content Creation', blurb: 'Edit, publish, repeat' },
    { name: 'General Everyday Use', blurb: 'Browsing, streaming, email' },
  ];

  protected readonly families = [
    { name: 'MacBook Air', blurb: 'The thinner, lighter family. Built for portability and battery life.' },
    { name: 'MacBook Pro', blurb: 'The family with the higher-end chips and larger memory and storage options.' },
  ];

  protected readonly reasons = [
    { title: 'Configuration-level analysis', body: 'The same model with 16GB or 24GB of memory can be a very different machine for you. We score each one.' },
    { title: 'Memory-aware', body: 'Unified memory is weighted heavily and under-specced configurations are penalised, whatever the chip.' },
    { title: 'Explainable results', body: 'Every ranking comes with category scores and plain-language reasons.' },
    { title: 'Transparent commerce', body: 'Affiliate links never influence scores, and we label what is official, merchant-reported or estimated.' },
  ];

  protected readonly faq: FaqItem[] = [
    { q: 'What is MacRequire?', a: 'MacRequire is a recommendation site for MacBooks. You describe your apps, workload, budget and plans, and it scores every individual MacBook configuration against them and explains the ranking.' },
    { q: 'Is MacRequire free to use?', a: 'Yes. You do not need an account. We earn a commission if you buy through some links, at no extra cost to you.' },
    { q: 'Do commissions change the recommendations?', a: 'No. Commission rates and affiliate relationships are never inputs to a score. Read the affiliate disclosure for details.' },
    { q: 'Are the scores benchmarks?', a: 'No. Scores are our own estimates of how well a configuration fits your workload. They are not measured benchmark results. The methodology page lists the categories and assumptions.' },
    { q: 'How current are the prices?', a: 'Prices are reported by merchants and each one shows when it was last checked. They can change at any time, so confirm the price on the merchant’s site before you buy.' },
    { q: 'Does MacRequire sell laptops?', a: 'No. We link to merchants. MacRequire is independent and is not affiliated with Apple Inc.' },
  ];

  constructor() {
    const seo = inject(Seo);
    seo.set({
      title: 'MacRequire | Find the MacBook That Actually Fits Your Needs',
      description: 'Tell MacRequire your apps, workload and budget. It scores every MacBook configuration and explains which memory, storage and chip fit you best.',
      path: '/',
      jsonLd: [seo.organization(), seo.website(), seo.faq(this.faq)],
    });
  }
}
