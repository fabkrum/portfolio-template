# Modern Web Guidance: index

162 guides from modern-web-guidance 0.0.191, grouped by topic. Each line names the file to open and what the guide covers.

## accessibility

- `guides/accessibility/accessibility.md`: Actionable coding guidelines for building accessible web applications, covering semantic HTML, focus management, forms, media, and testing. Use this skill when auditing or implementing accessibility features, keyboard navigation, or ARIA.
- `guides/accessibility/accessible-error-announcement.md`: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience. Uses: :user-valid and :user-invalid.

## built-in-ai

- `guides/built-in-ai/language-detection.md`: Detect the language of user-generated content or already present site content. Uses: Language detector.
- `guides/built-in-ai/language-model.md`: Run on-device natural language inference in the browser using the Prompt API, with streaming output, structured JSON responses, and multi-turn session management. Uses: LanguageModel.
- `guides/built-in-ai/prompt-api.md`: Language Model.
- `guides/built-in-ai/summarizer.md`: Summarize text content using the on-device Summarizer API. Uses: Summarizer.
- `guides/built-in-ai/translator.md`: Translate text between languages using the on-device Translator API. Uses: Translator.

## css

- `guides/css/animate-to-intrinsic-sizes.md`: Smoothly animate interactive components (like accordions, menus, and expanding cards) to and from their natural dimensions. Uses: calc-size(), interpolate-size.
- `guides/css/calculate-with-intrinsic-sizes.md`: Calculate the size of an element based on its intrinsic size, while ensuring it fits within given design constraints. Uses: calc-size(), interpolate-size.
- `guides/css/child-state-based-styling.md`: Build a component that changes its styling based on the state of one of its child elements. For example, a component that renders in light or dark mode based on whether a theme toggle is checked (or not). Uses: :has(), :not().
- `guides/css/content-based-styling.md`: Build a component that changes its layout based on whether it contains specific child elements (or not). For example, if the component contains an image, use a multi-column layout, otherwise default to a single-column layout. Uses: :has(), :not().
- `guides/css/css.md`: Action-oriented guidelines for modern CSS architecture, layouts, and performance. Use this guide when authoring styles, managing design systems, or optimizing web rendering.
- `guides/css/css-layout.md`: Modern CSS layouts such as flexbox, grid, subgrid, container queries, anchor positioning, and intrinsic sizing. Use this skill when architecting responsive UI components or page layouts.
- `guides/css/design-token-reactivity.md`: Define higher-order design tokens, like density modes (compact, comfortable, spacious) or themes and have descendant components react to changes directly and in component-appropriate ways. Uses: Container style queries.
- `guides/css/dynamic-sibling-styling.md`: Create dynamic visual spectrums or layout arrangements that automatically adapt to the number of elements in a group. Uses: sibling-count() and sibling-index(), Trigonometric functions (CSS).
- `guides/css/fluid-scaling.md`: Scale items like font size, spacing, and media sizes smoothly based on the parent container's size rather than using fixed breakpoints Uses: Container queries.
- `guides/css/individual-transform-properties.md`: Animate or override individual CSS transform properties (e.g. translate, rotate, scale) independently of other transform properties on a single element. Uses: Individual transform properties.
- `guides/css/overflow-clipping-control.md`: Adjust the visible clipping boundary of an element to align with the content edge, padding edge, or border edge—or a specified offset from any of these—offering finer-grained control over how content is clipped. Uses: overflow: clip, overflow-clip-margin.
- `guides/css/reduce-style-repetition.md`: Reduce excessive style repetition by encapsulating complex or dynamic styling logic into reusable functions (such as a function that computes a gradient based on a set of input parameters). Uses: @function.
- `guides/css/size-aware-styling.md`: Build a component whose styles can be conditionally dependent on its own width or height, rather than the width or height of the viewport. For example a card component that can change its layouts depending on how large it is, or a call-to-action button that can conditionally display helper text based on its width. Uses: Container queries.
- `guides/css/style-parent-with-has.md`: Style parent elements of a form field (e.g. labels or fieldsets) when the field is invalid. Uses: :user-valid and :user-invalid.
- `guides/css/usage-aware-component-variations.md`: Build components that adapt visual logic based on semantic context using CSS container style queries. Uses: Container style queries.

## forms

