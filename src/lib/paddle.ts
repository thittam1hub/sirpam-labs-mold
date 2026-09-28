import { resolvePaddlePrice } from "@/lib/payments.functions";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

declare global {
  interface Window { Paddle: any; Razorpay: any }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let ready: Promise<void> | null = null;
export function initializePaddle(): Promise<void> {
  if (ready) return ready;
  if (!clientToken) return Promise.reject(new Error("Payments are not configured"));
  ready = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
      window.Paddle.Initialize({ token: clientToken });
      resolve();
    };
    s.onerror = () => { ready = null; reject(new Error("Couldn't load checkout")); };
    document.head.appendChild(s);
  });
  return ready;
}

export async function getPaddlePriceId(priceId: "starter_pack_once" | "maker_pack_once" | "studio_pack_once") {
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}

let rzp: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if (rzp) return rzp;
  rzp = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => { rzp = null; reject(new Error("Couldn't load checkout")); };
    document.head.appendChild(s);
  });
  return rzp;
}
