import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { LegalFooter } from "@/components/LegalFooter";
import { BUSINESS } from "@/lib/business";

const TITLE = "Printing & Delivery in India — Sirpam 3D Labs Mold";
const DESC = "How our mold printing service works: India-only delivery, how we quote on WhatsApp, how printed mold halves are packed, and what to do if a parcel arrives damaged.";

export const Route = createFileRoute("/delivery")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/delivery" }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "/delivery" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeliveryPage,
});

const steps = [
  ["Send your file", "Share the STL or a screenshot of your design on WhatsApp with your city and PIN code."],
  ["Get a price", "We reply within 1 working day with the price, material and the print and delivery time for your order."],
  ["We print and check", "Each half is checked for fit, alignment keys and a clean parting face before packing."],
  ["Packed and shipped", "Halves are wrapped separately and boxed with padding. We send the tracking number on WhatsApp."],
];

function DeliveryPage() {
  const wa = `https://wa.me/${BUSINESS.whatsapp}`;
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold">Printing and delivery</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated October 2026</p>
        <p className="mt-6 text-muted-foreground">We print molds and deliver them <b className="text-foreground">within India only</b>. We do not ship outside India.</p>

        <ol className="mt-8 grid gap-4">
          {steps.map(([h, p], i) => (
            <li key={h} className="flex gap-4 rounded-lg border border-border bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div><h2 className="font-semibold">{h}</h2><p className="mt-1 text-sm text-muted-foreground">{p}</p></div>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-xl font-semibold">Timing</h2>
        <p className="mt-2 text-muted-foreground">Print time depends on size, material and how many parts the mold has, so we confirm it with every quote rather than promising one number for all orders. Courier time depends on your PIN code.</p>
        <h2 className="mt-8 text-xl font-semibold">Damaged or wrong parcel</h2>
        <p className="mt-2 text-muted-foreground">Please take photos of the box and the parts before you throw away the packing, and send them on WhatsApp within 48 hours of delivery. If a part is broken in transit or does not match what we agreed, we will reprint it.</p>
        <h2 className="mt-8 text-xl font-semibold">Payment</h2>
        <p className="mt-2 text-muted-foreground">Print orders are agreed and paid outside the app after you accept the quote. Studio credits are separate — see the <Link to="/refunds" className="underline">refund policy</Link>.</p>

        <a href={wa} target="_blank" rel="noreferrer" className="mt-10 inline-flex rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground">Message us on WhatsApp</a>
        <LegalFooter />
      </main>
    </div>
  );
}