- `guides/forms/animated-select-picker.md`: Create a custom select component whose dropdown is animated. For example, the menu fades or slides into view, or the options animate upon selection. Uses: Customizable <select>.
- `guides/forms/autofill-address-form.md`: Build an address form with correct autocomplete attributes and autofill support. Uses: :autofill.
- `guides/forms/autofill-highlight-inputs.md`: Use CSS to highlight form fields that have been autofilled by the browser and not edited by the user. Uses: :autofill.
- `guides/forms/autofill-payment-form.md`: Build a payment form that collects card details with correct autocomplete values and autofill support. Uses: enterkeyhint, Email, telephone, and URL <input> types, inputmode.
- `guides/forms/autofill-sign-in-form.md`: Build a sign-in form with correct autocomplete values and autofill support. Uses: Email, telephone, and URL <input> types, inputmode.
- `guides/forms/autofill-sign-up-form.md`: Build a sign-up form with correct autocomplete values and autofill support. Uses: Email, telephone, and URL <input> types, inputmode.
- `guides/forms/brand-consistent-forms.md`: Match checkboxes, radio buttons, range sliders, and progress bars to your site's color palette without replacing them with custom components. Uses: accent-color.
- `guides/forms/branded-select-styling.md`: Create custom select elements whose button, picker, arrow icon, and checkmark all seamlessly match your brand or design system's typography, colors, spacing, and border treatments. Uses: Customizable <select>.
- `guides/forms/custom-select-picker-layouts.md`: Create custom select pickers whose options are positioned in unique or interesting ways, rather than the traditional stacked list of options. Uses: Customizable <select>.
- `guides/forms/form-fields-automatically-fit-contents.md`: Allow form fields to grow and shrink to fit the user input, e.g. as the user types or selects a different option. Apply maximum and minimum size limits to create dynamic and responsive form fields that conform with the page design. Uses: field-sizing.
- `guides/forms/forms.md`: Best practices for building accessible, secure, and user-friendly web forms. Use this guide when creating or modifying forms, inputs, and submission flows.
- `guides/forms/ime-safe-enter-submit.md`: Implement keyboard text submission (like enter-to-submit in chat/textareas) safely for IME (Input Method Editor) users to prevent premature submission of incomplete text. Uses: Keyboard events.
- `guides/forms/required-field-feedback.md`: Provide error message for required form fields that were skipped or left empty *only* after user interaction, to avoid preemptive errors and ensure feedback is timely and contextually relevant to the user's flow. Uses: :user-valid and :user-invalid.
- `guides/forms/rich-media-picker.md`: Create a custom select component whose options can contain complex HTML formatting (e.g. images, icons, and other rich formatting) rather than just plain text. Uses: Customizable <select>.
- `guides/forms/select-menu-interaction.md`: Validate that a non-default option has been chosen in a select menu only after the user has interacted with the control. Uses: :user-valid and :user-invalid.
- `guides/forms/validate-input-after-interaction.md`: Show form field validation feedback (e.g. password complexity or email format requirements) only after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. Uses: :user-valid and :user-invalid.

## html

- `guides/html/accessible-web-components.md`: Make custom elements accessible by default, setting roles and ARIA state via the ElementInternals ARIA mixin, managing focus with delegatesFocus, and keeping ARIA relationships within a single shadow root. Uses: ARIA attribute reflection, Shadow DOM.
- `guides/html/custom-elements.md`: Define, register, and manage the lifecycle of autonomous custom elements, covering constructor rules, lifecycle callbacks, upgrade timing, attribute/property reflection, and naming conventions. Uses: Autonomous custom elements.
- `guides/html/form-associated-custom-elements.md`: Make a custom control participate natively in forms with formAssociated and ElementInternals, submitting its own value, integrating with constraint validation, and reacting to reset, disable, and state-restore. Uses: Form-associated custom elements.
- `guides/html/html.md`: Action-oriented guidelines for modern HTML architecture, semantics, native interactive APIs (Dialog, Popover, Details), focus management, and resource prioritization. Use this guide when structuring web documents, implementing native overlays, or optimizing resource loading order.
- `guides/html/prerendering-custom-elements.md`: Server-render a custom element, then hydrate it in place without re-rendering or a flash of unstyled content. Uses: Declarative shadow DOM.
- `guides/html/shadow-dom.md`: Encapsulate a component's DOM and styles with Shadow DOM, construct the tree efficiently with HTML templates, and project consumer content with slots. Uses: Shadow DOM, <slot>.
- `guides/html/styling-web-components.md`: Style across the shadow boundary with :host selectors, inherited and custom properties for theming, ::slotted and ::part, and cascade layers and container queries inside components. Uses: Shadow parts, :host-context(), Cascade layers, Container queries.
- `guides/html/web-components.md`: Orientation and cross-cutting principles for authoring and using Web Components, covering Custom Elements, Shadow DOM, templates and slots, Declarative Shadow DOM, styling across the shadow boundary, Form-Associated Custom Elements, and accessibility requirements. Use this guide when building reusable UI components, design systems, or server-rendered custom elements. Uses: Autonomous custom elements, Shadow DOM, Declarative shadow DOM.

