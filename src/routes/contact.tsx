import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LegalFooter } from "@/components/LegalFooter";
import { BUSINESS } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Contact us — Sirpam 3D Labs Mold" },
      { name: "description", content: "Questions about mold making, credits or your account? Contact Sirpam 3D Labs." },
      { property: "og:title", content: "Contact us — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Get in touch with Sirpam 3D Labs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    const { error } = await supabase.from("contact_messages").insert({ name, email, message, age_confirmed: ageOk });
    if (error) setErrorMessage(error.message.includes("rate_limited")
      ? "You've sent several messages recently. Please wait an hour, or email us directly."
      : "Your message could not be sent. Please email us instead.");
    else setSent(true);
    setBusy(false);
  };

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="text-3xl font-bold">Contact us</h1>
        <p className="mt-2 text-muted-foreground">
          Questions about mold making, credits, or your account? Message us on WhatsApp{" "}
          {BUSINESS.whatsapp && (
            <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-primary">
              +91 {BUSINESS.whatsapp.slice(2)}
            </a>
          )}{" "}
          or email{" "}
          <a href={`mailto:${BUSINESS.email}`} className="text-primary">{BUSINESS.email}</a>. We print and
          deliver within India only.
        </p>
        {sent ? (
          <div className="mt-6 rounded-3xl bg-card p-6 shadow-sm">
            <p className="font-semibold">Message sent.</p>
            <p className="mt-1 text-sm text-muted-foreground">We'll reply to your email as soon as we can.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-3xl bg-card p-6 shadow-sm">
            <input required aria-label="Your name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            <input required type="email" aria-label="Your email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            <textarea required rows={5} aria-label="Your message" placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" required checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} className="mt-0.5" />
              <span>I am 13 or older. We use your details only to reply (see the <a href="/privacy" className="text-primary">Privacy Policy</a>).</span>
            </label>
            <Button disabled={busy}>
              {busy ? "Sending…" : "Send message"}
            </Button>
            {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          </form>
        )}
      </main>
      <LegalFooter />
    </div>
  );
}
