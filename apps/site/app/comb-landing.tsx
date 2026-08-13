"use client";

import { useEffect, useRef, useState } from "react";

const storySteps = [
  {
    number: "01 / JOIN",
    title: "Support happens locally.",
    body:
      "A supporter joins through Fellowship, Worm, Studious, or another creator-authorized product. That product owns the checkout, relationship, and durable Grant.",
    caption:
      "The payment stays between the supporter, creator, and their chosen payment rail.",
  },
  {
    number: "02 / ISSUE",
    title: "The Issuer signs the fact.",
    body:
      "The Issuer derives a short-lived, audience-bound claim from the active Grant. It reveals the Creator and Benefits needed for this Consumer—nothing more.",
    caption:
      "A boring RS256 JWT says one narrow thing: this supporter currently holds this Benefit.",
  },
  {
    number: "03 / VERIFY",
    title: "Another product verifies it.",
    body:
      "The Consumer checks the Issuer’s keys, exact audience, token lifetime, and the Creator’s delegation. Trust is explicit and scoped per Creator.",
    caption:
      "No shared database. No shared signing secret. No central Comb account.",
  },
  {
    number: "04 / UNLOCK",
    title: "The benefit travels.",
    body:
      "A shelf opens in Worm. A course unlocks in Studious. A door list, shop, or community can honor the same relationship without owning the payment.",
    caption:
      "Entitlements move across services. Money does not.",
  },
] as const;

const peers = [
  {
    kind: "Complete product",
    name: "Fellowship",
    role: "A self-hostable patronage platform—and one Comb participant among many.",
  },
  {
    kind: "Native implementation",
    name: "Worm+",
    role: "Own subscription state and product access, speaking Comb directly.",
  },
  {
    kind: "Native implementation",
    name: "Studious",
    role: "Own membership lifecycle and learning benefits, independently.",
  },
  {
    kind: "Open invitation",
    name: "Your thing",
    role: "Implement Issuer, Consumer, or both. Fellowship is optional.",
  },
] as const;