## js

- `guides/js/calculate-event-differentials.md`: Calculate the duration and time remaining between dates and times. Uses: Temporal.
- `guides/js/capture-location-agnostic-data.md`: Record chronological data that should not change based on a user's location, such as birthdates, recurring alarms, or national holidays. Uses: Temporal.
- `guides/js/coordinate-global-events.md`: Schedule future meetings or events by explicitly binding them to a geographical IANA time zone so that event times remain accurate regardless of Daylight Saving Time (DST) transitions, "skipped" or "repeated" hours during clock changes. Uses: Temporal.
- `guides/js/format-human-readable-durations.md`: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context. Uses: Temporal, Intl.DurationFormat.
- `guides/js/manage-recurring-intervals.md`: Calculate recurring intervals for subscription billings or payroll cycles, automatically adjusting for edge cases such as month-end transitions (e.g., adding one month to January 31st) to ensure accurate period calculations. Uses: Temporal.
- `guides/js/model-partial-time-concepts.md`: Model date and time concepts that inherently lack a standard component (such as a specific year, day, or date) without using arbitrary placeholder values that introduce calculation errors. Uses: Temporal.
- `guides/js/stabilize-reactive-state.md`: Manage task deadlines or schedules in data-driven views without unexpected side effects from shared mutable state. Uses: Temporal.
- `guides/js/support-global-calendar-systems.md`: Display and calculate dates in non-Gregorian calendar systems (e.g., Islamic, Hebrew, or Chinese) accurately for international users. Uses: Temporal.

## performance

