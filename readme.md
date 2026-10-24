SaaSScout AI™
Match the business. Introduce the solution.

SaaSScout AI™ is a B2B prospecting and outreach workflow prototype by NOFA AI Factory™, a NOFA Business Consulting initiative. It demonstrates how a business prospect can be matched to a relevant NOFA product and receive a personalized introduction email draft.

The entire application runs from one index.html file with embedded HTML, CSS, and JavaScript. No backend, package installation, build process, or API key is required.
Prototype only: All prospect companies, signals, and fit scores are fictional examples. Discovery filters a built-in dataset; product matching uses fixed industry rules; emails are generated from templates. No live AI inference, prospect search, contact enrichment, Gmail connection, or automatic email sending is included.

Features
- Prospect discovery: Explore 14 fictional B2B businesses across hospitality, software, and government contracting.
- Filters: Narrow results by industry, US region, signal type, and company size.
- Search and sorting: Search company names, locations, or signal text; sort by illustrative fit score or company name.
- Signal context: Distinguish explicit requests, inferred needs, and company-fit-only examples.
- Suggested NOFA products: View a product recommendation and an explanation of its relevance.
- Introduction emails: Generate editable subject lines and email bodies introducing NOFA AI Factory and the matched product.
- Copy and download: Copy the complete email or download it as a text file. If clipboard access is unavailable, copy manually or use download.
- Pipeline: Save prospects, add notes, and move leads through Saved, Contacted, Demo booked, and Won stages.
- CSV exports: Export filtered prospects or saved pipeline records, including product matches and notes. Records are labeled as fictional demo data.
- Local persistence: Save product settings, pipeline stages, and notes in browser local storage when available.
- Responsive interface: Layout adapts to desktop and smaller screens.
Product matching
The prototype uses this fixed catalog:
Business industry	Suggested product	Potential relevance
Hospitality	JudyHotel™	Answer recurring guest questions and route service requests
Software	CommandDesk AI™	Classify support emails and route inquiries
Government contracting	JudyBid™	Discover and evaluate relevant contracting opportunities


Recommendations are illustrative and determined by industry, not by a live AI model. Product descriptions are not synchronized with the live showroom. All showroom links point to https://nofaaifactory.com; the prototype does not invent individual product-page URLs.

The editable product profile sets discovery context. It does not override the fixed NOFA product matches or Farhad’s signature in introduction emails.
Run locally
1. Download or clone the repository.
2. Open index.html in a modern browser.
3. Select filters and click Discover demo prospects.
4. Click Generate introduction email on a prospect card.
5. Review the product recommendation, edit the subject and body, then copy or download the email.
No terminal command or dependency installation is needed.

Browser-local storage behavior can vary when opening a file:// page. Static hosting provides a more consistent origin for persistence. If storage is unavailable, changes remain available only for the current session.
Deploy to Vercel
1. Place index.html at the repository root.
2. Push the repository to GitHub.
3. Import the repository into Vercel.
4. Select Other as the framework preset if needed.
5. Leave the build command unset and serve the repository root as the static output.
6. Deploy.
There are no environment variables or API credentials to configure. Other static hosting services can also serve the file.
Repository structure
index.html   Complete application: markup, styling, demo data, and behavior
README.md    Project overview and usage instructions
Email behavior
Generated drafts introduce NOFA Business Consulting and NOFA AI Factory™, feature the industry-matched product, explain its potential relevance, and link to the showroom. The signature uses:

Farhad Nasserghodsi
NOFA Business Consulting | NOFA AI Factory™
nofabusinessconsulting@gmail.com
https://nofaaifactory.com

The email address is signature text only. The application is not authenticated to that Gmail account and cannot send messages. Drafts avoid presenting fictional prospect signals as verified facts. Verify the business, contact, product capabilities, and relevance before using any draft for real outreach.
Local data and privacy
- Pipeline records, notes, and product settings use the local-storage key saasscout-v1.
- Data is not synchronized across devices, browser profiles, or hosting domains.
- Clearing browser storage removes locally saved information.
- Data connections → Reset this demo workspace clears the application’s saved state after confirmation.
- The application makes no background API requests and contains no analytics scripts or external UI dependencies.
- External provider and showroom links open only when clicked.
- Do not store API secrets in the HTML file or browser local storage.
- A private source repository does not automatically make a deployed website private; configure hosting access separately if required.
Production roadmap
The following are planned capabilities, not implemented features:
- Live company and evidence discovery through a provider such as Exa.
- Business-contact enrichment through a provider such as Hunter.
- A maintained showroom catalog with verified product descriptions and links.
- AI-assisted matching grounded in real evidence, with source URLs and dates.
- Secure backend handling of provider credentials and Google OAuth tokens.
- Gmail connection, review/approval queues, and controlled sending schedules.
- Reply and opt-out handling, duplicate prevention, and delivery-status tracking.
- Authentication, durable account storage, and multi-user workspaces.
Live integration requires confirming provider access, permitted usage, costs, and data availability. The prototype does not promise qualified buyers, verified contacts, email delivery, or sales outcomes.
Validation
The prototype was checked for JavaScript syntax and reviewed in a browser. Core checks covered filtering, saving leads, changing pipeline stages, persistence after reload, notes, and introduction-email generation. This is prototype validation, not a comprehensive production test suite.
Ownership
SaaSScout AI™ is a NOFA AI Factory™ concept by NOFA Business Consulting, LLC. No open-source license is granted by this README.

Explore the showroom: https://nofaaifactory.com
