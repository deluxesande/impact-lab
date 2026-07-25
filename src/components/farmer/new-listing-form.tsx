"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader, Trash } from "reicon-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProduceImage } from "@/components/produce/produce-image";
import { PriceCard } from "./price-card";
import { createListingAction, suggestPriceAction } from "@/lib/data/actions";
import type { PriceSuggestion } from "@/lib/data/types";
import { PRODUCE } from "@/lib/data/produce";
import {
  ACCEPTED_IMAGE_TYPES,
  fileToDownscaledDataUrl,
  uploadProduceImage,
} from "@/lib/image";
import { formatKES } from "@/lib/format";

/**
 * New listing: produce + quantity → suggested price → publish.
 *
 * Form-first per §"Farmer UX" — it demos faster and more reliably than a chat,
 * while still calling the real pricing agent underneath.
 *
 * The price is a **two-step** flow on purpose: ask, then confirm. The farmer sees
 * the suggestion and can override it before publishing, which is the whole point
 * of the product — they hold the leverage, not the system.
 */
export function NewListingForm({ language }: { language: "en" | "sw" }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = useId();

  const [produceSlug, setProduceSlug] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pricing, startPricing] = useTransition();
  const [publishing, startPublishing] = useTransition();

  const quantityKg = Number(quantity);
  const pricePerKg = Number(price);
  const canPrice = Boolean(produceSlug) && Number.isFinite(quantityKg) && quantityKg > 0;
  const canPublish = canPrice && Number.isFinite(pricePerKg) && pricePerKg > 0;

  /** Reset a stale suggestion when the inputs it was based on change. */
  function invalidate() {
    setSuggestion(null);
    setError(null);
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    try {
      // Preview + what we actually store. See src/lib/image.ts for why.
      setPhoto(await fileToDownscaledDataUrl(file));
      setPhotoFile(file);
      // Exercise the real upload endpoint too; its key is unusable in Phase 1,
      // so a failure here must not block the farmer.
      void uploadProduceImage(file, `farmer-${Date.now()}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "decode";
      toast.error(
        reason === "size"
          ? "That image is over 10 MB."
          : reason === "type"
            ? "Use a JPEG, PNG or WebP image."
            : "Couldn’t read that image.",
      );
    }
  }

  function handleSuggest() {
    setError(null);
    startPricing(async () => {
      const result = await suggestPriceAction(produceSlug, quantityKg, language);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuggestion(result.data);
      // Prefill, but leave it editable — the farmer has the final say.
      setPrice(String(result.data.pricePerKg));
    });
  }

  function handlePublish() {
    setError(null);
    startPublishing(async () => {
      const result = await createListingAction({
        produceSlug,
        quantityKg,
        pricePerKg,
        photo,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Listing published", {
        description: `${quantityKg} kg at ${formatKES(pricePerKg)} / kg — buyers can see it now.`,
      });
      router.push("/farmer");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {/* Produce */}
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-produce`}>What are you selling?</Label>
          <Select
            value={produceSlug}
            onValueChange={(v) => {
              setProduceSlug(v);
              invalidate();
            }}
          >
            <SelectTrigger id={`${ids}-produce`} className="w-full">
              <SelectValue placeholder="Choose produce" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCE.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name}
                  {/* Swahili name alongside English — the farmer surface is
                      bilingual (§6.1). */}
                  {p.nameSw !== p.name ? (
                    <span className="text-muted-foreground"> · {p.nameSw}</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-qty`}>How many kilograms?</Label>
          <Input
            id={`${ids}-qty`}
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="120"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              invalidate();
            }}
            className="figure"
          />
        </div>

        {/* Photo */}
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-photo`}>Photo (optional)</Label>
          <input
            ref={fileInput}
            id={`${ids}-photo`}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            capture="environment"
            className="sr-only"
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
              <Camera size={18} aria-hidden />
              {photo ? "Change photo" : "Add a photo"}
            </Button>
            {photo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhoto(undefined);
                  setPhotoFile(undefined);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <Trash size={16} aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          {photoFile ? (
            <p className="text-xs text-muted-foreground">{photoFile.name}</p>
          ) : null}
        </div>

        {/* Price step */}
        <div className="border-t border-border pt-6">
          {!suggestion ? (
            <>
              <Button type="button" onClick={handleSuggest} disabled={!canPrice || pricing}>
                {pricing ? (
                  <>
                    <Loader size={16} className="animate-spin" aria-hidden />
                    Asking for a fair rate…
                  </>
                ) : (
                  "Get a suggested rate"
                )}
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                We’ll suggest a fair price per kilo. You can change it before
                publishing.
              </p>
            </>
          ) : (
            <div className="space-y-5">
              {/* Announce the arrival for screen readers — it appears without a
                  navigation, so it would otherwise pass silently. */}
              <div aria-live="polite">
                <PriceCard suggestion={suggestion} quantityKg={quantityKg} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${ids}-price`}>Your rate per kilogram (KES)</Label>
                <Input
                  id={`${ids}-price`}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="figure"
                  aria-describedby={`${ids}-price-help`}
                />
                <p id={`${ids}-price-help`} className="text-sm text-muted-foreground">
                  {canPublish
                    ? `${quantityKg} kg × ${formatKES(pricePerKg)} = ${formatKES(quantityKg * pricePerKg)} total.`
                    : "Enter a rate above zero."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={handlePublish} disabled={!canPublish || publishing}>
                  {publishing ? (
                    <>
                      <Loader size={16} className="animate-spin" aria-hidden />
                      Publishing…
                    </>
                  ) : (
                    "Publish listing"
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={handleSuggest} disabled={pricing}>
                  Ask again
                </Button>
              </div>
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* Live preview of the consumer-facing card */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="text-sm font-medium text-foreground">Buyers will see</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-[4/3] w-full">
            <ProduceImage produceSlug={produceSlug || "tomatoes"} photo={photo} priority />
          </div>
          <div className="p-4">
            <p className="font-medium text-foreground">
              {PRODUCE.find((p) => p.slug === produceSlug)?.name ?? "Your produce"}
            </p>
            <p className="figure mt-1 text-lg font-semibold text-foreground">
              {canPublish ? `${formatKES(pricePerKg)} / kg` : "— / kg"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {quantityKg > 0 ? `${quantityKg} kg available` : "Quantity not set"}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