- `guides/performance/avoid-redundant-large-asset-downloads.md`: Avoid re-downloading and re-storing large shared assets, such as AI models, Wasm modules, or fully-bundled JavaScript libraries, that a visitor's browser may already hold from an unrelated site. Uses: cross-origin-storage, Fetch, Web Cryptography, Permissions policy.
- `guides/performance/batch-analytics-events.md`: Debounce and batch multiple analytics events together in a single beacon to minimize network contention and reduce server load, while still delivering real-time updates. Uses: fetchLater, AbortController and AbortSignal.
- `guides/performance/break-up-long-tasks.md`: Break up heavy synchronous processing (complex computations and/or long loops) or DOM updates, to let the browser handle user input and repaint the screen. Uses: Scheduler API.
- `guides/performance/calculate-total-foreground-time.md`: Calculate the total time a user actually spent viewing a page, excluding periods when the tab was in the background. Uses: Page visibility state performance entries.
- `guides/performance/conditional-async-dependencies.md`: Conditionally load or initialize async dependencies (such as importing polyfills for missing web features) without requiring complex orchestration across all of a page's script dependencies. Uses: Top-level await.
- `guides/performance/defer-rendering-heavy-content.md`: Reduce rendering times in content-heavy web pages (e.g. pages with long feeds, lots of articles, or complex dashboards), by deferring rendering for any content that is not immediately visible to the user. Uses: content-visibility.
- `guides/performance/defer-work-until-scroll-ends.md`: Defer expensive operations like DOM updates, data fetching, analytics tracking, or layout recalculation until after scrolling completes to maintain smooth scroll performance. Uses: scrollend.
- `guides/performance/deliver-optimized-decorative-images.md`: Deliver optimized decorative images (such as backgrounds, UI icons, or complex masks) by simultaneously providing next-generation image formats (like AVIF or WebP) alongside multiple pixel densities (like 1x and 2x) so the browser can dynamically negotiate the best combination of file size and visual quality for the user's device capabilities. Uses: image-set().
- `guides/performance/deprioritize-background-fetches.md`: Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests. Uses: Fetch priority, Fetch.
- `guides/performance/detect-initial-visibility-state.md`: Reliably determine whether a page was initially loaded in the background, even in cases where the script is loaded asynchronously after the user foregrounded the page. Uses: Page visibility state performance entries, Page visibility.
- `guides/performance/efficient-background-processing.md`: Conserve system resources and battery life by pausing background JavaScript execution (such as `<canvas>` animations, WebGL rendering, or high-frequency WebSocket data polling) when the component is off-screen and then resume them just-in-time when they scroll back into view. Uses: content-visibility.
- `guides/performance/faster-spa-view-transitions.md`: Enable faster transitions back to previously visited views in a Single-Page Application (SPA) by preserving their structural DOM state instead of destroying and rebuilding them on every navigation. Uses: content-visibility.
- `guides/performance/flicker-free-client-side-ab-testing.md`: Deliver and render A/B tests, multi-variate tests, or other experiments using client-side JavaScript to alter or inject HTML, CSS, and JavaScript without the original content showing first before flickering or flashing to show the experiment content. Uses: blocking="render".
- `guides/performance/full-session-analytics.md`: Reliably track analytics, errors, and telemetry data across the user's entire page visit, and defer sending of the data until the user leaves the page. Uses: fetchLater, AbortController and AbortSignal.
- `guides/performance/identify-heavy-scripts.md`: Identify the scripts most responsible for long animation frames Uses: Long animation frames performance entries.
- `guides/performance/identify-inp-causes.md`: Identify slow running JavaScript that is impacting INP metric Uses: Long animation frames performance entries, Event timing performance entries.
- `guides/performance/improve-next-page-load-performance.md`: Improve page load performance by prefetching or prerendering pages that the user is likely to visit next. Uses: Speculation rules.
- `guides/performance/interactions-in-complex-layouts.md`: Make interactions snappier and more responsive (reducing Interaction to Next Paint (INP) scores) by avoiding layout re-calculations in complex layouts, such as data-heavy dashboards or spreadsheet-style grids. Uses: content-visibility.
- `guides/performance/load-shared-resources-declaratively.md`: Serve popular, unmodified scripts, stylesheets, and JavaScript modules from a shared cross-origin cache using markup or import syntax alone, without writing custom caching logic. Uses: cross-origin-storage, Subresource integrity.
- `guides/performance/optimize-image-priority.md`: Optimize the loading priority of Largest Contentful Paint (LCP) candidate images and deprioritize non-critical images to reduce critical resource load delays. Uses: Fetch priority, Lazy-loading images and iframes.
- `guides/performance/optimize-preload-priority.md`: Optimize the relative priority of preloaded content to reduce critical resource load delays. Uses: Fetch priority, <link rel="preload">.
- `guides/performance/optimize-script-priority.md`: Optimize the loading priority of scripts by boosting critical asynchronous scripts and deprioritizing non-essential or late-body scripts to improve sequencing and reduce delays. Uses: Fetch priority.
- `guides/performance/out-of-order-html-streaming.md`: Declaratively update a page with content streamed later into the same HTML document or via imperative JavaScript APIs. Uses: <template for>, HTML setter methods, HTML streaming setters, HTML processing instructions.
- `guides/performance/performance.md`: Actionable guidelines for optimizing modern web applications. Use this guide when auditing performance, optimizing loading metrics, fixing slow interactions and optimizing Core Web Vitals (LCP, INP, CLS)
- `guides/performance/resolution-optimized-pseudo-elements.md`: Use resolution-optimized images in CSS pseudo-elements (such as `::before` and `::after`) to reduce the number of DOM nodes. Uses: image-set().
- `guides/performance/schedule-tasks-by-priority.md`: Schedule tasks with different priorities to ensure critical work runs first while background work is deferred. Uses: Scheduler API.
- `guides/performance/sequence-distributed-events.md`: Log and sequence operations in distributed microservices or high-throughput tracing environments by recording timestamps with nanosecond resolution. Uses: Temporal.
- `guides/performance/share-web-fonts-across-origins.md`: Serve large, popular web fonts from a shared cross-origin cache instead of re-downloading them from a font CDN on every site that references them. Uses: cross-origin-storage, Subresource integrity.