export function CombLanding() {
  const [activeStep, setActiveStep] = useState(0);
  const storyRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = storyRoot.current;
    if (!root) return;

    const steps = Array.from(
      root.querySelectorAll<HTMLElement>("[data-story-step]"),
    );
    let animationFrame: number | null = null;

    const updateActiveStep = () => {
      const triggerLine = window.innerHeight * 0.55;
      let nextStep = 0;

      steps.forEach((step, index) => {
        if (step.getBoundingClientRect().top <= triggerLine) {
          nextStep = index;
        }
      });

      setActiveStep((current) => (current === nextStep ? current : nextStep));
      animationFrame = null;
    };

    const queueUpdate = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(updateActiveStep);
      }
    };

    queueUpdate();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);
    return () => {
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="wordmark" href="#top" aria-label="Comb home">
          <span className="wordmark-mark" aria-hidden="true">
            C.
          </span>
          comb
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#protocol">Protocol</a>
          <a
            className="nav-pill"
            href="https://codeberg.org/Eclosion-Tech/Comb.is"
          >
            Codeberg ↗
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-comb" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="hero-inner">
          <p className="kicker">Open entitlement protocol · v0 laboratory</p>
          <h1>
            Support
            <span>should travel.</span>
          </h1>
          <div className="hero-lower">
            <div className="hero-proof" aria-label="Protocol properties">
              <span className="proof-chip">Open protocol</span>
              <span className="proof-chip">Creator-scoped trust</span>
              <span className="proof-chip">Payment-rail agnostic</span>
            </div>
            <div>
              <p className="hero-copy">
                Comb lets independent products verify that a supporter holds a
                creator-authorized benefit—without centralizing the money or
                requiring a Fellowship account.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#how-it-works">
                  See the signal move ↓
                </a>
                <a
                  className="button button-secondary"
                  href="https://codeberg.org/Eclosion-Tech/Comb.is/src/branch/main/COMB_PROTOCOL.md"
                >
                  Read the protocol ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="manifesto-strip" aria-label="Comb principle">
        <span>Federate the entitlements.</span>
        <span className="manifesto-line" aria-hidden="true" />
        <span>Never federate the money.</span>
      </div>

      <section className="story" id="how-it-works" ref={storyRoot}>
        <div className="story-intro">
          <div>
            <span className="section-index">01 — The handshake</span>
            <h2>One fact. Many places.</h2>
          </div>
          <p>
            Comb begins after an Issuer decides a Grant is valid. Scroll the
            handshake: the payment relationship stays put while a narrow,
            signed entitlement crosses between independent products.
          </p>
        </div>

        <div className="story-shell">
          <div className="story-visual-wrap" aria-live="polite">
            <div className={"story-visual phase-" + activeStep}>
              <div className="stage-meta">
                <span>Comb signal path</span>
                <span>Step {String(activeStep + 1).padStart(2, "0")} / 04</span>
              </div>
              <div className="stage-rail" aria-hidden="true" />
              <div className="signal-token" aria-hidden="true">
                GRANT
              </div>
              <div className="stage-nodes">
                <div className={"stage-node " + (activeStep === 0 ? "active" : "")}>
                  <div>
                    <span className="node-id">Issuer A</span>
                    <strong className="node-name">Creator product</strong>
                  </div>
                  <span className="node-status">
                    {activeStep === 0 ? "Support recorded" : "Grant remains"}
                  </span>
                </div>
                <div className={"stage-node " + (activeStep === 1 ? "active" : "")}>
                  <div>
                    <span className="node-id">Comb v0.1</span>
                    <strong className="node-name">Signed claim</strong>
                  </div>
                  <span className="node-status">
                    {activeStep === 1 ? "Audience bound" : "Minimal disclosure"}
                  </span>
                </div>
                <div className={"stage-node " + (activeStep >= 2 ? "active" : "")}>
                  <div>
                    <span className="node-id">Consumer B</span>
                    <strong className="node-name">Another service</strong>
                  </div>
                  <span className="node-status">
                    {activeStep === 3 ? "Benefit unlocked" : "Trust verified"}
                  </span>
                </div>
              </div>
              <div className="stage-caption">
                <strong>{storySteps[activeStep].number}</strong>
                <span>{storySteps[activeStep].caption}</span>
              </div>
            </div>
          </div>

          <div className="story-steps">
            {storySteps.map((step, index) => (
              <article
                className={"story-step " + (activeStep === index ? "active" : "")}
                data-story-step={index}
                key={step.number}
              >
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="boundary" aria-label="Comb protocol boundary">
        <article className="boundary-panel">
          <span className="boundary-label">Stays local</span>
          <h3>Money, billing, identity.</h3>
          <p>
            Each product owns its own checkout, payment rail, supporter
            relationship, durable Grants, and application UX.
          </p>
        </article>
        <article className="boundary-panel claims">
          <span className="boundary-label">Can travel</span>
          <h3>Signed, narrow entitlements.</h3>
          <p>
            A Consumer learns only the Creator and Benefits the supporter
            authorized for that specific audience.
          </p>
        </article>
      </section>

      <section className="peers" id="federation">
        <div className="peers-head">
          <div>
            <span className="section-index">02 — No center</span>
            <h2>Peers, not tenants.</h2>
          </div>
          <p className="peers-copy">
            Fellowship is the first complete patronage product built on Comb.
            It is not the network. Worm, Studious, and unrelated products can
            implement the same public roles with their own state and keys.
          </p>
        </div>
        <div className="peer-grid">
          {peers.map((peer, index) => (
            <article className="peer-card" key={peer.name}>
              <span className="peer-top">
                {String(index + 1).padStart(2, "0")} · {peer.kind}
              </span>
              <div>
                <h3 className="peer-name">{peer.name}</h3>
                <p className="peer-role">{peer.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div className="protocol-copy">
          <span className="section-index">03 — Deliberately boring</span>
          <h2>Built from known machinery.</h2>
          <p>
            HTTPS. OIDC Authorization Code with PKCE. Short-lived RS256 JWTs.
            JWKS rotation. Exact audience checks. Creator-scoped delegation.
            Comb invents a small shared vocabulary, not new cryptography.
          </p>
          <a
            className="button button-secondary"
            href="https://codeberg.org/Eclosion-Tech/Comb.is"
          >
            Explore the open repository ↗
          </a>
        </div>
        <div className="token-window" aria-label="Example Comb claim">
          <div className="token-window-head">
            <span>entitlement.jwt</span>
            <span>typ: at+jwt · alg: RS256</span>
          </div>
          <pre className="token-code">
            <code>
              {"{\n"}
              <span className="code-key">  &quot;iss&quot;</span>
              {": "}
              <span className="code-value">&quot;https://issuer.example&quot;</span>
              {",\n"}
              <span className="code-key">  &quot;aud&quot;</span>
              {": "}
              <span className="code-value">&quot;https://consumer.example&quot;</span>
              {",\n"}
              <span className="code-key">  &quot;comb&quot;</span>
              {": {\n"}
              <span className="code-key">    &quot;version&quot;</span>
              {": "}
              <span className="code-accent">&quot;0.1&quot;</span>
              {",\n"}
              <span className="code-key">    &quot;grants&quot;</span>
              {": [{\n"}
              <span className="code-key">      &quot;creator&quot;</span>
              {": "}
              <span className="code-value">&quot;https://artist.example&quot;</span>
              {",\n"}
              <span className="code-key">      &quot;benefits&quot;</span>
              {": [\n"}
              <span className="code-accent">
                {"        "}
                &quot;https://artist.example/benefits/supporter&quot;
              </span>
              {"\n      ]\n    }]\n  }\n}"}
            </code>
          </pre>
        </div>
      </section>

      <section className="finale">
        <h2>
          Your supporters are <em>your relationship.</em>
        </h2>
        <div className="finale-lower">
          <p className="finale-note">
            Comb is an experimental open protocol from Eclosion Tech. The v0
            laboratory is being built in public on Codeberg.
          </p>
          <a
            className="button"
            href="https://codeberg.org/Eclosion-Tech/Comb.is"
          >
            Follow the laboratory ↗
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <span>Comb · comb.is · CC BY / Apache-2.0 / AGPL</span>
        <span>Federate entitlements. Never money.</span>
      </footer>
    </main>
  );
}
