"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { formatKES, formatRate } from "@/lib/format";

/** Toast variants, mapped to our semantic tokens. */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success("Listing published", { description: "3 buyers are browsing tomatoes now." })}
      >
        Success
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.error("Couldn’t reach the pricing model", { description: "Falling back to the next model." })}
      >
        Error
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.warning("Only 12 kg left", { description: "Below the quantity you asked for." })}
      >
        Warning
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info(`Today’s rate: ${formatRate(50)}`)}
      >
        Info
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.loading("Asking the model for a fair price…")}
      >
        Loading
      </Button>
    </div>
  );
}

/**
 * Animate UI tabs — the farmer dashboard's Listings / Orders split. This is the
 * motion budget in practice: the highlight slides, content cross-fades, nothing
 * bounces.
 */
export function TabsDemo() {
  return (
    <Tabs defaultValue="listings" className="w-full">
      <TabsList>
        <TabsTrigger value="listings">Listings</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
      </TabsList>
      <TabsContents>
        <TabsContent value="listings" className="pt-4">
          <div className="flex items-baseline justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <p className="font-medium">Tomatoes</p>
              <p className="text-sm text-muted-foreground">120 kg available</p>
            </div>
            <p className="figure text-lg font-medium">{formatRate(45)}</p>
          </div>
        </TabsContent>
        <TabsContent value="orders" className="pt-4">
          <div className="flex items-baseline justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <p className="font-medium">Order #1042</p>
              <p className="text-sm text-muted-foreground">4 kg sukuma wiki</p>
            </div>
            <p className="figure text-lg font-medium">{formatKES(180)}</p>
          </div>
        </TabsContent>
      </TabsContents>
    </Tabs>
  );
}