## privacy

- `guides/privacy/privacy.md`: Action-oriented guidelines for web developers to implement privacy by design, data minimization, third-party audits, and secure data handling. Use this skill when designing applications, integrating third-party services, handling user data, or configuring security headers. Uses: Permissions policy, Partitioned cookies, Federated credential management, User agent client hints.

## pwa

- `guides/pwa/migrate-web-app-origin.md`: Transfer an installed web app to a new origin while preserving user configuration and OS-level shortcuts. Uses: Web app origin migration.

## security

- `guides/security/local-network-access.md`: Access resources on a user's local network or loopback interface from a public web application. Uses: Local network access.
- `guides/security/passkey-authentication.md`: Authenticate a returning user with a passkey for primary sign-in. Uses: Web authentication, Web authentication signal methods.
- `guides/security/passkey-conditional-create.md`: Silently register a passkey for an existing user after a successful password login. Uses: Web authentication, Web authentication signal methods.
- `guides/security/passkey-management.md`: Let users view and manage the passkeys registered to their account. Uses: Web authentication, Web authentication signal methods.
- `guides/security/passkey-reauthentication.md`: Verify a signed-in user's identity using their existing passkeys before a sensitive action. Uses: Web authentication.
- `guides/security/passkey-registration.md`: Register a passkey for an existing user account. Uses: Web authentication, Web authentication signal methods.
- `guides/security/passkeys.md`: Comprehensive orientation and cross-cutting principles for implementing WebAuthn and Passkeys in web applications. Use this guide when handling passkey registration, authentication, management, or reauthentication. Uses: Web authentication.
- `guides/security/sanitize-untrusted-html.md`: Safely parse and display untrusted HTML content from user input by removing unsafe elements and attributes. Uses: Sanitizer API.
- `guides/security/security.md`: Preventative security guidelines for web developers (XSS, CSP, Cookies, Cross-Origin Isolation). Use this skill to guide the process of auditing, testing, and deploying security policies safely.
- `guides/security/trusted-types.md`: Help prevent DOM-based XSS attacks by ensuring all untrusted content is sanitized before being inserted into the page. Uses: Trusted types.

## ui-atoms

- `guides/ui-atoms/carousel-slide-effects.md`: Create a carousel of slides with images or other visual elements, where each slide animates as they enter/center/exit their scroller. For example, the slides may fade-in/fade-out, rotate, get bigger or smaller, etc. Uses: Scroll-driven animations, Scroll snap.
- `guides/ui-atoms/component-specific-light-dark-theme.md`: Force certain elements to be in light mode or dark mode (e.g. code blocks, media players, etc) independently of the page's color-scheme. Uses: color-scheme, light-dark().
- `guides/ui-atoms/position-aware-tooltips.md`: Build tooltips and popovers with directional arrows (or other visual styling) that automatically point the correct way when the element flips to a fallback position. Uses: Anchor position container queries, Popover.
- `guides/ui-atoms/pull-to-reveal.md`: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar. Uses: scroll-initial-target, Scroll snap.
- `guides/ui-atoms/resilient-context-menus-and-nested-dropdowns.md`: Build accessible, responsive menus, tooltips, dropdowns, or contextual overlays that must be tethered to specific UI elements, guaranteeing that the overlay automatically repositions itself (e.g., flipping axes) when it encounters viewport edges, ensuring it never gets cut off. Uses: Anchor positioning, Popover.
- `guides/ui-atoms/responsive-table.md`: Build a data table that presents tabular data with proper header semantics, and remains readable and navigable on small screens and with assistive technologies. Uses: Sticky positioning, Container queries.
- `guides/ui-atoms/scroll-position-aware-elements.md`: Build floating buttons or widgets (back-to-top, scroll-to-bottom, chat launchers, etc.) that appear and disappear based on whether the user has scrolled at all. Uses: Container scroll-state queries.
- `guides/ui-atoms/scroll-progress-indicator.md`: Create a scroll progress bar, stepped progress tracker, or any visual affordance that communicates how far through a page or section the user has scrolled. Uses: Scroll-driven animations.
- `guides/ui-atoms/scrollability-affordance-hints.md`: Build scroll-shadow overlays, gradient fades, or directional arrow indicators that appear only when there's actually more content to scroll to in that direction. Uses: Container scroll-state queries.
- `guides/ui-atoms/shrinking-header-on-scroll.md`: Smoothly animate a fixed header or full-page cover on scroll to dynamically shrink, gain shadows, and transform its layout over a predefined scroll distance. Uses: Scroll-driven animations.
- `guides/ui-atoms/state-aware-sticky-headers.md`: Build sticky section headers or navbars that visually transform when they're actually "stuck" at the top, changing their color scheme or gaining a shadow. Uses: Container scroll-state queries.

