"use client";

import type { ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";

/**
 * Client shell for the farmer dashboard's Listings / Orders split.
 *
 * Takes rendered server content as props rather than fetching anything itself, so
 * the data stays in Server Components and only the tab state lives on the client.
 */
export function DashboardTabs({
  listings,
  orders,
  orderCount,
}: {
  listings: ReactNode;
  orders: ReactNode;
  orderCount: number;
}) {
  return (
    <Tabs defaultValue="listings" className="w-full">
      <TabsList>
        <TabsTrigger value="listings">Listings</TabsTrigger>
        <TabsTrigger value="orders">
          Orders
          {orderCount > 0 ? (
            <span className="figure ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
              {orderCount}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContents>
        <TabsContent value="listings" className="pt-6">
          {listings}
        </TabsContent>
        <TabsContent value="orders" className="pt-6">
          {orders}
        </TabsContent>
      </TabsContents>
    </Tabs>
  );
}
