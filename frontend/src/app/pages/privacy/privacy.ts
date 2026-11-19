import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CONTENT_DATES, prettyDate } from '../../core/site';
import { Seo } from '../../core/seo.service';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink, Breadcrumbs],
  styleUrl: '../prose.scss',
  template: `
    <article class="container prose">
      <app-breadcrumbs [items]="[{ name: 'Home', path: '/' }, { name: 'Privacy policy', path: '/privacy' }]" />
      <h1>Privacy policy</h1>
      <p class="updated">Last updated {{ updated }}</p>
      <p>
        {{ site }} helps people choose a MacBook. This page explains, in plain language, what information the site handles and why.
        We do not have user accounts, we do not ask for your name or email, and we do not sell personal information.
      </p>

      <h2>What we collect</h2>
      <h3>Your questionnaire answers</h3>
      <p>
        While you fill in the questionnaire, your answers are kept in your browser's session storage so you can go back and forth. They stay on
        your device and disappear when you close the tab. When you choose “See my recommendations”, the answers (use cases, selected
        applications, workload level, future needs, budget and preferences) are sent to our server to calculate your results and are stored
        under a random reference ID so you can reopen your results. They are not linked to your name, email address or any account.
      </p>
      <h3>Clicks on purchase links</h3>
      <p>
        When you click a “Buy” link we record which offer, configuration and merchant it was, which part of the site you clicked from, the time, your
        browser's user-agent text, and a one-way, salted hash of your IP address. We do not store the IP address itself in these records. We use them
        to count clicks, ignore accidental double clicks and automated traffic, and understand which pages are useful.
      </p>
      <h3>Server logs</h3>
      <p>
        Like most websites, our servers and hosting providers may keep technical logs (such as IP address, time, requested page and browser type) to run
        the service, keep it secure and investigate abuse. How long these are kept depends on the hosting provider's settings.
      </p>
      <h3>Your comparison list</h3>
      <p>The MacBooks you add to the comparison list are kept in your browser's session storage and are not sent to us until you open the comparison page.</p>
      <h3>Your country and store</h3>
      <p>
        To show prices and stores for your country, our servers read the country your hosting or network provider attaches to your request (or, if there is none,
        the region of your browser's language setting). We use it only to choose which prices to show, and we do not store it. If you pick a country in the menu, that
        choice is kept in your browser's local storage so we can remember it. It is not sent to us, and you can clear it in your browser settings.
      </p>
      <h3>What we do not do</h3>
      <ul>
        <li>We do not set advertising or tracking cookies, and we do not currently use third-party analytics or advertising trackers.</li>
        <li>We do not ask for or store payment details. Purchases happen on the merchant's own website.</li>
      </ul>
      <p>If we add analytics or any other tracking in the future, we will update this page before we do.</p>

      <h2>How we use information</h2>
      <ul>
        <li>To calculate and display your recommendations and let you reopen them.</li>
        <li>To measure, in aggregate, which use cases, applications and configurations are popular, and to improve our scoring.</li>
        <li>To secure and operate the site, including limiting excessive requests.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Merchants.</strong> If you click through to a merchant, that merchant (and the affiliate network we use, if any) receives standard browser information and tracking details in the link, and handles your data under its own privacy policy.</li>
        <li><strong>Service providers.</strong> Companies that host our website and database process data on our behalf.</li>
        <li><strong>Legal reasons.</strong> We may disclose information if required by law or to protect rights and safety.</li>
      </ul>
      <p>We do not sell personal information, and we do not share it for cross-context behavioral advertising.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep recommendation and click records for as long as they are useful for running and improving the service, and we may delete or aggregate them
        at any time. Because we do not know who you are, we can only find a recommendation if you give us its link (its reference ID).
      </p>

      <h2>Your choices</h2>
      <p>
        You can use the site without providing any personal details, clear your browser's session storage at any time, and block or limit
        the cookies that merchants set once you leave our site. If you live in a place with privacy rights (for example, some US states), you may
        ask what information we hold about you or request its deletion. To help us find any record, include the recommendation link you received.
        @if (email) { Contact us at <a [href]="'mailto:' + email">{{ email }}</a>. }
      </p>

      <h2>Children</h2>
      <p>The site is not directed to children under 13 and we do not knowingly collect personal information from them.</p>

      <h2>Security</h2>
      <p>We use HTTPS, store IP addresses only as salted hashes in click records, limit access to administration tools, and rate-limit requests. No online service can promise perfect security.</p>

      <h2>Changes</h2>
      <p>We will post changes on this page and update the date above.</p>
      <p>See also our <a routerLink="/terms">terms of use</a> and <a routerLink="/affiliate-disclosure">affiliate disclosure</a>.</p>
    </article>
  `,
})
export class Privacy {
  protected readonly site = environment.siteName;
  protected readonly email = environment.contactEmail;
  protected readonly updated = prettyDate(CONTENT_DATES.privacy);

  constructor() {
    inject(Seo).set({
      title: 'Privacy policy',
      description: 'What MacRequire collects, why, who it is shared with and your choices. No accounts, no advertising trackers, and IP addresses are stored only as salted hashes.',
      path: '/privacy',
      jsonLd: [inject(Seo).breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Privacy policy', path: '/privacy' }])],
    });
  }
}