## ui-behaviors

- `guides/ui-behaviors/anchor-positioning-tab-underline.md`: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab. Uses: Anchor positioning, prefers-reduced-motion media query.
- `guides/ui-behaviors/animate-element-entry-exit.md`: Smoothly hide/show elements as they are added/removed from the DOM or as their display values are toggled. Uses: @starting-style, transition-behavior.
- `guides/ui-behaviors/animate-to-from-top-layer.md`: Animate elements such as dialogs, popovers, and tooltips as they're entering/exiting the top layer. Uses: ::backdrop, <dialog>, overlay, Popover, @starting-style, transition-behavior.
- `guides/ui-behaviors/carousel-snap-highlights.md`: Visually highlight the currently snapped non-interactive item in scroll-snapping carousels, galleries, or full-page swipe experiences. For example, expanding a card when snapped, or revealing hidden content. Uses: Container scroll-state queries.
- `guides/ui-behaviors/consistent-cross-document-transitions.md`: Ensure critical page state is loaded and stable before initiating a cross-document view transition. This means critical CSS styles are loaded and applied, critical JavaScript is loaded and run, and the HTML visible for the user's initial view of the page has been parsed before the transition runs. Uses: blocking="render", <link rel="expect">, Cross-document view transitions.
- `guides/ui-behaviors/cross-document-transitions.md`: Create smooth, seamless transitions between full page navigations, such as cross-fades, custom reveal effects, or morphing of content from one page to the next. Uses: View transitions, Cross-document view transitions, Navigation API.
- `guides/ui-behaviors/custom-button-actions.md`: Declaratively connect a button to any element to trigger custom, application-specific actions using declarative button commands, invoker commands, button commands, custom commands, or declarative toggle actions. Uses: Invoker commands.
- `guides/ui-behaviors/declarative-dialog-popover-control.md`: Toggle the visibility of a dialog or popover from a button without writing JavaScript. Uses: Invoker commands, Popover, <dialog>.
- `guides/ui-behaviors/directional-navigation-transitions.md`: Animate visual state changes to reflect the direction of a user's navigational flow, such as sliding new content in from the right when advancing forward or from the left when returning to a previous screen. Uses: View transitions, Active view transition.
- `guides/ui-behaviors/dynamic-sibling-animations.md`: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list. Uses: sibling-count() and sibling-index().
- `guides/ui-behaviors/group-element-transitions.md`: Transition a group of similar elements simultaneously using the same transition logic, such as removing a product from a shopping cart and having all the other products animate into their new positions. Uses: View transitions, view-transition-class.
- `guides/ui-behaviors/highlight-text-ranges.md`: Highlight arbitrary text ranges on a page such as search results, spelling errors, or collaborative editing cursors. Uses: Custom highlights.
- `guides/ui-behaviors/interactive-content-reveal.md`: Create interactive reveal effects, such as a spotlight that follows the user's pointer to uncover details within an image or UI section. Uses: Masks, Registered custom properties.
- `guides/ui-behaviors/interest-triggered-action-previews.md`: Show a live preview of a button's effect when a user signals interest (e.g. hovering, focusing, or long-pressing) but before they commit to clicking. Uses: Interest invokers.
- `guides/ui-behaviors/interest-triggered-tooltips.md`: Show a tooltip or supplemental information when a user hovers over, focuses on, or long-presses an interactive element, without requiring a click. Uses: Interest invokers, Popover, popover="hint", Anchor positioning.
- `guides/ui-behaviors/light-dismiss-a-dialog.md`: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog) Uses: <dialog closedby>.
- `guides/ui-behaviors/move-dom-element-without-losing-state.md`: Move or reparent a DOM element without losing important element state, such as interactivity states (:focus/:active), `<iframe>` loading state, animation/transition state, etc Uses: moveBefore().
- `guides/ui-behaviors/parallax-scroll-effects.md`: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls. Uses: Scroll-driven animations.
- `guides/ui-behaviors/persistent-top-layer-ui.md`: Keep a modal dialog, fullscreen element, or native popover visibly open and functionally active when its underlying DOM node is moved or reparented in the DOM. Uses: moveBefore().
- `guides/ui-behaviors/physics-based-easing.md`: Create custom, physics-based animation and transition effects, like bounce and spring, that feel more natural and engaging than traditional easing curves. Uses: linear() easing.
- `guides/ui-behaviors/platform-controls-dismiss-dialog.md`: Create a modal dialog that can be closed via standard platform-specific user actions, such as pressing the `Esc` key on desktop platforms, or a "back" or "dismiss" gesture on mobile platforms Uses: <dialog closedby>.
- `guides/ui-behaviors/same-document-transitions.md`: Visually connect persisting elements across different page states or navigations in a Single Page Application (SPA) (e.g. expanding a product thumbnail into a full-bleed hero image) by smoothly morphing their size, position, or other styling properties. Uses: View transitions.
- `guides/ui-behaviors/scroll-entry-exit-effects.md`: Create fade-in, scale-up, or other complex reveal-type effects on elements as they enter and exit the scrollport (or viewport) while the user is scrolling. Uses: Scroll-driven animations.
- `guides/ui-behaviors/scroll-snap-realtime-feedback.md`: Provide real-time visual feedback in linked UI elements while a user scrolls through snap-aligned content, before the scroll gesture completes. Uses: Scroll snap events, Scroll snap.
- `guides/ui-behaviors/scroll-snap-state-sync.md`: Synchronize navigation indicators, linked content panels, and analytics tracking with the actively snapped item in a scrollable container. Uses: Scroll snap events, Scroll snap.
- `guides/ui-behaviors/scroll-target-on-load.md`: Build a scrollable list of elements (e.g. a carousel of images or a chat conversation thread) that can be displayed with a particular element scrolled into view on the initial render. Uses: scroll-initial-target, scrollIntoView().
- `guides/ui-behaviors/scrollytelling.md`: Animate visual properties on a target element — such as fading a backdrop, shifting a background color, or to create scrollytelling experiences — driven entirely by the scrollport position of a completely different element. Uses: Scroll-driven animations.
- `guides/ui-behaviors/search-hidden-content.md`: Hide content from view using patterns such as accordions, tabs, and "Read more" sections, while ensuring the hidden text reveals itself during native "Find in page" searches, allows search engine indexing, supports URL fragment deep links, and maintains ARIA accessibility. Uses: <details>, Mutually exclusive <details> elements, hidden="until-found".
- `guides/ui-behaviors/spatial-navigation.md`: Implement accessible spatial navigation using arrow keys that works correctly in different layout modes (grid etc) Uses: scrollIntoView().
- `guides/ui-behaviors/swipe-to-remove.md`: Let users act on items in a list (remove, archive, mark as read, etc.) with a horizontal swipe gesture, so they can process entries quickly without tapping a separate control. Uses: Scroll snap, scroll-initial-target, overscroll-behavior, scrollbar-width, Intersection observer, MutationObserver, Resize observer, Web animations.

## ui-components

- `guides/ui-components/navigation-drawer.md`: Create a navigation drawer component that, when triggered from a menu button, slides in from the side overlayed on top of existing page content, and slides out when dismissed (by swiping away, tapping outside, or pressing escape). Uses: inert, Intersection observer, Popover, Registered custom properties, Scroll-driven animations, scroll-initial-target, Scroll snap.
- `guides/ui-components/persistent-app-tours.md`: Create persistent onboarding walkthroughs using tethered native overlays that stay open during user interaction. Uses: Popover, Anchor positioning.
- `guides/ui-components/persistent-toast-notifications.md`: Create non-intrusive toast and overlay notifications for persistent, stackable messaging and state communication. Uses: Popover, Anchor positioning, sibling-count() and sibling-index(), transition-behavior.
- `guides/ui-components/progress-ring.md`: Build a progress ring component that visually represents the completion status of a task or process, with support for content in the center and brand-consistent styling. Uses: <progress>, Conic gradients, Masks, Registered custom properties.
- `guides/ui-components/scrollspy.md`: Highlight the currently visible section of a page in a navigation menu Uses: Scroll marker target pseudo-classes, scroll-target-group.
- `guides/ui-components/spinner.md`: Build a loading spinner that communicates busy state to all users, respects reduced-motion preferences, and animates efficiently. Uses: prefers-reduced-motion media query, Conic gradients, <progress>.
- `guides/ui-components/stack-drill-down.md`: Build full-screen hierarchical navigation that lets users drill down into nested views and swipe or navigate back to return, with browser history kept in sync. Uses: inert, Intersection observer, Scroll-driven animations, Scroll snap, Scroll snap events.

## visual-design

- `guides/visual-design/adapt-scrollbar-to-contrast-preferences.md`: Enhance scrollbar visibility for users who prefer high-contrast interfaces Uses: scrollbar-color, prefers-contrast media query.
- `guides/visual-design/apply-webgl-shaders.md`: Apply custom visual effects with WebGL shaders to HTML content. Uses: HTML in canvas.
- `guides/visual-design/complex-shapes.md`: Clip elements and their content to any free-form shape, like a symbol, brush stroke, or organic texture for more expressive designs. Uses: Masks, SVG.
- `guides/visual-design/contrast-color.md`: Select a readable text color with sufficient contrast on a dynamic background color. Uses: contrast-color().
- `guides/visual-design/customize-scrollbar-color-and-thickness.md`: Customize the color or thickness of a scrollbar Uses: scrollbar-color, scrollbar-width.
- `guides/visual-design/dark-mode.md`: Implement dark mode support in a way that respects the user's light/dark theme preference and adapts browser UI (e.g. scrollbars, form controls, etc) Uses: color-scheme, prefers-color-scheme media query, light-dark(), accent-color.
- `guides/visual-design/export-html-media-from-canvas.md`: Capture and export dynamic HTML content as images or video frames from within canvas. Uses: HTML in canvas.
- `guides/visual-design/expose-canvas-content-to-browser-features.md`: Expose content rendered in a canvas to browser features like assistive technologies, translation, or reading mode. Uses: HTML in canvas.
- `guides/visual-design/improve-text-layout-and-legibility.md`: Improve the layout and legibility of short standalone text content, such as headings no longer than a few lines, by enabling the browser to apply evenly balanced line breaks when wrapping text. Uses: text-wrap: balance, text-wrap: pretty.
- `guides/visual-design/interactive-content-in-3d-scenes.md`: Integrate interactive HTML elements into a 3D scene. Uses: HTML in canvas.
- `guides/visual-design/precise-text-alignment.md`: Achieve precise vertical alignment with text of any font. For example, exactly equal visual padding above and below text, or aligning text perfectly flush with adjacent icons or images. Uses: text-box.
- `guides/visual-design/shaped-cutouts.md`: Combine multiple shapes to create complex cutouts or 'knockout' effects in elements, such as adding a notch to an element. Uses: Masks.
- `guides/visual-design/soft-edge-content-fade.md`: Apply a transparency gradient to content edges to indicate further scrollable areas or to obscure payment-walled text. Uses: Masks.
- `guides/visual-design/visually-stable-font-fallbacks.md`: Define font styles such that text remains readable and visually consistent in the event that there's a swap between the perferred font and one of the fallbacks (or vise versa). Uses: font-size-adjust.
- `guides/visual-design/visually-stable-mixed-fonts.md`: Define font styles such that text remains readable and visually consistent in situations where multiple fonts are used to render a single block of text. Uses: font-size-adjust.
- `guides/visual-design/visually-texture-content.md`: Apply realistic weathering and texture patterns to elements to give them an organic, aged, or physical material appearance. Uses: Masks.

## wasm

- `guides/wasm/cpp-on-the-web.md`: Compile C/C++ to WebAssembly using Emscripten Uses: WebAssembly.

## webmcp

- `guides/webmcp/agentic-forms.md`: Expose client-side functionality as tools to AI agents by annotating standard HTML forms with WebMCP attributes. Uses: Form-associated WebMCP attributes.
- `guides/webmcp/agentic-javascript-tools.md`: Programmatically register client-side JavaScript functions as tools for AI agents using the WebMCP Imperative API. Uses: document.modelContext.
- `guides/webmcp/webmcp.md`: Use this guide to implement WebMCP (Web Model Context Protocol) in browser applications, exposing client-side functionality as tools to AI agents via declarative or imperative APIs.
